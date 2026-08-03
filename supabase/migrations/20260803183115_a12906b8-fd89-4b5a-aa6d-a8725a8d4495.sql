-- ============================================================
-- GMOS F7-A — Fundação de papéis (aditiva, idempotente, reversível)
-- Não remove papéis, permissões, mapeamentos, atribuições ou policies.
-- Não altera frontend, rotas, painéis ou RLS.
-- ============================================================
DO $f7a$
DECLARE
  v_org        uuid;
  v_org_scope  uuid;
  v_user       uuid;
  v_role       uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'grupo-moitinho' LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'F7-A: organizacao grupo-moitinho inexistente';
  END IF;

  -- 1) Papéis (preserva group_admin; code é citext, não há enum a estender)
  INSERT INTO public.roles (organization_id, code, name, description, status, is_system)
  VALUES
    (v_org, 'group_owner',  'Proprietário do Grupo',   'Acesso completo ao Grupo, incluindo governança de acessos.', 'active', true),
    (v_org, 'group_admin',  'Administrador do Grupo',  'Administra estrutura, estratégia, rotinas e acessos do Grupo.', 'active', true),
    (v_org, 'manager',      'Gestor',                  'Gerencia estratégia, ações e rotinas no próprio escopo e descendentes.', 'active', true),
    (v_org, 'collaborator', 'Colaborador',             'Executa e acompanha apenas o que é próprio ou atribuído a ele.', 'active', true)
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- 2) Permissões requeridas (padrão real de códigos do projeto; reaproveita as existentes)
  INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
  VALUES
    ('dashboard.personal',  'Ler painel pessoal',                    'dashboard', ARRAY['organization','company','business_unit','department'], 'low',    true),
    ('dashboard.team',      'Ler painel de equipe',                  'dashboard', ARRAY['organization','company','business_unit','department'], 'low',    true),
    ('dashboard.group',     'Ler painel do Grupo',                   'dashboard', ARRAY['organization'],                                       'medium', true),
    ('routine.execute_own', 'Executar rotinas próprias',             'routine',   ARRAY['organization','company','business_unit','department'], 'low',    true),
    ('routine.manage',      'Gerir rotinas no escopo',               'routine',   ARRAY['organization','company','business_unit'],              'medium', true),
    ('role.manage',         'Gerir atribuições de papéis',           'iam',       ARRAY['organization'],                                       'high',   true)
  ON CONFLICT (code) DO NOTHING;

  -- 3) group_owner: todas as permissões
  SELECT id INTO v_role FROM public.roles WHERE organization_id = v_org AND code = 'group_owner';
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role, p.id FROM public.permissions p
   WHERE NOT EXISTS (
     SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = v_role AND rp.permission_id = p.id
   );

  -- 4) group_admin: mantém tudo o que já tem e recebe as administrativas compatíveis
  SELECT id INTO v_role FROM public.roles WHERE organization_id = v_org AND code = 'group_admin';
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role, p.id FROM public.permissions p
   WHERE NOT EXISTS (
     SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = v_role AND rp.permission_id = p.id
   );

  -- 5) manager: estratégia, ações, rotinas, painel de equipe/pessoal; sem IAM global
  SELECT id INTO v_role FROM public.roles WHERE organization_id = v_org AND code = 'manager';
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role, p.id FROM public.permissions p
   WHERE p.code::text IN (
     'organization.read','structure.read',
     'strategy.read','strategy.manage','kpi.validate',
     'action.read','action.manage','action.update_own',
     'routine.read','routine.manage','routine.execute_own',
     'dashboard.team','dashboard.personal',
     'user.read','role.read'
   )
     AND NOT EXISTS (
       SELECT 1 FROM public.role_permissions rp
        WHERE rp.role_id = v_role AND rp.permission_id = p.id
     );

  -- 6) collaborator: leitura mínima, painel pessoal, execução própria
  SELECT id INTO v_role FROM public.roles WHERE organization_id = v_org AND code = 'collaborator';
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role, p.id FROM public.permissions p
   WHERE p.code::text IN (
     'organization.read','structure.read',
     'action.read','action.update_own',
     'routine.read','routine.execute_own',
     'dashboard.personal'
   )
     AND NOT EXISTS (
       SELECT 1 FROM public.role_permissions rp
        WHERE rp.role_id = v_role AND rp.permission_id = p.id
     );

  -- 7) Atribuição de group_owner ao usuário interno de brmoitinho@yahoo.com.br
  SELECT id INTO v_org_scope FROM public.scopes
   WHERE organization_id = v_org AND scope_type = 'organization' LIMIT 1;
  SELECT u.id INTO v_user FROM public.users u
    JOIN auth.users au ON au.id = u.auth_user_id
   WHERE lower(au.email) = 'brmoitinho@yahoo.com.br' LIMIT 1;
  SELECT id INTO v_role FROM public.roles WHERE organization_id = v_org AND code = 'group_owner';

  IF v_user IS NOT NULL AND v_org_scope IS NOT NULL THEN
    INSERT INTO public.user_role_assignments
      (organization_id, user_id, role_id, scope_id, status, justification)
    SELECT v_org, v_user, v_role, v_org_scope, 'active',
           'F7-A: fundacao de papeis GMOS, proprietario do Grupo definido conforme autorizacao registrada.'
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_role_assignments a
        WHERE a.user_id = v_user AND a.role_id = v_role AND a.scope_id = v_org_scope
          AND a.status IN ('active','pending')
     );
  END IF;
END $f7a$;

-- 8) Proteção contra atribuição ativa duplicada (usuário + papel + escopo)
CREATE UNIQUE INDEX IF NOT EXISTS ura_unique_active_assignment
  ON public.user_role_assignments (user_id, role_id, scope_id)
  WHERE status IN ('active','pending');
