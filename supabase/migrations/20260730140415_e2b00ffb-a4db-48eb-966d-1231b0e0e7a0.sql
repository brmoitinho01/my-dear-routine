CREATE TABLE public.companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  slug            citext NOT NULL,
  name            text NOT NULL,
  legal_name      text,
  status          text NOT NULL DEFAULT 'active',
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  CONSTRAINT companies_status_chk CHECK (status IN ('active','suspended','archived')),
  CONSTRAINT companies_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT companies_slug_chk   CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT companies_name_chk   CHECK (length(btrim(name)) > 0),
  CONSTRAINT companies_org_slug_uk UNIQUE (organization_id, slug),
  CONSTRAINT companies_id_org_uk   UNIQUE (id, organization_id)
);

CREATE TABLE public.business_units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  company_id      uuid NOT NULL,
  slug            citext NOT NULL,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid,
  CONSTRAINT business_units_company_fk FOREIGN KEY (company_id, organization_id)
    REFERENCES public.companies(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT business_units_status_chk CHECK (status IN ('active','suspended','archived')),
  CONSTRAINT business_units_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT business_units_slug_chk   CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT business_units_name_chk   CHECK (length(btrim(name)) > 0),
  CONSTRAINT business_units_company_slug_uk UNIQUE (company_id, slug),
  CONSTRAINT business_units_id_org_uk       UNIQUE (id, organization_id)
);

CREATE TABLE public.departments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_unit_id uuid NOT NULL,
  slug             citext NOT NULL,
  name             text NOT NULL,
  status           text NOT NULL DEFAULT 'active',
  effective_from   timestamptz NOT NULL DEFAULT now(),
  effective_to     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  CONSTRAINT departments_bu_fk FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT departments_status_chk CHECK (status IN ('active','suspended','archived')),
  CONSTRAINT departments_period_chk CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT departments_slug_chk   CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT departments_name_chk   CHECK (length(btrim(name)) > 0),
  CONSTRAINT departments_bu_slug_uk UNIQUE (business_unit_id, slug),
  CONSTRAINT departments_id_org_uk  UNIQUE (id, organization_id)
);

CREATE INDEX companies_org_idx      ON public.companies (organization_id);
CREATE INDEX business_units_org_idx ON public.business_units (organization_id);
CREATE INDEX business_units_cmp_idx ON public.business_units (company_id);
CREATE INDEX departments_org_idx    ON public.departments (organization_id);
CREATE INDEX departments_bu_idx     ON public.departments (business_unit_id);

GRANT SELECT ON public.companies      TO authenticated;
GRANT SELECT ON public.business_units TO authenticated;
GRANT SELECT ON public.departments    TO authenticated;
GRANT ALL    ON public.companies      TO service_role;
GRANT ALL    ON public.business_units TO service_role;
GRANT ALL    ON public.departments    TO service_role;

CREATE OR REPLACE FUNCTION public.f1_entity_scope_id(p_target_table text, p_target_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT s.id FROM public.scopes s
   WHERE s.target_table = p_target_table AND s.target_id = p_target_id
   LIMIT 1
$fn$;

CREATE OR REPLACE FUNCTION public.f1_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $fn$;

CREATE TRIGGER companies_touch      BEFORE UPDATE ON public.companies      FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();
CREATE TRIGGER business_units_touch BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();
CREATE TRIGGER departments_touch    BEFORE UPDATE ON public.departments    FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

CREATE OR REPLACE FUNCTION public.f1_sync_entity_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_scope_type   text;
  v_target_table text;
  v_parent_scope uuid;
  v_scope_id     uuid;
BEGIN
  IF TG_TABLE_NAME = 'companies' THEN
    v_scope_type := 'company';
    v_target_table := 'public.companies';
    v_parent_scope := public.organization_root_scope_id(NEW.organization_id);
  ELSIF TG_TABLE_NAME = 'business_units' THEN
    v_scope_type := 'business_unit';
    v_target_table := 'public.business_units';
    v_parent_scope := public.f1_entity_scope_id('public.companies', NEW.company_id);
  ELSE
    v_scope_type := 'department';
    v_target_table := 'public.departments';
    v_parent_scope := public.f1_entity_scope_id('public.business_units', NEW.business_unit_id);
  END IF;

  IF v_parent_scope IS NULL THEN
    RAISE EXCEPTION 'escopo pai inexistente para % %', TG_TABLE_NAME, NEW.id;
  END IF;

  SELECT s.id INTO v_scope_id FROM public.scopes s
   WHERE s.target_table = v_target_table AND s.target_id = NEW.id;

  IF v_scope_id IS NULL THEN
    INSERT INTO public.scopes
      (organization_id, scope_type, parent_scope_id, target_table, target_id, label, status)
    VALUES
      (NEW.organization_id, v_scope_type, v_parent_scope, v_target_table, NEW.id, NEW.name, NEW.status);
  ELSE
    UPDATE public.scopes
       SET label = NEW.name,
           status = NEW.status,
           parent_scope_id = v_parent_scope,
           updated_at = now()
     WHERE id = v_scope_id;
  END IF;

  RETURN NEW;
END $fn$;

CREATE TRIGGER companies_scope_sync      AFTER INSERT OR UPDATE ON public.companies      FOR EACH ROW EXECUTE FUNCTION public.f1_sync_entity_scope();
CREATE TRIGGER business_units_scope_sync AFTER INSERT OR UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.f1_sync_entity_scope();
CREATE TRIGGER departments_scope_sync    AFTER INSERT OR UPDATE ON public.departments    FOR EACH ROW EXECUTE FUNCTION public.f1_sync_entity_scope();

ALTER TABLE public.companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments    ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (public.has_permission('structure.read'::citext, 'company',
         public.f1_entity_scope_id('public.companies', id)));

CREATE POLICY business_units_select ON public.business_units
  FOR SELECT TO authenticated
  USING (public.has_permission('structure.read'::citext, 'business_unit',
         public.f1_entity_scope_id('public.business_units', id)));

CREATE POLICY departments_select ON public.departments
  FOR SELECT TO authenticated
  USING (public.has_permission('structure.read'::citext, 'department',
         public.f1_entity_scope_id('public.departments', id)));

INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
SELECT 'structure.read', 'Leitura da estrutura organizacional (empresas, unidades e departamentos)',
       'org', ARRAY['organization','company','business_unit','department'], 'low', true
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'structure.read'::citext);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
 WHERE r.code = 'group_admin'::citext
   AND r.status = 'active'
   AND p.code = 'structure.read'::citext
   AND NOT EXISTS (
     SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

INSERT INTO public.audit_events
  (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
SELECT o.id, NULL, 'structure.f1_applied', 'public.companies', NULL, 'create', 'migration',
       jsonb_build_object('version','F1_APPLY_v1.0')
  FROM public.organizations o
 WHERE o.slug = 'grupo-moitinho'::citext;