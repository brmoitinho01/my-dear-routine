REVOKE EXECUTE ON FUNCTION public.f8_plan_completeness(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f8_plan_completeness_core(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f8_submit_plan_for_review(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f8_approve_plan(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f8_activate_plan(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.f8_plan_review_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.f8_diagnostic_review_guard() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.f8_plan_completeness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f8_plan_completeness_core(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f8_submit_plan_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f8_approve_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f8_activate_plan(uuid) TO authenticated;