-- M0 v1.1 · correcao: recursao de RLS em public.scopes (policies de escrita)
-- As policies scopes_insert/scopes_update liam public.scopes inline, reentrando
-- na propria RLS. Passam a usar helper SECURITY DEFINER, mesmo padrao das demais.

CREATE OR REPLACE FUNCTION public.organization_root_scope_id(p_org uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT s.id
    FROM public.scopes s
   WHERE s.organization_id = p_org
     AND s.scope_type = 'organization'
   LIMIT 1
$fn$;

REVOKE ALL ON FUNCTION public.organization_root_scope_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organization_root_scope_id(uuid) TO authenticated;

DROP POLICY scopes_insert ON public.scopes;
DROP POLICY scopes_update ON public.scopes;

CREATE POLICY scopes_insert ON public.scopes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('organization.manage', 'organization',
         public.organization_root_scope_id(scopes.organization_id)));

CREATE POLICY scopes_update ON public.scopes
  FOR UPDATE TO authenticated
  USING (public.has_permission('organization.manage', 'organization',
         public.organization_root_scope_id(scopes.organization_id)))
  WITH CHECK (public.has_permission('organization.manage', 'organization',
         public.organization_root_scope_id(scopes.organization_id)));

DO $chk$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM pg_policies WHERE schemaname='public';
  IF v <> 20 THEN RAISE EXCEPTION 'esperado 20 policies, obtido %', v; END IF;
  SELECT count(*) INTO v FROM pg_policies WHERE schemaname='public' AND 'anon' = ANY (roles);
  IF v <> 0 THEN RAISE EXCEPTION 'policy para anon detectada'; END IF;
END
$chk$;