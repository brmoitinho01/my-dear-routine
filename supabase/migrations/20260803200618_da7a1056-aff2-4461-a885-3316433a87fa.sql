REVOKE ALL ON TABLE public.strategic_initiatives FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.strategic_initiatives TO authenticated;
GRANT ALL ON TABLE public.strategic_initiatives TO service_role;
REVOKE EXECUTE ON FUNCTION public.f9_initiative_readiness(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f9_submit_initiative_for_review(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f9_approve_initiative(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f9_activate_initiative(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f9_derive_action_plan(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.f9_initiative_guard() FROM anon, authenticated;