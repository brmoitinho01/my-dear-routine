-- ============================================================
-- GMOS F7 — RBAC real, experiências por perfil e governança
-- Aditivo e idempotente. Não altera migrations anteriores.
-- ============================================================

-- ---------- 1. Permissões novas (reaproveita as 17 existentes) ----------
INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
SELECT v.code::citext, v.description, v.domain, v.scope_types, v.risk, true
FROM (VALUES
  ('dashboard.personal', 'Acessar o painel pessoal (meu trabalho)', 'dashboard',
     ARRAY['organization','company','business_unit','department'], 'low'),
  ('dashboard.team', 'Acessar o painel da equipe no escopo atribuído', 'dashboard',
     ARRAY['organization','company','business_unit','department'], 'low'),
  ('dashboard.group', 'Acessar o painel corporativo do Grupo', 'dashboard',
     ARRAY['organization'], 'low'),
  ('routine.execute_own', 'Registrar execução de rotina atribuída a si', 'routine',
     ARRAY['organization','company','business_unit','department'], 'low'),
  ('action.update_own', 'Atualizar plano de ação atribuído a si', 'action',
     ARRAY['organization','company','business_unit','department'], 'low'),
  ('kpi.validate', 'Validar medições de indicadores no escopo', 'strategy',
     ARRAY['organization','company','business_unit'], 'medium')
) AS v(code, description, domain, scope_types, risk)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.code = v.code::citext);

-- ---------- 2. Papéis novos (roles.code é citext, sem enum) ----------
INSERT INTO public.roles (organization_id, code, name, description, status, is_system)
SELECT o.id, v.code::citext, v.name, v.description, 'active', true
FROM public.organizations o
CROSS JOIN (VALUES
  ('group_owner',  'Proprietário do Grupo', 'Visão integral e governança de papéis do Grupo'),
  ('manager',      'Gestor',                'Gestão de estratégia, ações e rotinas no escopo atribuído e descendentes'),
  ('collaborator', 'Colaborador',           'Leitura mínima e execução das rotinas e ações atribuídas')
) AS v(code, name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.organization_id = o.id AND r.code = v.code::citext
);

-- ---------- 3. Matriz papel × permissão ----------
-- group_owner: todas as permissões
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'group_owner'::citext
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- demais papéis (group_admin apenas ganha, nunca perde)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
  ('group_admin','dashboard.group'), ('group_admin','dashboard.team'),
  ('group_admin','dashboard.personal'), ('group_admin','kpi.validate'),
  ('group_admin','routine.execute_own'), ('group_admin','action.update_own'),

  ('manager','organization.read'), ('manager','structure.read'), ('manager','user.read'),
  ('manager','role.read'),
  ('manager','strategy.read'), ('manager','strategy.manage'), ('manager','kpi.validate'),
  ('manager','action.read'), ('manager','action.manage'), ('manager','action.update_own'),
  ('manager','routine.read'), ('manager','routine.manage'), ('manager','routine.execute_own'),
  ('manager','dashboard.personal'), ('manager','dashboard.team'),

  ('collaborator','organization.read'), ('collaborator','structure.read'),
  ('collaborator','routine.read'), ('collaborator','routine.execute_own'),
  ('collaborator','action.read'), ('collaborator','action.update_own'),
  ('collaborator','dashboard.personal')
) AS m(role_code, perm_code)
JOIN public.roles r ON r.code = m.role_code::citext
JOIN public.permissions p ON p.code = m.perm_code::citext
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ---------- 4. Funções auxiliares reutilizáveis ----------
-- Papel ativo do usuário atual em qualquer escopo (uso em UI/validação, nunca substitui has_permission)
CREATE OR REPLACE FUNCTION public.gmos_has_active_role(p_code citext)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_role_assignments a
      JOIN public.users u ON u.id = a.user_id
      JOIN public.roles r ON r.id = a.role_id
     WHERE u.auth_user_id = auth.uid()
       AND u.status = 'active'
       AND a.status = 'active'
       AND r.status = 'active'
       AND r.code = p_code
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
  )
$$;

-- Proprietário/administrador do Grupo no nível da organização
CREATE OR REPLACE FUNCTION public.gmos_is_group_privileged()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_role_assignments a
      JOIN public.users u  ON u.id = a.user_id
      JOIN public.roles r  ON r.id = a.role_id
      JOIN public.scopes s ON s.id = a.scope_id
     WHERE u.auth_user_id = auth.uid()
       AND u.status = 'active'
       AND a.status = 'active'
       AND r.status = 'active'
       AND s.scope_type = 'organization'
       AND r.code IN ('group_owner'::public.citext, 'group_admin'::public.citext)
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
  )
$$;

-- Registro próprio (responsável)
CREATE OR REPLACE FUNCTION public.gmos_is_own_record(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT p_user_id IS NOT NULL AND p_user_id = public.current_user_id()
$$;

-- Empresa visível quando o usuário tem leitura de estrutura em alguma filial dela
CREATE OR REPLACE FUNCTION public.gmos_company_visible_by_unit(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.business_units bu
     WHERE bu.company_id = p_company_id
       AND public.has_permission(
             'structure.read'::public.citext, 'business_unit',
             public.f1_entity_scope_id('public.business_units', bu.id))
  )
$$;

-- Modelo de rotina atribuído ao usuário atual (direto ou via execução)
CREATE OR REPLACE FUNCTION public.gmos_template_assigned_to_me(p_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.routine_templates t
     WHERE t.id = p_template_id AND t.owner_user_id = public.current_user_id()
  ) OR EXISTS (
    SELECT 1 FROM public.routine_executions e
     WHERE e.template_id = p_template_id AND e.owner_user_id = public.current_user_id()
  )
$$;

-- Pessoa visível: eu mesmo, ou alguém com atribuição em escopo onde eu tenho user.read
CREATE OR REPLACE FUNCTION public.gmos_user_visible(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT p_user_id = public.current_user_id() OR EXISTS (
    SELECT 1
      FROM public.user_role_assignments a
      JOIN public.scopes s ON s.id = a.scope_id
     WHERE a.user_id = p_user_id
       AND a.status = 'active'
       AND public.has_permission('user.read'::public.citext, s.scope_type, s.id)
  )
$$;

REVOKE ALL ON FUNCTION public.gmos_has_active_role(citext) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gmos_is_group_privileged() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gmos_is_own_record(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gmos_company_visible_by_unit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gmos_template_assigned_to_me(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gmos_user_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gmos_has_active_role(citext) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gmos_is_group_privileged() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gmos_is_own_record(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gmos_company_visible_by_unit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gmos_template_assigned_to_me(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gmos_user_visible(uuid) TO authenticated, service_role;

-- ---------- 5. Policies aditivas (nenhuma baseada só em auth.uid() not null) ----------
DROP POLICY IF EXISTS companies_select_context ON public.companies;
CREATE POLICY companies_select_context ON public.companies
  FOR SELECT TO authenticated
  USING (public.gmos_company_visible_by_unit(id));

DROP POLICY IF EXISTS routine_templates_select_assigned ON public.routine_templates;
CREATE POLICY routine_templates_select_assigned ON public.routine_templates
  FOR SELECT TO authenticated
  USING (
    public.gmos_template_assigned_to_me(id)
    AND public.has_permission('routine.execute_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS routine_executions_select_own ON public.routine_executions;
CREATE POLICY routine_executions_select_own ON public.routine_executions
  FOR SELECT TO authenticated
  USING (
    public.gmos_is_own_record(owner_user_id)
    AND public.has_permission('routine.execute_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS routine_executions_update_own ON public.routine_executions;
CREATE POLICY routine_executions_update_own ON public.routine_executions
  FOR UPDATE TO authenticated
  USING (
    public.gmos_is_own_record(owner_user_id)
    AND public.has_permission('routine.execute_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  )
  WITH CHECK (
    public.gmos_is_own_record(owner_user_id)
    AND public.has_permission('routine.execute_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS action_plans_select_own ON public.action_plans;
CREATE POLICY action_plans_select_own ON public.action_plans
  FOR SELECT TO authenticated
  USING (
    public.gmos_is_own_record(owner_user_id)
    AND public.has_permission('action.update_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS action_plans_update_own ON public.action_plans;
CREATE POLICY action_plans_update_own ON public.action_plans
  FOR UPDATE TO authenticated
  USING (
    public.gmos_is_own_record(owner_user_id)
    AND public.has_permission('action.update_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  )
  WITH CHECK (
    public.gmos_is_own_record(owner_user_id)
    AND public.has_permission('action.update_own'::public.citext, 'business_unit',
          public.f2_bu_scope_id(business_unit_id))
  );

DROP POLICY IF EXISTS users_select_team ON public.users;
CREATE POLICY users_select_team ON public.users
  FOR SELECT TO authenticated
  USING (public.gmos_user_visible(id));

-- ---------- 6. Integridade das atribuições ----------
CREATE UNIQUE INDEX IF NOT EXISTS ura_unique_active_assignment
  ON public.user_role_assignments (user_id, role_id, scope_id)
  WHERE status IN ('active', 'pending');

-- ---------- 7. Atribuição inicial: Brenno como proprietário do Grupo ----------
INSERT INTO public.user_role_assignments
  (organization_id, user_id, role_id, scope_id, status, assigned_by, justification)
SELECT u.organization_id, u.id, r.id, s.id, 'active', u.id,
       'F7: proprietário do Grupo Moitinho (mantém group_admin durante a transição).'
  FROM public.users u
  JOIN auth.users au ON au.id = u.auth_user_id
  JOIN public.roles r ON r.organization_id = u.organization_id AND r.code = 'group_owner'::citext
  JOIN public.scopes s ON s.organization_id = u.organization_id AND s.scope_type = 'organization'
 WHERE lower(au.email) = 'brmoitinho@yahoo.com.br'
   AND NOT EXISTS (
     SELECT 1 FROM public.user_role_assignments a
      WHERE a.user_id = u.id AND a.role_id = r.id AND a.scope_id = s.id
        AND a.status IN ('active','pending')
   );

-- ---------- 8. Operações seguras de papéis (validação no banco) ----------
CREATE OR REPLACE FUNCTION public.gmos_assign_role(
  p_user_id uuid, p_role_code citext, p_scope_id uuid, p_justification text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_actor uuid := public.current_user_id();
  v_scope record;
  v_role  record;
  v_id    uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF p_justification IS NULL OR length(btrim(p_justification)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres).';
  END IF;
  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Não é permitido atribuir papéis a si mesmo.';
  END IF;

  SELECT * INTO v_scope FROM public.scopes WHERE id = p_scope_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Escopo inexistente ou inativo.'; END IF;

  SELECT * INTO v_role FROM public.roles
   WHERE organization_id = v_scope.organization_id AND code = p_role_code AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Papel inexistente ou inativo nesta organização.'; END IF;

  IF NOT public.has_permission('role.assign'::public.citext, v_scope.scope_type, p_scope_id) THEN
    RAISE EXCEPTION 'Permissão negada para atribuir papéis neste escopo.';
  END IF;

  -- compatibilidade papel × tipo de escopo
  IF v_role.code IN ('group_owner'::public.citext, 'group_admin'::public.citext) THEN
    IF v_scope.scope_type <> 'organization' THEN
      RAISE EXCEPTION 'Papéis de Grupo só podem ser atribuídos no escopo da organização.';
    END IF;
    IF NOT public.gmos_is_group_privileged() THEN
      RAISE EXCEPTION 'Somente proprietário ou administrador do Grupo pode conceder papéis de Grupo.';
    END IF;
  ELSIF v_role.code IN ('manager'::public.citext, 'collaborator'::public.citext) THEN
    IF v_scope.scope_type NOT IN ('company','business_unit','department') THEN
      RAISE EXCEPTION 'Gestor e colaborador devem ser atribuídos em empresa, filial ou área.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_role_assignments a
     WHERE a.user_id = p_user_id AND a.role_id = v_role.id AND a.scope_id = p_scope_id
       AND a.status IN ('active','pending')
  ) THEN
    RAISE EXCEPTION 'Este usuário já possui esta atribuição ativa neste escopo.';
  END IF;

  INSERT INTO public.user_role_assignments
    (organization_id, user_id, role_id, scope_id, status, assigned_by, justification)
  VALUES (v_scope.organization_id, p_user_id, v_role.id, p_scope_id, 'active', v_actor, btrim(p_justification))
  RETURNING id INTO v_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (v_scope.organization_id, v_actor, 'iam.role.assigned', 'public.user_role_assignments',
          v_id, 'create', 'app',
          jsonb_build_object('role_code', v_role.code::text, 'scope_type', v_scope.scope_type,
                             'scope_id', p_scope_id, 'target_user_id', p_user_id));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.gmos_revoke_role(
  p_assignment_id uuid, p_justification text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_actor uuid := public.current_user_id();
  v_a record;
  v_scope record;
  v_role record;
  v_owners integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF p_justification IS NULL OR length(btrim(p_justification)) < 10 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres).';
  END IF;

  SELECT * INTO v_a FROM public.user_role_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atribuição inexistente.'; END IF;
  IF v_a.status <> 'active' AND v_a.status <> 'pending' THEN
    RAISE EXCEPTION 'Atribuição já encerrada.';
  END IF;
  IF v_a.user_id = v_actor THEN
    RAISE EXCEPTION 'Não é permitido revogar o próprio acesso.';
  END IF;

  SELECT * INTO v_scope FROM public.scopes WHERE id = v_a.scope_id;
  SELECT * INTO v_role  FROM public.roles  WHERE id = v_a.role_id;

  IF NOT public.has_permission('role.revoke'::public.citext, v_scope.scope_type, v_a.scope_id) THEN
    RAISE EXCEPTION 'Permissão negada para revogar papéis neste escopo.';
  END IF;

  IF v_role.code IN ('group_owner'::public.citext, 'group_admin'::public.citext)
     AND NOT public.gmos_is_group_privileged() THEN
    RAISE EXCEPTION 'Somente proprietário ou administrador do Grupo pode revogar papéis de Grupo.';
  END IF;

  IF v_role.code = 'group_owner'::public.citext THEN
    SELECT count(*) INTO v_owners
      FROM public.user_role_assignments a
      JOIN public.roles r ON r.id = a.role_id
      JOIN public.scopes s ON s.id = a.scope_id
     WHERE r.code = 'group_owner'::public.citext
       AND s.organization_id = v_a.organization_id
       AND s.scope_type = 'organization'
       AND a.status = 'active';
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'Não é possível revogar o último proprietário ativo do Grupo.';
    END IF;
  END IF;

  UPDATE public.user_role_assignments
     SET status = 'revoked', revoked_at = now(), revoked_by = v_actor,
         effective_to = now(),
         justification = btrim(p_justification)
   WHERE id = p_assignment_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (v_a.organization_id, v_actor, 'iam.role.revoked', 'public.user_role_assignments',
          p_assignment_id, 'revoke', 'app',
          jsonb_build_object('role_code', v_role.code::text, 'scope_type', v_scope.scope_type,
                             'scope_id', v_a.scope_id, 'target_user_id', v_a.user_id));
END $$;

REVOKE ALL ON FUNCTION public.gmos_assign_role(uuid, citext, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gmos_revoke_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gmos_assign_role(uuid, citext, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gmos_revoke_role(uuid, text) TO authenticated, service_role;