REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.integration_events FROM authenticated, anon, service_role;
REVOKE ALL ON public.integration_rate_limits FROM authenticated, anon;