DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['strategic_plans','strategic_pillars','strategic_objectives','strategic_risks','kpis','kpi_measurements','action_plans','routine_templates','routine_executions']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.f2_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f2_audit() FROM anon;
REVOKE ALL ON FUNCTION public.f2_audit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.f2_audit() TO service_role;

REVOKE ALL ON FUNCTION public.f2_bu_scope_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f2_bu_scope_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.f2_bu_scope_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f2_bu_scope_id(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.f2_generate_routine_executions(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f2_generate_routine_executions(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.f2_generate_routine_executions(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f2_generate_routine_executions(uuid, date) TO service_role;