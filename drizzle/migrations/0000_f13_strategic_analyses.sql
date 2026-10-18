CREATE TABLE IF NOT EXISTS public.strategic_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id),
  plan_id uuid NOT NULL REFERENCES public.strategic_plans(id),
  tool_code text NOT NULL CHECK (tool_code IN ('pest','porter','atratividade','ciclo_vida','fcs','competencias','estrategias')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  conclusion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT public.current_user_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (plan_id, tool_code)
);

GRANT SELECT, INSERT, UPDATE ON public.strategic_analyses TO authenticated;
GRANT ALL ON public.strategic_analyses TO service_role;

ALTER TABLE public.strategic_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategic_analyses_select ON public.strategic_analyses;
CREATE POLICY strategic_analyses_select ON public.strategic_analyses FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::citext, 'business_unit', public.f2_bu_scope_id(business_unit_id)));
DROP POLICY IF EXISTS strategic_analyses_insert ON public.strategic_analyses;
CREATE POLICY strategic_analyses_insert ON public.strategic_analyses FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::citext, 'business_unit', public.f2_bu_scope_id(business_unit_id))
    AND EXISTS (SELECT 1 FROM public.strategic_plans p WHERE p.id = plan_id AND p.business_unit_id = strategic_analyses.business_unit_id AND p.organization_id = strategic_analyses.organization_id));
DROP POLICY IF EXISTS strategic_analyses_update ON public.strategic_analyses;
CREATE POLICY strategic_analyses_update ON public.strategic_analyses FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::citext, 'business_unit', public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::citext, 'business_unit', public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS strategic_analyses_touch ON public.strategic_analyses;
CREATE TRIGGER strategic_analyses_touch BEFORE UPDATE ON public.strategic_analyses FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();
DROP TRIGGER IF EXISTS strategic_analyses_audit ON public.strategic_analyses;
CREATE TRIGGER strategic_analyses_audit AFTER INSERT OR UPDATE ON public.strategic_analyses FOR EACH ROW EXECUTE FUNCTION public.f2_audit();