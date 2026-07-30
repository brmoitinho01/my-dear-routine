REVOKE ALL ON FUNCTION public.f1_entity_scope_id(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f1_sync_entity_scope() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f1_touch_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f1_entity_scope_id(text, uuid) TO authenticated, service_role;