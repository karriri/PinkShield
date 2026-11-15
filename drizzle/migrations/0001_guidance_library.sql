CREATE TABLE public.guidance_sources (
  id text PRIMARY KEY,
  organization text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  country text NOT NULL DEFAULT 'international',
  published_or_updated text,
  checked_on date NOT NULL DEFAULT current_date,
  population text,
  screening_interval text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guidance_sources TO anon, authenticated;
GRANT INSERT, UPDATE ON public.guidance_sources TO authenticated;
GRANT ALL ON public.guidance_sources TO service_role;
ALTER TABLE public.guidance_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guidance sources readable" ON public.guidance_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins insert sources" ON public.guidance_sources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update sources" ON public.guidance_sources FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.guidance_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  source_id text NOT NULL REFERENCES public.guidance_sources(id),
  topic text NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  text text NOT NULL,
  age_min integer,
  age_max integer,
  interval_years integer,
  even_ages_only boolean,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);
CREATE UNIQUE INDEX guidance_one_active ON public.guidance_statements(key) WHERE active;
GRANT SELECT ON public.guidance_statements TO anon, authenticated;
GRANT INSERT, UPDATE ON public.guidance_statements TO authenticated;
GRANT ALL ON public.guidance_statements TO service_role;
ALTER TABLE public.guidance_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active guidance readable" ON public.guidance_statements FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert guidance" ON public.guidance_statements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update guidance" ON public.guidance_statements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.guidance_sources (id, organization, title, url, country, published_or_updated, checked_on, population, screening_interval) VALUES
('kz-order-174', 'Министерство здравоохранения РК', 'Приказ № ҚР ДСМ-174/2020 (с изменениями приказом № 71 от 29.07.2025)', 'https://zan.gov.kz/api/documents/212907/rus/download/pdf', 'KZ', '29.07.2025', '2026-11-15', 'Женщины 40, 42, 44 … 76 лет', '1 раз в 2 года'),
('kz-egov-screening', 'Портал электронного правительства РК (gov.kz)', 'Скрининговые обследования', 'https://www.gov.kz/situations/331/858?lang=ru', 'KZ', NULL, '2026-11-15', 'Женщины 40–76 лет, в год чётного возраста', '1 раз в 2 года'),
('who-breast-cancer', 'Всемирная организация здравоохранения (ВОЗ)', 'Breast cancer — fact sheet', 'https://www.who.int/news-room/fact-sheets/detail/breast-cancer', 'international', NULL, '2026-11-15', NULL, NULL),
('nci-brca', 'National Cancer Institute (США)', 'BRCA Gene Changes: Cancer Risk and Genetic Testing', 'https://www.cancer.gov/about-cancer/causes-prevention/genetics/brca-fact-sheet', 'international', NULL, '2026-11-15', NULL, NULL);

INSERT INTO public.guidance_statements (key, source_id, topic, kind, text, age_min, age_max, interval_years, even_ages_only) VALUES
('kz-screening', 'kz-egov-screening', 'screening', 'screening', 'Скрининг рака молочной железы в Казахстане: женщины в возрасте от 40 до 76 лет — один раз в 2 года, в год достижения соответствующего чётного возраста.', 40, 76, 2, true),
('kz-screening-not-personal', 'kz-order-174', 'screening', 'info', 'Скрининг — это обследование для групп населения определённого возраста без жалоб. Попадание в возрастную группу не является индивидуальной медицинской рекомендацией: сроки и вид обследования лучше согласовать с поликлиникой по месту прикрепления.', NULL, NULL, NULL, NULL),
('who-symptoms', 'who-breast-cancer', 'symptoms', 'symptom', 'ВОЗ относит к возможным признакам, которые стоит показать врачу: уплотнение или узел в груди (часто безболезненный), изменение размера, формы или вида груди, втяжение, покраснение или другие изменения кожи, изменение соска или ареолы, необычные или кровянистые выделения из соска. Человеку с необычным уплотнением в груди следует обратиться за медицинской помощью, даже если оно не болит.', NULL, NULL, NULL, NULL),
('who-most-lumps', 'who-breast-cancer', 'symptoms', 'info', 'По данным ВОЗ, большинство уплотнений в груди не являются раком. Разобраться, что это, может только медицинский специалист после осмотра.', NULL, NULL, NULL, NULL),
('nci-family', 'nci-brca', 'risk', 'risk', 'По материалам NCI, тем, кто обеспокоен возможной наследственной предрасположенностью (например, рак груди или яичников у близких родственников), стоит обсудить это с врачом или генетическим консультантом: они оценят, нужна ли индивидуальная оценка или генетическое консультирование.', NULL, NULL, NULL, NULL),
('followup-own-plan', 'kz-order-174', 'follow_up', 'info', 'Если вы уже наблюдаетесь по поводу заболевания груди, ранее лечились от рака молочной железы, получали отклонения в результатах или у вас выявлен высокий риск, обычная программа скрининга может к вам не относиться. Ваш план наблюдения определяет лечащий врач.', NULL, NULL, NULL, NULL);
