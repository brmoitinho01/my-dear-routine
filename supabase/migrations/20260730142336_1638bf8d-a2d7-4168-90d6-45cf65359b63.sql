-- ============================================================
-- GMOS FASE 2 (F2) — APPLY v1.0  (ADITIVO)
-- ============================================================

-- ---------- 1. PERMISSÕES ----------
INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
VALUES
  ('strategy.read',  'Ler planejamento estratégico, objetivos, KPIs e riscos', 'strategy', ARRAY['organization','company','business_unit'], 'low',    true),
  ('strategy.manage','Criar e editar planejamento estratégico, objetivos, KPIs e riscos', 'strategy', ARRAY['organization','company','business_unit'], 'medium', true),
  ('action.read',    'Ler planos de ação',        'action',  ARRAY['organization','company','business_unit'], 'low',    true),
  ('action.manage',  'Criar e editar planos de ação', 'action', ARRAY['organization','company','business_unit'], 'medium', true),
  ('routine.read',   'Ler rotinas e execuções',   'routine', ARRAY['organization','company','business_unit'], 'low',    true),
  ('routine.manage', 'Criar, editar e executar rotinas', 'routine', ARRAY['organization','company','business_unit'], 'medium', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p
    ON p.code IN ('strategy.read','strategy.manage','action.read','action.manage','routine.read','routine.manage')
 WHERE r.code = 'group_admin' AND r.status = 'active'
   AND NOT EXISTS (
     SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

-- ---------- 2. HELPERS ----------
CREATE OR REPLACE FUNCTION public.f2_bu_scope_id(p_bu uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.f1_entity_scope_id('public.business_units', p_bu)
$$;
REVOKE ALL ON FUNCTION public.f2_bu_scope_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f2_bu_scope_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.f2_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_action text; v_meta jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSE
    v_action := 'update';
    IF to_jsonb(NEW) ? 'status' AND (to_jsonb(OLD)->>'status') IS DISTINCT FROM (to_jsonb(NEW)->>'status') THEN
      v_meta := jsonb_build_object('status_from', to_jsonb(OLD)->>'status', 'status_to', to_jsonb(NEW)->>'status');
    END IF;
  END IF;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES
    ((to_jsonb(NEW)->>'organization_id')::uuid,
     public.current_user_id(),
     'f2.' || TG_TABLE_NAME || '.' || v_action,
     'public.' || TG_TABLE_NAME,
     NEW.id,
     v_action,
     'trigger',
     v_meta);
  RETURN NEW;
END $$;

-- ---------- 3. TABELAS ----------

-- 3.1 strategic_plans
CREATE TABLE public.strategic_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  business_unit_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategic_plans_cycle_chk CHECK (cycle_end > cycle_start),
  CONSTRAINT strategic_plans_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT strategic_plans_company_fk FOREIGN KEY (company_id, organization_id)
    REFERENCES public.companies(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT strategic_plans_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.2 strategic_pillars
CREATE TABLE public.strategic_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategic_pillars_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT strategic_pillars_plan_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT strategic_pillars_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.3 strategic_objectives
CREATE TABLE public.strategic_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  pillar_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  due_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','at_risk','completed','cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategic_objectives_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT strategic_objectives_plan_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT strategic_objectives_pillar_fk FOREIGN KEY (pillar_id, organization_id)
    REFERENCES public.strategic_pillars(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT strategic_objectives_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.4 strategic_risks
CREATE TABLE public.strategic_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  objective_id uuid,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  impact text NOT NULL DEFAULT 'medium' CHECK (impact IN ('low','medium','high')),
  probability text NOT NULL DEFAULT 'medium' CHECK (probability IN ('low','medium','high')),
  contingency text,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','mitigating','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategic_risks_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT strategic_risks_plan_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT strategic_risks_objective_fk FOREIGN KEY (objective_id, organization_id)
    REFERENCES public.strategic_objectives(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT strategic_risks_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.5 kpis
CREATE TABLE public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  pillar_id uuid,
  objective_id uuid,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  unit text,
  formula text,
  source text,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  direction text NOT NULL DEFAULT 'higher_better' CHECK (direction IN ('higher_better','lower_better','range')),
  baseline_value numeric,
  target_value numeric,
  target_min numeric,
  target_max numeric,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT kpis_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT kpis_plan_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT kpis_pillar_fk FOREIGN KEY (pillar_id, organization_id)
    REFERENCES public.strategic_pillars(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT kpis_objective_fk FOREIGN KEY (objective_id, organization_id)
    REFERENCES public.strategic_objectives(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT kpis_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.6 kpi_measurements
CREATE TABLE public.kpi_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  kpi_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric NOT NULL,
  source_evidence text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','rejected')),
  validated_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT kpi_measurements_period_chk CHECK (period_end >= period_start),
  CONSTRAINT kpi_measurements_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT kpi_measurements_kpi_period_uk UNIQUE (kpi_id, period_start),
  CONSTRAINT kpi_measurements_kpi_fk FOREIGN KEY (kpi_id, organization_id)
    REFERENCES public.kpis(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT kpi_measurements_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.7 action_plans
CREATE TABLE public.action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  plan_id uuid,
  objective_id uuid,
  kpi_id uuid,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  why text,
  how text,
  where_place text,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  start_date date,
  due_date date,
  estimated_cost numeric,
  actual_cost numeric,
  expected_result text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','in_progress','blocked','completed','cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT action_plans_dates_chk CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date),
  CONSTRAINT action_plans_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT action_plans_plan_fk FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT action_plans_objective_fk FOREIGN KEY (objective_id, organization_id)
    REFERENCES public.strategic_objectives(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT action_plans_kpi_fk FOREIGN KEY (kpi_id, organization_id)
    REFERENCES public.kpis(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT action_plans_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.8 routine_templates
CREATE TABLE public.routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  business_unit_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','custom')),
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  start_date date,
  weekday integer CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  day_of_month integer CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 28),
  custom_interval_days integer CHECK (custom_interval_days IS NULL OR custom_interval_days > 0),
  scheduled_time time,
  requires_evidence boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT routine_templates_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT routine_templates_active_chk CHECK (
    status <> 'active' OR (
      start_date IS NOT NULL
      AND (frequency <> 'weekly'   OR weekday IS NOT NULL)
      AND (frequency <> 'monthly'  OR day_of_month IS NOT NULL)
      AND (frequency <> 'custom'   OR custom_interval_days IS NOT NULL)
    )
  ),
  CONSTRAINT routine_templates_company_fk FOREIGN KEY (company_id, organization_id)
    REFERENCES public.companies(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT routine_templates_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- 3.9 routine_executions
CREATE TABLE public.routine_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  template_id uuid NOT NULL,
  competence_date date NOT NULL,
  due_date date NOT NULL,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','blocked','missed','cancelled')),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  evidence text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT routine_executions_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT routine_executions_competence_uk UNIQUE (template_id, competence_date),
  CONSTRAINT routine_executions_template_fk FOREIGN KEY (template_id, organization_id)
    REFERENCES public.routine_templates(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT routine_executions_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT
);

-- ---------- 4. ÍNDICES ----------
CREATE INDEX strategic_pillars_plan_idx      ON public.strategic_pillars(plan_id);
CREATE INDEX strategic_objectives_plan_idx   ON public.strategic_objectives(plan_id);
CREATE INDEX strategic_objectives_pillar_idx ON public.strategic_objectives(pillar_id);
CREATE INDEX strategic_risks_plan_idx        ON public.strategic_risks(plan_id);
CREATE INDEX kpis_plan_idx                   ON public.kpis(plan_id);
CREATE INDEX kpi_measurements_kpi_idx        ON public.kpi_measurements(kpi_id);
CREATE INDEX action_plans_bu_idx             ON public.action_plans(business_unit_id);
CREATE INDEX routine_templates_bu_idx        ON public.routine_templates(business_unit_id);
CREATE INDEX routine_executions_template_idx ON public.routine_executions(template_id);

-- ---------- 5. TRIGGERS ----------
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['strategic_plans','strategic_pillars','strategic_objectives','strategic_risks',
                           'kpis','kpi_measurements','action_plans','routine_templates','routine_executions']
  LOOP
    EXECUTE format('CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at()', t, t);
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.f2_audit()', t, t);
  END LOOP;
END $do$;

-- ---------- 6. GRANTS + RLS + POLICIES ----------
DO $do$
DECLARE t text; perm text;
BEGIN
  FOREACH t IN ARRAY ARRAY['strategic_plans','strategic_pillars','strategic_objectives','strategic_risks',
                           'kpis','kpi_measurements','action_plans','routine_templates','routine_executions']
  LOOP
    perm := CASE
      WHEN t = 'action_plans' THEN 'action'
      WHEN t IN ('routine_templates','routine_executions') THEN 'routine'
      ELSE 'strategy' END;

    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_permission(%L::citext, ''business_unit'', public.f2_bu_scope_id(business_unit_id)))',
      t || '_select', t, perm || '.read');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(%L::citext, ''business_unit'', public.f2_bu_scope_id(business_unit_id)))',
      t || '_insert', t, perm || '.manage');
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(%L::citext, ''business_unit'', public.f2_bu_scope_id(business_unit_id))) WITH CHECK (public.has_permission(%L::citext, ''business_unit'', public.f2_bu_scope_id(business_unit_id)))',
      t || '_update', t, perm || '.manage', perm || '.manage');
  END LOOP;
END $do$;

-- ---------- 7. GERAÇÃO IDEMPOTENTE DE EXECUÇÕES ----------
CREATE OR REPLACE FUNCTION public.f2_generate_routine_executions(p_template_id uuid, p_until date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  tpl public.routine_templates%ROWTYPE;
  v_until date := COALESCE(p_until, CURRENT_DATE);
  v_cur date;
  v_created integer := 0;
  v_guard integer := 0;
BEGIN
  SELECT * INTO tpl FROM public.routine_templates WHERE id = p_template_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'rotina inexistente'; END IF;

  IF NOT public.has_permission('routine.manage'::public.citext, 'business_unit', public.f2_bu_scope_id(tpl.business_unit_id)) THEN
    RAISE EXCEPTION 'permissao negada para gerar execucoes';
  END IF;

  IF tpl.status <> 'active' OR tpl.start_date IS NULL THEN RETURN 0; END IF;

  v_cur := tpl.start_date;

  -- alinha o primeiro ponto de competência
  IF tpl.frequency = 'weekly' AND tpl.weekday IS NOT NULL THEN
    WHILE EXTRACT(DOW FROM v_cur)::int <> tpl.weekday LOOP v_cur := v_cur + 1; END LOOP;
  ELSIF tpl.frequency = 'monthly' AND tpl.day_of_month IS NOT NULL THEN
    v_cur := date_trunc('month', v_cur)::date + (tpl.day_of_month - 1);
    IF v_cur < tpl.start_date THEN
      v_cur := (date_trunc('month', tpl.start_date) + interval '1 month')::date + (tpl.day_of_month - 1);
    END IF;
  ELSIF tpl.frequency = 'quarterly' THEN
    v_cur := date_trunc('quarter', v_cur)::date;
    IF v_cur < tpl.start_date THEN v_cur := (date_trunc('quarter', tpl.start_date) + interval '3 months')::date; END IF;
  END IF;

  WHILE v_cur <= v_until AND v_guard < 2000 LOOP
    v_guard := v_guard + 1;

    INSERT INTO public.routine_executions
      (organization_id, business_unit_id, template_id, competence_date, due_date, owner_user_id, status)
    VALUES
      (tpl.organization_id, tpl.business_unit_id, tpl.id, v_cur, v_cur, tpl.owner_user_id, 'pending')
    ON CONFLICT (template_id, competence_date) DO NOTHING;

    IF FOUND THEN v_created := v_created + 1; END IF;

    v_cur := CASE tpl.frequency
      WHEN 'daily'     THEN v_cur + 1
      WHEN 'weekly'    THEN v_cur + 7
      WHEN 'biweekly'  THEN v_cur + 14
      WHEN 'monthly'   THEN (v_cur + interval '1 month')::date
      WHEN 'quarterly' THEN (v_cur + interval '3 months')::date
      ELSE v_cur + COALESCE(tpl.custom_interval_days, 1)
    END;
  END LOOP;

  RETURN v_created;
END $$;
REVOKE ALL ON FUNCTION public.f2_generate_routine_executions(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f2_generate_routine_executions(uuid, date) TO authenticated, service_role;

-- ---------- 8. SEED REAL ----------
DO $do$
DECLARE
  v_org uuid; v_company uuid; v_bu uuid; v_plan uuid;
BEGIN
  SELECT bu.organization_id, bu.company_id, bu.id INTO v_org, v_company, v_bu
    FROM public.business_units bu WHERE bu.slug = 'filial-rm-mineracao' LIMIT 1;
  IF v_bu IS NULL THEN RAISE EXCEPTION 'unidade Filial RM Mineracao nao encontrada'; END IF;

  SELECT id INTO v_plan FROM public.strategic_plans
   WHERE business_unit_id = v_bu AND cycle_start = DATE '2026-01-01' AND cycle_end = DATE '2027-12-31';

  IF v_plan IS NULL THEN
    INSERT INTO public.strategic_plans
      (organization_id, company_id, business_unit_id, title, cycle_start, cycle_end, status)
    VALUES
      (v_org, v_company, v_bu, 'Planejamento Estratégico RM Mineração 2026–2027',
       DATE '2026-01-01', DATE '2027-12-31', 'draft')
    RETURNING id INTO v_plan;
  END IF;

  INSERT INTO public.strategic_pillars (organization_id, business_unit_id, plan_id, title, sort_order)
  SELECT v_org, v_bu, v_plan, x.title, x.ord
    FROM (VALUES
      ('Gestão Administrativa & Financeira', 1),
      ('Gestão Comercial & Relacionamento', 2),
      ('Gestão Produtiva, Lavra & Manutenção', 3),
      ('Gestão de Pessoas, Tecnologia & Suporte', 4)
    ) AS x(title, ord)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.strategic_pillars p WHERE p.plan_id = v_plan AND p.title = x.title
   );

  INSERT INTO public.routine_templates
    (organization_id, company_id, business_unit_id, name, frequency, status)
  SELECT v_org, v_company, v_bu, x.name, x.freq, 'draft'
    FROM (VALUES
      ('Diário — Check de produção',        'daily'),
      ('Semanal — Comercial & Produção',    'weekly'),
      ('Quinzenal — Financeiro',            'biweekly'),
      ('Mensal — Comitê de Resultados',     'monthly'),
      ('Trimestral — Revisão COPA',         'quarterly')
    ) AS x(name, freq)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.routine_templates rt WHERE rt.business_unit_id = v_bu AND rt.name = x.name
   );
END $do$;