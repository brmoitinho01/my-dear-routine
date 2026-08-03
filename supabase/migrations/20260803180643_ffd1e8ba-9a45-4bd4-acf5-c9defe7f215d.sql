CREATE OR REPLACE FUNCTION public.gmos_my_authorization()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  WITH me AS (
    SELECT u.id, u.status, u.organization_id, u.preferred_locale
      FROM public.users u
     WHERE u.auth_user_id = auth.uid()
     LIMIT 1
  ), asg AS (
    SELECT a.id AS assignment_id, r.code::text AS role_code, r.name AS role_name,
           a.status, a.effective_from, a.effective_to,
           s.id AS scope_id, s.scope_type, s.label AS scope_label, s.organization_id,
           COALESCE((
             SELECT jsonb_agg(DISTINCT pm.code::text)
               FROM public.role_permissions rp
               JOIN public.permissions pm ON pm.id = rp.permission_id
              WHERE rp.role_id = r.id
                AND rp.effective_from <= now()
                AND (rp.effective_to IS NULL OR rp.effective_to > now())
                AND (pm.effective_to IS NULL OR pm.effective_to > now())
           ), '[]'::jsonb) AS permissions
      FROM public.user_role_assignments a
      JOIN me ON me.id = a.user_id
      JOIN public.roles r  ON r.id = a.role_id AND r.status = 'active'
      JOIN public.scopes s ON s.id = a.scope_id
     WHERE a.status = 'active'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
  ), sc AS (
    SELECT s.id, s.parent_scope_id, s.scope_type, s.label, s.organization_id,
           s.target_table, s.target_id, s.status
      FROM public.scopes s
     WHERE s.organization_id IN (SELECT DISTINCT organization_id FROM asg)
  )
  SELECT jsonb_build_object(
    'userId', (SELECT id FROM me),
    'userStatus', (SELECT status FROM me),
    'organizationId', (SELECT organization_id FROM me),
    'assignments', COALESCE((SELECT jsonb_agg(to_jsonb(asg) ORDER BY asg.role_code) FROM asg), '[]'::jsonb),
    'scopes', COALESCE((SELECT jsonb_agg(to_jsonb(sc)) FROM sc), '[]'::jsonb)
  )
$$;

REVOKE ALL ON FUNCTION public.gmos_my_authorization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gmos_my_authorization() TO authenticated, service_role;