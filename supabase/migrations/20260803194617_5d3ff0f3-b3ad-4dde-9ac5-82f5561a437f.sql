REVOKE ALL ON FUNCTION public.f85_position_cycle_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.f85_headcount_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.f85_can(uuid, citext) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f85_can(uuid, citext) TO authenticated;