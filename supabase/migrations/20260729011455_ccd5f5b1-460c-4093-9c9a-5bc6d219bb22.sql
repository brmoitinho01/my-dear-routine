-- M0 v1.1 · correcao de grants: alinhar a matriz minima aprovada.
-- Nao cria, altera ou remove objetos. Somente privilegios.

REVOKE ALL ON public.scope_types, public.organizations, public.users,
              public.permissions, public.roles, public.role_permissions,
              public.scopes, public.user_role_assignments, public.audit_events
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON public.scope_types            TO authenticated;
GRANT SELECT ON public.permissions            TO authenticated;
GRANT SELECT, UPDATE ON public.organizations  TO authenticated;
GRANT SELECT, UPDATE ON public.users          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.roles  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scopes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_role_assignments TO authenticated;
GRANT SELECT, INSERT ON public.audit_events   TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.users        TO service_role;
GRANT SELECT, INSERT ON public.audit_events         TO service_role;
GRANT SELECT ON public.organizations, public.roles, public.permissions,
                public.role_permissions, public.scopes, public.scope_types,
                public.user_role_assignments TO service_role;

DO $chk$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee IN ('anon','PUBLIC');
  IF v <> 0 THEN RAISE EXCEPTION 'grants residuais para anon/PUBLIC: %', v; END IF;

  IF has_table_privilege('authenticated','public.audit_events','UPDATE')
     OR has_table_privilege('authenticated','public.audit_events','DELETE') THEN
    RAISE EXCEPTION 'audit_events ainda editavel por authenticated';
  END IF;

  SELECT count(*) INTO v
    FROM information_schema.role_table_grants
   WHERE table_schema='public' AND grantee='authenticated' AND privilege_type='DELETE';
  IF v <> 0 THEN RAISE EXCEPTION 'DELETE residual para authenticated: %', v; END IF;
END
$chk$;