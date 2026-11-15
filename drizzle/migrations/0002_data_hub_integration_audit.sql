CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('health_check','list_datasets','list_versions','create_import','get_import','create_validation','create_annotation','create_ml_job','get_ml_job','list_models')),
  job_id uuid,
  request_id uuid NOT NULL,
  http_status int,
  outcome text NOT NULL CHECK (outcome ~ '^[a-z_]{1,40}$'),
  is_sync boolean NOT NULL DEFAULT false,
  duration_ms int NOT NULL DEFAULT 0,
  attempt int NOT NULL DEFAULT 1
);
CREATE INDEX integration_events_actor_time ON public.integration_events (actor_id, created_at DESC);
CREATE INDEX integration_events_time ON public.integration_events (created_at DESC);
GRANT SELECT ON public.integration_events TO authenticated;
GRANT SELECT, INSERT ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read integration events" ON public.integration_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.integration_events_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'integration_events is append-only';
END $$;
CREATE TRIGGER integration_events_no_update BEFORE UPDATE OR DELETE ON public.integration_events
  FOR EACH ROW EXECUTE FUNCTION public.integration_events_immutable();
CREATE TRIGGER integration_events_no_truncate BEFORE TRUNCATE ON public.integration_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.integration_events_immutable();

CREATE TABLE public.integration_rate_limits (
  actor_id uuid PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 0
);
GRANT ALL ON public.integration_rate_limits TO service_role;
ALTER TABLE public.integration_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.data_hub_take_slot()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ok boolean;
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.integration_rate_limits AS r (actor_id, window_start, count)
  VALUES (uid, now(), 1)
  ON CONFLICT (actor_id) DO UPDATE SET
    window_start = CASE WHEN r.window_start < now() - interval '60 seconds' THEN now() ELSE r.window_start END,
    count = CASE WHEN r.window_start < now() - interval '60 seconds' THEN 1 ELSE r.count + 1 END
  RETURNING count <= 30 INTO ok;
  RETURN ok;
END $$;

CREATE OR REPLACE FUNCTION public.data_hub_log_event(
  _operation text, _job_id uuid, _request_id uuid, _http_status int, _outcome text,
  _is_sync boolean, _duration_ms int, _attempt int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.integration_events (actor_id, operation, job_id, request_id, http_status, outcome, is_sync, duration_ms, attempt)
  VALUES (uid, _operation, _job_id, _request_id, _http_status, _outcome, coalesce(_is_sync,false), greatest(coalesce(_duration_ms,0),0), greatest(coalesce(_attempt,1),1));
END $$;

REVOKE ALL ON FUNCTION public.data_hub_take_slot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.data_hub_log_event(text, uuid, uuid, int, text, boolean, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_hub_take_slot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.data_hub_log_event(text, uuid, uuid, int, text, boolean, int, int) TO authenticated;