-- F8.5 — Organograma funcional e validação de responsabilidades (aditiva, idempotente)

-- 1. Helper de autorização por escopo (resolve o scope_type do próprio escopo)
CREATE OR REPLACE FUNCTION public.f85_can(p_scope_id uuid, p_code citext)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(
    (SELECT public.has_permission(p_code, s.scope_type, s.id)
       FROM public.scopes s WHERE s.id = p_scope_id),
    false)
$$;

REVOKE ALL ON FUNCTION public.f85_can(uuid, citext) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f85_can(uuid, citext) FROM anon;
GRANT EXECUTE ON FUNCTION public.f85_can(uuid, citext) TO authenticated;

-- 2. Permissão structure.manage
INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
VALUES ('structure.manage', 'Gerenciar estrutura organizacional, posições, pessoas e atribuições',
        'org', ARRAY['organization','company','business_unit','department'], 'high', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code = 'structure.manage'
 WHERE r.code IN ('group_owner','group_admin')
   AND NOT EXISTS (
     SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- 3. org_people
CREATE TABLE IF NOT EXISTS public.org_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  home_scope_id uuid NOT NULL REFERENCES public.scopes(id),
  user_id uuid REFERENCES public.users(id),
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  work_email text,
  employee_code text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT org_people_id_org_key UNIQUE (id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS org_people_user_unique
  ON public.org_people (organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_people_scope_idx ON public.org_people (home_scope_id);

-- 4. organizational_positions
CREATE TABLE IF NOT EXISTS public.organizational_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  scope_id uuid NOT NULL REFERENCES public.scopes(id),
  parent_position_id uuid,
  title text NOT NULL CHECK (btrim(title) <> ''),
  purpose text,
  responsibilities_text text,
  decision_authority_text text,
  key_deliverables_text text,
  expected_headcount integer NOT NULL DEFAULT 1 CHECK (expected_headcount > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT positions_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT positions_parent_org_fk FOREIGN KEY (parent_position_id, organization_id)
    REFERENCES public.organizational_positions (id, organization_id),
  CONSTRAINT positions_parent_not_self CHECK (parent_position_id IS NULL OR parent_position_id <> id)
);

CREATE INDEX IF NOT EXISTS positions_scope_idx ON public.organizational_positions (scope_id);
CREATE INDEX IF NOT EXISTS positions_parent_idx ON public.organizational_positions (parent_position_id);

-- 5. position_assignments
CREATE TABLE IF NOT EXISTS public.position_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  position_id uuid NOT NULL,
  person_id uuid NOT NULL,
  assignment_type text NOT NULL DEFAULT 'primary'
    CHECK (assignment_type IN ('primary','acting','support')),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT assignments_position_fk FOREIGN KEY (position_id, organization_id)
    REFERENCES public.organizational_positions (id, organization_id),
  CONSTRAINT assignments_person_fk FOREIGN KEY (person_id, organization_id)
    REFERENCES public.org_people (id, organization_id),
  CONSTRAINT assignments_period CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT assignments_active_open CHECK (
    status <> 'active' OR end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_primary_per_person
  ON public.position_assignments (organization_id, person_id)
  WHERE status = 'active' AND assignment_type = 'primary';
CREATE INDEX IF NOT EXISTS assignments_position_idx ON public.position_assignments (position_id);
CREATE INDEX IF NOT EXISTS assignments_person_idx ON public.position_assignments (person_id);

-- 6. Guard de ciclos na árvore de posições
CREATE OR REPLACE FUNCTION public.f85_position_cycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_cursor uuid; v_depth integer := 0;
BEGIN
  IF NEW.parent_position_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_position_id = NEW.id THEN
    RAISE EXCEPTION 'Uma posição não pode ser chefia de si mesma.';
  END IF;
  v_cursor := NEW.parent_position_id;
  WHILE v_cursor IS NOT NULL LOOP
    v_depth := v_depth + 1;
    IF v_depth > 50 THEN
      RAISE EXCEPTION 'Hierarquia de posições inválida (profundidade excessiva).';
    END IF;
    IF v_cursor = NEW.id THEN
      RAISE EXCEPTION 'Alteração de chefia rejeitada: criaria um ciclo no organograma.';
    END IF;
    SELECT p.parent_position_id INTO v_cursor
      FROM public.organizational_positions p WHERE p.id = v_cursor;
  END LOOP;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.f85_position_cycle_guard() FROM PUBLIC;

-- 7. Guard de headcount
CREATE OR REPLACE FUNCTION public.f85_headcount_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_expected integer; v_active integer;
BEGIN
  IF NEW.status <> 'active' OR NEW.assignment_type <> 'primary' THEN RETURN NEW; END IF;
  SELECT p.expected_headcount INTO v_expected
    FROM public.organizational_positions p WHERE p.id = NEW.position_id;
  SELECT count(*) INTO v_active
    FROM public.position_assignments a
   WHERE a.position_id = NEW.position_id
     AND a.status = 'active'
     AND a.assignment_type = 'primary'
     AND a.id <> NEW.id;
  IF v_active + 1 > COALESCE(v_expected, 1) THEN
    RAISE EXCEPTION 'Ocupação rejeitada: a posição já atingiu o número esperado de titulares (%).', COALESCE(v_expected, 1);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.f85_headcount_guard() FROM PUBLIC;

-- 8. Triggers
DROP TRIGGER IF EXISTS org_people_touch ON public.org_people;
CREATE TRIGGER org_people_touch BEFORE UPDATE ON public.org_people
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();
DROP TRIGGER IF EXISTS org_people_audit ON public.org_people;
CREATE TRIGGER org_people_audit AFTER INSERT OR UPDATE ON public.org_people
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

DROP TRIGGER IF EXISTS positions_touch ON public.organizational_positions;
CREATE TRIGGER positions_touch BEFORE UPDATE ON public.organizational_positions
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();
DROP TRIGGER IF EXISTS positions_cycle_guard ON public.organizational_positions;
CREATE TRIGGER positions_cycle_guard BEFORE INSERT OR UPDATE ON public.organizational_positions
  FOR EACH ROW EXECUTE FUNCTION public.f85_position_cycle_guard();
DROP TRIGGER IF EXISTS positions_audit ON public.organizational_positions;
CREATE TRIGGER positions_audit AFTER INSERT OR UPDATE ON public.organizational_positions
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

DROP TRIGGER IF EXISTS assignments_touch ON public.position_assignments;
CREATE TRIGGER assignments_touch BEFORE UPDATE ON public.position_assignments
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();
DROP TRIGGER IF EXISTS assignments_headcount_guard ON public.position_assignments;
CREATE TRIGGER assignments_headcount_guard BEFORE INSERT OR UPDATE ON public.position_assignments
  FOR EACH ROW EXECUTE FUNCTION public.f85_headcount_guard();
DROP TRIGGER IF EXISTS assignments_audit ON public.position_assignments;
CREATE TRIGGER assignments_audit AFTER INSERT OR UPDATE ON public.position_assignments
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

-- 9. Grants (sem DELETE)
GRANT SELECT, INSERT, UPDATE ON public.org_people TO authenticated;
GRANT ALL ON public.org_people TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.organizational_positions TO authenticated;
GRANT ALL ON public.organizational_positions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.position_assignments TO authenticated;
GRANT ALL ON public.position_assignments TO service_role;

-- 10. RLS
ALTER TABLE public.org_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizational_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_people_select ON public.org_people;
CREATE POLICY org_people_select ON public.org_people FOR SELECT TO authenticated
  USING (public.f85_can(home_scope_id, 'structure.read'));
DROP POLICY IF EXISTS org_people_insert ON public.org_people;
CREATE POLICY org_people_insert ON public.org_people FOR INSERT TO authenticated
  WITH CHECK (public.f85_can(home_scope_id, 'structure.manage'));
DROP POLICY IF EXISTS org_people_update ON public.org_people;
CREATE POLICY org_people_update ON public.org_people FOR UPDATE TO authenticated
  USING (public.f85_can(home_scope_id, 'structure.manage'))
  WITH CHECK (public.f85_can(home_scope_id, 'structure.manage'));

DROP POLICY IF EXISTS positions_select ON public.organizational_positions;
CREATE POLICY positions_select ON public.organizational_positions FOR SELECT TO authenticated
  USING (public.f85_can(scope_id, 'structure.read'));
DROP POLICY IF EXISTS positions_insert ON public.organizational_positions;
CREATE POLICY positions_insert ON public.organizational_positions FOR INSERT TO authenticated
  WITH CHECK (public.f85_can(scope_id, 'structure.manage'));
DROP POLICY IF EXISTS positions_update ON public.organizational_positions;
CREATE POLICY positions_update ON public.organizational_positions FOR UPDATE TO authenticated
  USING (public.f85_can(scope_id, 'structure.manage'))
  WITH CHECK (public.f85_can(scope_id, 'structure.manage'));

DROP POLICY IF EXISTS assignments_select ON public.position_assignments;
CREATE POLICY assignments_select ON public.position_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organizational_positions p
                  WHERE p.id = position_id AND public.f85_can(p.scope_id, 'structure.read')));
DROP POLICY IF EXISTS assignments_insert ON public.position_assignments;
CREATE POLICY assignments_insert ON public.position_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organizational_positions p
                       WHERE p.id = position_id AND public.f85_can(p.scope_id, 'structure.manage')));
DROP POLICY IF EXISTS assignments_update ON public.position_assignments;
CREATE POLICY assignments_update ON public.position_assignments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organizational_positions p
                  WHERE p.id = position_id AND public.f85_can(p.scope_id, 'structure.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organizational_positions p
                       WHERE p.id = position_id AND public.f85_can(p.scope_id, 'structure.manage')));