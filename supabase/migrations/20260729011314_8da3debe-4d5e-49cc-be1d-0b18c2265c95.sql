-- =====================================================================
-- GMOS · M0 — FUNDACAO TECNICA, RBAC, ESCOPOS E AUDITORIA
-- Arquivo: M0_APPLY_v1.1.sql
-- Baseline exigido: SEC-00 Greenfield v1.2 concluido.
-- NAO cria modulo de negocio. NAO altera auth.users (apenas o objeto
-- trigger definido sobre ela). Sem CASCADE. Sem placeholders.
-- =====================================================================

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------
-- 0. PRE-CONDICOES (baseline pos-SEC-00)
-- ---------------------------------------------------------------------
DO $pre$
DECLARE
  v_tables int;
  v_views  int;
  v_types  int;
  v_pol    int;
  v_func   int;
  v_users  int;
BEGIN
  SELECT count(*) INTO v_tables
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r';
  SELECT count(*) INTO v_views
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('v','m');
  SELECT count(*) INTO v_types
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname = 'public' AND t.typtype = 'e';
  SELECT count(*) INTO v_pol
    FROM pg_policies WHERE schemaname = 'public';
  SELECT count(*) INTO v_func
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public';
  SELECT count(*) INTO v_users FROM auth.users;

  IF v_tables <> 0 THEN RAISE EXCEPTION 'ABORT: public possui % tabelas (esperado 0)', v_tables; END IF;
  IF v_views  <> 0 THEN RAISE EXCEPTION 'ABORT: public possui % views (esperado 0)', v_views; END IF;
  IF v_types  <> 0 THEN RAISE EXCEPTION 'ABORT: public possui % enums (esperado 0)', v_types; END IF;
  IF v_pol    <> 0 THEN RAISE EXCEPTION 'ABORT: public possui % policies (esperado 0)', v_pol; END IF;
  IF v_func   <> 1 THEN RAISE EXCEPTION 'ABORT: public possui % funcoes (esperado 1: handle_new_user_noop)', v_func; END IF;
  IF v_users  <> 2 THEN RAISE EXCEPTION 'ABORT: auth.users possui % registros (esperado 2)', v_users; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname='public' AND p.proname='handle_new_user_noop') THEN
    RAISE EXCEPTION 'ABORT: handle_new_user_noop ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'ABORT: trigger on_auth_user_created ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'd70f1845-d2c2-42be-89a1-88e12efe81bb') THEN
    RAISE EXCEPTION 'ABORT: administrador nominal ausente em auth.users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'bc170fc0-1f36-43bf-a27f-a6275928776b') THEN
    RAISE EXCEPTION 'ABORT: segundo usuario ausente em auth.users';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------
-- A. EXTENSOES
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------
-- B. CATALOGOS TECNICOS
-- ---------------------------------------------------------------------
CREATE TABLE public.scope_types (
  code        text        NOT NULL,
  label       text        NOT NULL,
  sort_order  integer     NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scope_types_pkey PRIMARY KEY (code),
  CONSTRAINT scope_types_code_chk CHECK (code = lower(code) AND code <> '')
);
COMMENT ON TABLE public.scope_types IS 'M0: catalogo de tipos de escopo. Substitui enums rigidos.';

-- ---------------------------------------------------------------------
-- C. TABELAS DA FUNDACAO
-- ---------------------------------------------------------------------
CREATE TABLE public.organizations (
  id             uuid         NOT NULL DEFAULT gen_random_uuid(),
  name           text         NOT NULL,
  slug           public.citext NOT NULL,
  status         text         NOT NULL DEFAULT 'draft',
  timezone       text         NOT NULL DEFAULT 'America/Bahia',
  effective_from timestamptz  NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  updated_by     uuid,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_slug_uk UNIQUE (slug),
  CONSTRAINT organizations_status_chk CHECK (status IN ('draft','active','suspended','archived')),
  CONSTRAINT organizations_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT organizations_name_chk CHECK (btrim(name) <> '')
);

CREATE TABLE public.users (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id    uuid        NOT NULL,
  organization_id uuid,
  status          text        NOT NULL DEFAULT 'invited',
  preferred_locale text       NOT NULL DEFAULT 'pt-BR',
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_auth_user_id_uk UNIQUE (auth_user_id),
  CONSTRAINT users_auth_user_fk FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT users_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT users_status_chk CHECK (status IN ('invited','active','suspended','disabled')),
  CONSTRAINT users_locale_chk CHECK (preferred_locale IN ('pt-BR','en-US'))
);
COMMENT ON TABLE public.users IS 'M0: identidade interna da plataforma. Sem dados pessoais (people vira na M2).';

CREATE TABLE public.permissions (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid(),
  code                public.citext NOT NULL,
  description         text         NOT NULL,
  domain              text         NOT NULL,
  allowed_scope_types text[]       NOT NULL,
  risk                text         NOT NULL,
  is_system           boolean      NOT NULL DEFAULT true,
  effective_from      timestamptz  NOT NULL DEFAULT now(),
  effective_to        timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id),
  CONSTRAINT permissions_code_uk UNIQUE (code),
  CONSTRAINT permissions_risk_chk CHECK (risk IN ('low','medium','high','critical')),
  CONSTRAINT permissions_scopes_chk CHECK (array_length(allowed_scope_types, 1) >= 1),
  CONSTRAINT permissions_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE public.roles (
  id              uuid         NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL,
  code            public.citext NOT NULL,
  name            text         NOT NULL,
  description     text         NOT NULL DEFAULT '',
  status          text         NOT NULL DEFAULT 'draft',
  is_system       boolean      NOT NULL DEFAULT false,
  effective_from  timestamptz  NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  updated_by      uuid,
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_org_code_uk UNIQUE (organization_id, code),
  CONSTRAINT roles_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT roles_status_chk CHECK (status IN ('draft','active','deprecated','archived')),
  CONSTRAINT roles_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE public.role_permissions (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  role_id        uuid        NOT NULL,
  permission_id  uuid        NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_role_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT,
  CONSTRAINT role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE RESTRICT,
  CONSTRAINT role_permissions_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE public.scopes (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL,
  scope_type      text        NOT NULL,
  parent_scope_id uuid,
  target_table    text,
  target_id       uuid,
  label           text        NOT NULL,
  status          text        NOT NULL DEFAULT 'active',
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  CONSTRAINT scopes_pkey PRIMARY KEY (id),
  CONSTRAINT scopes_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT scopes_type_fk FOREIGN KEY (scope_type) REFERENCES public.scope_types(code) ON DELETE RESTRICT,
  CONSTRAINT scopes_parent_fk FOREIGN KEY (parent_scope_id) REFERENCES public.scopes(id) ON DELETE RESTRICT,
  CONSTRAINT scopes_status_chk CHECK (status IN ('active','suspended','archived')),
  CONSTRAINT scopes_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT scopes_parent_rule_chk CHECK (
    (scope_type = 'organization' AND parent_scope_id IS NULL)
    OR (scope_type <> 'organization' AND parent_scope_id IS NOT NULL)
  ),
  CONSTRAINT scopes_target_rule_chk CHECK (
    (target_table IS NULL AND target_id IS NULL)
    OR (target_table IS NOT NULL AND target_id IS NOT NULL)
  ),
  CONSTRAINT scopes_org_target_chk CHECK (
    scope_type <> 'organization'
    OR (target_table = 'public.organizations' AND target_id = organization_id)
  )
);
COMMENT ON TABLE public.scopes IS 'M0: entidade fisica unica de escopo. M1+ cria linhas com target_table/target_id apontando para entidades ja existentes, sempre com parent_scope_id.';

CREATE TABLE public.user_role_assignments (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL,
  user_id         uuid        NOT NULL,
  role_id         uuid        NOT NULL,
  scope_id        uuid        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending',
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  assigned_by     uuid,
  justification   text        NOT NULL,
  revoked_at      timestamptz,
  revoked_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT ura_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT ura_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT ura_role_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT,
  CONSTRAINT ura_scope_fk FOREIGN KEY (scope_id) REFERENCES public.scopes(id) ON DELETE RESTRICT,
  CONSTRAINT ura_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT ura_revoked_by_fk FOREIGN KEY (revoked_by) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT ura_status_chk CHECK (status IN ('pending','active','expired','revoked')),
  CONSTRAINT ura_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT ura_justification_chk CHECK (btrim(justification) <> ''),
  CONSTRAINT ura_revoked_chk CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    OR (status <> 'revoked' AND revoked_at IS NULL AND revoked_by IS NULL)
  )
);

CREATE TABLE public.audit_events (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  actor_user_id   uuid,
  event_type      text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       uuid,
  action          text        NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  correlation_id  uuid,
  request_id      text,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  source          text        NOT NULL,
  ip_address      inet,
  user_agent      text,
  CONSTRAINT audit_events_pkey PRIMARY KEY (id),
  CONSTRAINT audit_events_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT audit_events_actor_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT audit_events_action_chk CHECK (action IN ('create','update','delete','grant','revoke','login','logout','denied','provision')),
  CONSTRAINT audit_events_source_chk CHECK (source IN ('trigger','app','migration','manual','system')),
  CONSTRAINT audit_events_org_rule_chk CHECK (organization_id IS NOT NULL OR source IN ('trigger','migration','system')),
  CONSTRAINT audit_events_actor_rule_chk CHECK (actor_user_id IS NOT NULL OR source IN ('trigger','migration','system'))
);
COMMENT ON TABLE public.audit_events IS 'M0: trilha imutavel. Sem UPDATE e sem DELETE para qualquer papel de aplicacao.';

-- ---------------------------------------------------------------------
-- E. INDICES
-- ---------------------------------------------------------------------
CREATE INDEX organizations_status_idx        ON public.organizations (status);
CREATE INDEX users_org_status_idx            ON public.users (organization_id, status);
CREATE INDEX roles_org_status_idx            ON public.roles (organization_id, status);
CREATE UNIQUE INDEX role_permissions_active_uk ON public.role_permissions (role_id, permission_id) WHERE effective_to IS NULL;
CREATE INDEX role_permissions_permission_idx ON public.role_permissions (permission_id);
CREATE INDEX scopes_org_type_idx             ON public.scopes (organization_id, scope_type);
CREATE INDEX scopes_parent_idx               ON public.scopes (parent_scope_id);
CREATE UNIQUE INDEX scopes_target_uk         ON public.scopes (organization_id, scope_type, target_id) WHERE target_id IS NOT NULL;
CREATE UNIQUE INDEX scopes_root_uk           ON public.scopes (organization_id) WHERE scope_type = 'organization';
CREATE UNIQUE INDEX ura_active_uk            ON public.user_role_assignments (user_id, role_id, scope_id) WHERE status = 'active';
CREATE INDEX ura_user_status_idx             ON public.user_role_assignments (user_id, status);
CREATE INDEX ura_org_scope_idx               ON public.user_role_assignments (organization_id, scope_id);
CREATE INDEX ura_role_idx                    ON public.user_role_assignments (role_id);
CREATE INDEX audit_events_org_time_idx       ON public.audit_events (organization_id, occurred_at DESC);
CREATE INDEX audit_events_actor_time_idx     ON public.audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX audit_events_entity_idx         ON public.audit_events (entity_type, entity_id);
CREATE INDEX audit_events_type_idx           ON public.audit_events (event_type);

-- ---------------------------------------------------------------------
-- F. FUNCOES DE AUTORIZACAO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT u.id
    FROM public.users u
   WHERE u.auth_user_id = auth.uid()
   LIMIT 1
$fn$;
COMMENT ON FUNCTION public.current_user_id() IS 'Sem sessao: NULL. Nao concede papel.';

CREATE OR REPLACE FUNCTION public.accessible_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT DISTINCT o.id
    FROM public.user_role_assignments a
    JOIN public.users u  ON u.id = a.user_id
    JOIN public.roles r  ON r.id = a.role_id
    JOIN public.organizations o ON o.id = a.organization_id
   WHERE u.auth_user_id = auth.uid()
     AND u.status = 'active'
     AND o.status = 'active'
     AND r.status = 'active'
     AND a.status = 'active'
     AND a.effective_from <= now()
     AND (a.effective_to IS NULL OR a.effective_to > now())
$fn$;

CREATE OR REPLACE FUNCTION public.has_permission(
  p_code       public.citext,
  p_scope_type text,
  p_scope_id   uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_scope_id IS NULL OR p_scope_type IS NULL THEN false
    ELSE EXISTS (
      WITH RECURSIVE target AS (
        SELECT s.id, s.parent_scope_id, s.scope_type, s.organization_id, s.status
          FROM public.scopes s
         WHERE s.id = p_scope_id AND s.scope_type = p_scope_type AND s.status = 'active'
        UNION ALL
        SELECT p.id, p.parent_scope_id, p.scope_type, p.organization_id, p.status
          FROM public.scopes p
          JOIN target t ON t.parent_scope_id = p.id
      )
      SELECT 1
        FROM public.user_role_assignments a
        JOIN public.users u             ON u.id = a.user_id
        JOIN public.roles r             ON r.id = a.role_id
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions pm      ON pm.id = rp.permission_id
        JOIN target t                   ON t.id = a.scope_id
        JOIN public.organizations o     ON o.id = a.organization_id
       WHERE u.auth_user_id = auth.uid()
         AND u.status = 'active'
         AND o.status = 'active'
         AND r.status = 'active'
         AND a.status = 'active'
         AND t.status = 'active'
         AND pm.code = p_code
         AND a.effective_from <= now()
         AND (a.effective_to IS NULL OR a.effective_to > now())
         AND rp.effective_from <= now()
         AND (rp.effective_to IS NULL OR rp.effective_to > now())
         AND (pm.effective_to IS NULL OR pm.effective_to > now())
         AND p_scope_type = ANY (pm.allowed_scope_types)
    )
  END
$fn$;
COMMENT ON FUNCTION public.has_permission(public.citext, text, uuid) IS
  'Sem sessao, sem escopo, atribuicao expirada/revogada, usuario suspenso, organizacao suspensa ou papel nao ativo => false. Herda do escopo superior via parent_scope_id.';

CREATE OR REPLACE FUNCTION public.accessible_scope_ids(
  p_code       public.citext,
  p_scope_type text
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH RECURSIVE granted AS (
    SELECT s.id, s.scope_type
      FROM public.user_role_assignments a
      JOIN public.users u             ON u.id = a.user_id
      JOIN public.roles r             ON r.id = a.role_id
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions pm      ON pm.id = rp.permission_id
      JOIN public.scopes s            ON s.id = a.scope_id
      JOIN public.organizations o     ON o.id = a.organization_id
     WHERE u.auth_user_id = auth.uid()
       AND u.status = 'active'
       AND o.status = 'active'
       AND r.status = 'active'
       AND a.status = 'active'
       AND s.status = 'active'
       AND pm.code = p_code
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
       AND rp.effective_from <= now()
       AND (rp.effective_to IS NULL OR rp.effective_to > now())
       AND (pm.effective_to IS NULL OR pm.effective_to > now())
    UNION
    SELECT c.id, c.scope_type
      FROM public.scopes c
      JOIN granted g ON c.parent_scope_id = g.id
     WHERE c.status = 'active'
  )
  SELECT DISTINCT g.id FROM granted g WHERE g.scope_type = p_scope_type
$fn$;

CREATE OR REPLACE FUNCTION public.audit_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_events e imutavel: % nao permitido', TG_OP;
END
$fn$;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

CREATE OR REPLACE FUNCTION public.ura_guard_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION 'atribuicao revogada nao pode ser alterada';
  END IF;
  IF OLD.status = 'expired' AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'atribuicao expirada nao pode ser reativada';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.role_id <> OLD.role_id
     OR NEW.scope_id <> OLD.scope_id OR NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'chaves da atribuicao sao imutaveis; crie nova atribuicao';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

CREATE TRIGGER ura_guard_transition_trg
  BEFORE UPDATE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ura_guard_transition();

CREATE OR REPLACE FUNCTION public.ura_guard_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE v_status text; v_role_org uuid; v_scope_org uuid;
BEGIN
  SELECT r.status, r.organization_id INTO v_status, v_role_org
    FROM public.roles r WHERE r.id = NEW.role_id;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'papel nao ativo nao pode receber atribuicao (status=%)', v_status;
  END IF;
  SELECT s.organization_id INTO v_scope_org FROM public.scopes s WHERE s.id = NEW.scope_id;
  IF v_role_org <> NEW.organization_id OR v_scope_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'papel e escopo devem pertencer a mesma organizacao da atribuicao';
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER ura_guard_insert_trg
  BEFORE INSERT ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ura_guard_insert();

-- ---------------------------------------------------------------------
-- G. PROVISIONAMENTO DEFINITIVO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_provision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_org uuid;
  v_user_id uuid;
BEGIN
  BEGIN
    v_org := NULLIF(NEW.raw_app_meta_data ->> 'organization_id', '')::uuid;

    INSERT INTO public.users (auth_user_id, organization_id, status)
    VALUES (NEW.id, v_org, 'invited')
    ON CONFLICT (auth_user_id) DO NOTHING
    RETURNING id INTO v_user_id;

    INSERT INTO public.audit_events
      (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
    VALUES
      (v_org, NULL, 'user.provisioned', 'public.users', v_user_id, 'provision', 'trigger',
       jsonb_build_object('auth_user_id', NEW.id, 'idempotent_skip', v_user_id IS NULL));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.audit_events
      (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
    VALUES
      (NULL, NULL, 'user.provision_failed', 'auth.users', NEW.id, 'provision', 'trigger',
       jsonb_build_object('error', SQLERRM));
  END;
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.handle_new_user_provision() IS
  'Cria apenas o registro interno. Nao concede papel, nao ativa, nao aplica regra de primeiro usuario. Idempotente.';

-- ---------------------------------------------------------------------
-- H. GRANTS (minimos; anon sem nada)
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

GRANT SELECT ON public.scope_types            TO authenticated;
GRANT SELECT ON public.permissions            TO authenticated;
GRANT SELECT ON public.organizations          TO authenticated;
GRANT UPDATE ON public.organizations          TO authenticated;
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

REVOKE ALL ON FUNCTION public.current_user_id()                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accessible_organization_ids()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accessible_scope_ids(public.citext, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(public.citext, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user_provision()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_events_immutable()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ura_guard_transition()                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ura_guard_insert()                      FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_id()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_organization_ids()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_scope_ids(public.citext, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(public.citext, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- K. SEED CONTROLADO
-- ---------------------------------------------------------------------
INSERT INTO public.scope_types (code, label, sort_order) VALUES
  ('organization',  'Organizacao',    10),
  ('company',       'Empresa',        20),
  ('business_unit', 'Unidade',        30),
  ('department',    'Departamento',   40),
  ('position',      'Cargo',          50),
  ('person',        'Pessoa',         60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk) VALUES
  ('organization.read',   'Ler dados da organizacao',                     'org',        ARRAY['organization'], 'low'),
  ('organization.manage', 'Criar, editar e suspender organizacao/escopos','org',        ARRAY['organization'], 'high'),
  ('user.read',           'Listar usuarios internos',                     'iam',        ARRAY['organization','company'], 'low'),
  ('user.manage',         'Convidar, suspender e reativar usuarios',      'iam',        ARRAY['organization'], 'high'),
  ('role.read',           'Ler papeis e vinculos de permissao',           'iam',        ARRAY['organization'], 'low'),
  ('role.manage',         'Criar, editar e depreciar papeis',             'iam',        ARRAY['organization'], 'critical'),
  ('permission.read',     'Ler catalogo de permissoes',                   'iam',        ARRAY['organization'], 'low'),
  ('role.assign',         'Atribuir papel a usuario em escopo',           'iam',        ARRAY['organization','company','business_unit','department'], 'critical'),
  ('role.revoke',         'Revogar atribuicao de papel',                  'iam',        ARRAY['organization','company','business_unit','department'], 'critical'),
  ('audit.read',          'Ler trilha de auditoria',                      'governance', ARRAY['organization'], 'medium')
ON CONFLICT (code) DO NOTHING;

DO $seed$
DECLARE
  v_org      uuid;
  v_scope    uuid;
  v_role     uuid;
  v_admin    uuid;
  v_second   uuid;
BEGIN
  INSERT INTO public.organizations (name, slug, status, timezone)
  VALUES ('Grupo Moitinho', 'grupo-moitinho', 'active', 'America/Bahia')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'grupo-moitinho';

  INSERT INTO public.scopes (organization_id, scope_type, parent_scope_id, target_table, target_id, label, status)
  SELECT v_org, 'organization', NULL, 'public.organizations', v_org, 'Grupo Moitinho', 'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.scopes s WHERE s.organization_id = v_org AND s.scope_type = 'organization'
  );
  SELECT id INTO v_scope FROM public.scopes WHERE organization_id = v_org AND scope_type = 'organization';

  INSERT INTO public.roles (organization_id, code, name, description, status, is_system)
  VALUES (v_org, 'group_admin', 'Administrador do Grupo',
          'Administracao da fundacao: organizacao, usuarios, papeis, atribuicoes e auditoria.',
          'active', true)
  ON CONFLICT (organization_id, code) DO NOTHING;
  SELECT id INTO v_role FROM public.roles WHERE organization_id = v_org AND code = 'group_admin';

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role, p.id
    FROM public.permissions p
   WHERE NOT EXISTS (
       SELECT 1 FROM public.role_permissions rp
        WHERE rp.role_id = v_role AND rp.permission_id = p.id AND rp.effective_to IS NULL
     );

  INSERT INTO public.users (auth_user_id, organization_id, status)
  VALUES ('d70f1845-d2c2-42be-89a1-88e12efe81bb', v_org, 'active')
  ON CONFLICT (auth_user_id) DO NOTHING;
  INSERT INTO public.users (auth_user_id, organization_id, status)
  VALUES ('bc170fc0-1f36-43bf-a27f-a6275928776b', v_org, 'suspended')
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO v_admin  FROM public.users WHERE auth_user_id = 'd70f1845-d2c2-42be-89a1-88e12efe81bb';
  SELECT id INTO v_second FROM public.users WHERE auth_user_id = 'bc170fc0-1f36-43bf-a27f-a6275928776b';

  INSERT INTO public.user_role_assignments
    (organization_id, user_id, role_id, scope_id, status, assigned_by, justification)
  SELECT v_org, v_admin, v_role, v_scope, 'active', NULL,
         'Provisionamento inicial M0 - administrador nominal autorizado pelo responsavel do projeto'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_role_assignments a
     WHERE a.user_id = v_admin AND a.role_id = v_role AND a.scope_id = v_scope AND a.status = 'active'
  );

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES
    (v_org, NULL, 'organization.seeded',  'public.organizations',        v_org,   'create', 'migration', jsonb_build_object('slug','grupo-moitinho')),
    (v_org, NULL, 'scope.seeded',         'public.scopes',               v_scope, 'create', 'migration', jsonb_build_object('scope_type','organization')),
    (v_org, NULL, 'role.seeded',          'public.roles',                v_role,  'create', 'migration', jsonb_build_object('code','group_admin')),
    (v_org, NULL, 'user.seeded',          'public.users',                v_admin, 'create', 'migration', jsonb_build_object('role','group_admin','status','active')),
    (v_org, NULL, 'user.seeded',          'public.users',                v_second,'create', 'migration', jsonb_build_object('role',NULL,'status','suspended')),
    (v_org, NULL, 'role.assignment_seeded','public.user_role_assignments',
       (SELECT a.id FROM public.user_role_assignments a
         WHERE a.user_id=v_admin AND a.role_id=v_role AND a.scope_id=v_scope AND a.status='active'),
       'grant',  'migration', jsonb_build_object('scope','organization'));
END
$seed$;

-- ---------------------------------------------------------------------
-- I. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.scope_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scopes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events           ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scopes                 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events           FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- J. POLICIES (nenhuma para anon)
-- ---------------------------------------------------------------------
CREATE POLICY scope_types_select ON public.scope_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accessible_organization_ids() o
                  WHERE public.has_permission('permission.read', 'organization',
                        (SELECT s.id FROM public.scopes s
                          WHERE s.organization_id = o AND s.scope_type = 'organization'))));

CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.accessible_organization_ids()));

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_permission('organization.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = organizations.id AND s.scope_type = 'organization')))
  WITH CHECK (public.has_permission('organization.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = organizations.id AND s.scope_type = 'organization')));

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.has_permission('user.read', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = users.organization_id AND s.scope_type = 'organization'))
  );

CREATE POLICY users_update_managed ON public.users
  FOR UPDATE TO authenticated
  USING (public.has_permission('user.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = users.organization_id AND s.scope_type = 'organization')))
  WITH CHECK (public.has_permission('user.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = users.organization_id AND s.scope_type = 'organization')));

CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (public.has_permission('role.read', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = roles.organization_id AND s.scope_type = 'organization')));

CREATE POLICY roles_insert ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('role.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = roles.organization_id AND s.scope_type = 'organization')));

CREATE POLICY roles_update ON public.roles
  FOR UPDATE TO authenticated
  USING (public.has_permission('role.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = roles.organization_id AND s.scope_type = 'organization')))
  WITH CHECK (public.has_permission('role.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = roles.organization_id AND s.scope_type = 'organization')));

CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r
                  WHERE r.id = role_permissions.role_id
                    AND public.has_permission('role.read', 'organization',
                        (SELECT s.id FROM public.scopes s WHERE s.organization_id = r.organization_id AND s.scope_type = 'organization'))));

CREATE POLICY role_permissions_insert ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.roles r
                  WHERE r.id = role_permissions.role_id
                    AND public.has_permission('role.manage', 'organization',
                        (SELECT s.id FROM public.scopes s WHERE s.organization_id = r.organization_id AND s.scope_type = 'organization'))));

CREATE POLICY role_permissions_update ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r
                  WHERE r.id = role_permissions.role_id
                    AND public.has_permission('role.manage', 'organization',
                        (SELECT s.id FROM public.scopes s WHERE s.organization_id = r.organization_id AND s.scope_type = 'organization'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roles r
                  WHERE r.id = role_permissions.role_id
                    AND public.has_permission('role.manage', 'organization',
                        (SELECT s.id FROM public.scopes s WHERE s.organization_id = r.organization_id AND s.scope_type = 'organization'))));

CREATE POLICY scopes_select ON public.scopes
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.accessible_organization_ids()));

CREATE POLICY scopes_insert ON public.scopes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('organization.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = scopes.organization_id AND s.scope_type = 'organization')));

CREATE POLICY scopes_update ON public.scopes
  FOR UPDATE TO authenticated
  USING (public.has_permission('organization.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = scopes.organization_id AND s.scope_type = 'organization')))
  WITH CHECK (public.has_permission('organization.manage', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = scopes.organization_id AND s.scope_type = 'organization')));

CREATE POLICY ura_select ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_user_id()
    OR public.has_permission('role.read', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = user_role_assignments.organization_id AND s.scope_type = 'organization'))
  );

CREATE POLICY ura_insert ON public.user_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = public.current_user_id()
    AND user_id <> public.current_user_id()
    AND status IN ('pending','active')
    AND public.has_permission('role.assign',
          (SELECT s.scope_type FROM public.scopes s WHERE s.id = user_role_assignments.scope_id),
          scope_id)
  );

CREATE POLICY ura_update ON public.user_role_assignments
  FOR UPDATE TO authenticated
  USING (
    user_id <> public.current_user_id()
    AND public.has_permission('role.revoke',
          (SELECT s.scope_type FROM public.scopes s WHERE s.id = user_role_assignments.scope_id),
          scope_id)
  )
  WITH CHECK (status IN ('revoked','expired'));

CREATE POLICY audit_events_select ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.has_permission('audit.read', 'organization',
         (SELECT s.id FROM public.scopes s WHERE s.organization_id = audit_events.organization_id AND s.scope_type = 'organization'))
  );

CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = public.current_user_id()
    AND source = 'app'
    AND organization_id IN (SELECT public.accessible_organization_ids())
  );

-- ---------------------------------------------------------------------
-- G2. TROCA DO TRIGGER DE PROVISIONAMENTO
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_provision();

DROP FUNCTION IF EXISTS public.handle_new_user_noop();

-- ---------------------------------------------------------------------
-- L. VALIDACOES FINAIS (abortam a transacao em caso de desvio)
-- ---------------------------------------------------------------------
DO $post$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r';
  IF v <> 9 THEN RAISE EXCEPTION 'POS: esperado 9 tabelas, obtido %', v; END IF;

  SELECT count(*) INTO v FROM public.permissions;
  IF v <> 10 THEN RAISE EXCEPTION 'POS: esperado 10 permissoes, obtido %', v; END IF;

  SELECT count(*) INTO v FROM public.users;
  IF v <> 2 THEN RAISE EXCEPTION 'POS: esperado 2 usuarios internos, obtido %', v; END IF;

  SELECT count(*) INTO v FROM public.user_role_assignments WHERE status='active';
  IF v <> 1 THEN RAISE EXCEPTION 'POS: esperada 1 atribuicao ativa, obtido %', v; END IF;

  SELECT count(*) INTO v FROM auth.users;
  IF v <> 2 THEN RAISE EXCEPTION 'POS: auth.users alterada (%)', v; END IF;

  SELECT count(*) INTO v FROM pg_policies WHERE schemaname='public' AND 'anon' = ANY (roles);
  IF v <> 0 THEN RAISE EXCEPTION 'POS: existe policy para anon (%)', v; END IF;
END
$post$;