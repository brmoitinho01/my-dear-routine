-- F8.1-A — escolhas estruturadas do direcionamento estratégico.
-- Aditivo e idempotente. Nenhum dado é criado ou alterado.

CREATE TABLE IF NOT EXISTS public.plan_direction_choices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  focus_groups text[] NOT NULL DEFAULT '{}',
  value_propositions text[] NOT NULL DEFAULT '{}',
  competitive_edges text[] NOT NULL DEFAULT '{}',
  ambition text NULL,
  value_codes text[] NOT NULL DEFAULT '{}',
  priority_dimension text NULL,
  custom_focus text NULL,
  custom_value_proposition text NULL,
  custom_competitive_edge text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT plan_direction_choices_plan_unique UNIQUE (plan_id),
  CONSTRAINT plan_direction_choices_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units (id, organization_id),
  CONSTRAINT plan_direction_choices_plan_fk
    FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans (id, organization_id),
  CONSTRAINT plan_direction_choices_focus_max CHECK (coalesce(array_length(focus_groups, 1), 0) <= 3),
  CONSTRAINT plan_direction_choices_value_max CHECK (coalesce(array_length(value_propositions, 1), 0) <= 3),
  CONSTRAINT plan_direction_choices_edge_max CHECK (coalesce(array_length(competitive_edges, 1), 0) <= 2),
  CONSTRAINT plan_direction_choices_values_max CHECK (coalesce(array_length(value_codes, 1), 0) <= 5),
  CONSTRAINT plan_direction_choices_priority_dim CHECK (
    priority_dimension IS NULL
    OR priority_dimension IN ('finance','marketing_sales','operations','people','governance')
  )
);

CREATE INDEX IF NOT EXISTS plan_direction_choices_bu_idx
  ON public.plan_direction_choices (business_unit_id);

GRANT SELECT, INSERT, UPDATE ON public.plan_direction_choices TO authenticated;
GRANT ALL ON public.plan_direction_choices TO service_role;
REVOKE ALL ON public.plan_direction_choices FROM anon;

ALTER TABLE public.plan_direction_choices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_direction_choices_select" ON public.plan_direction_choices;
CREATE POLICY "plan_direction_choices_select"
  ON public.plan_direction_choices FOR SELECT TO authenticated
  USING (
    public.has_permission('strategy.read'::public.citext, 'business_unit',
      public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS "plan_direction_choices_insert" ON public.plan_direction_choices;
CREATE POLICY "plan_direction_choices_insert"
  ON public.plan_direction_choices FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('strategy.manage'::public.citext, 'business_unit',
      public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS "plan_direction_choices_update" ON public.plan_direction_choices;
CREATE POLICY "plan_direction_choices_update"
  ON public.plan_direction_choices FOR UPDATE TO authenticated
  USING (
    public.has_permission('strategy.manage'::public.citext, 'business_unit',
      public.f2_bu_scope_id(business_unit_id))
  )
  WITH CHECK (
    public.has_permission('strategy.manage'::public.citext, 'business_unit',
      public.f2_bu_scope_id(business_unit_id))
  );

DROP TRIGGER IF EXISTS trg_plan_direction_choices_touch ON public.plan_direction_choices;
CREATE TRIGGER trg_plan_direction_choices_touch
  BEFORE UPDATE ON public.plan_direction_choices
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS trg_plan_direction_choices_audit ON public.plan_direction_choices;
CREATE TRIGGER trg_plan_direction_choices_audit
  AFTER INSERT OR UPDATE ON public.plan_direction_choices
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();