-- ============================================================
-- GMOS — F9: Iniciativas estratégicas e derivação rastreável
-- Aditiva, idempotente e reversível. Não altera dados existentes
-- além do backfill de origin_type dos planos de ação.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Permissões
-- ------------------------------------------------------------
INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
VALUES
  ('initiative.read', 'Visualizar iniciativas estratégicas no escopo', 'strategy',
   ARRAY['organization','company','business_unit']::text[], 'low', true),
  ('initiative.manage', 'Criar e editar iniciativas estratégicas e derivar planos de ação', 'strategy',
   ARRAY['organization','company','business_unit']::text[], 'medium', true),
  ('initiative.approve', 'Aprovar e ativar iniciativas estratégicas no escopo', 'strategy',
   ARRAY['organization','company','business_unit']::text[], 'high', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code = ANY (
    CASE
      WHEN r.code::text IN ('group_owner','group_admin')
        THEN ARRAY['initiative.read','initiative.manage','initiative.approve']::public.citext[]
      WHEN r.code::text = 'manager'
        THEN ARRAY['initiative.read','initiative.manage']::public.citext[]
      WHEN r.code::text = 'collaborator'
        THEN ARRAY['initiative.read']::public.citext[]
      ELSE ARRAY[]::public.citext[]
    END)
 WHERE r.code::text IN ('group_owner','group_admin','manager','collaborator')
   AND NOT EXISTS (
     SELECT 1 FROM public.role_permissions x
      WHERE x.role_id = r.id AND x.permission_id = p.id
   );

-- ------------------------------------------------------------
-- 2. strategic_initiatives
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategic_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  objective_id uuid NOT NULL,
  pillar_id uuid,
  kpi_id uuid,
  risk_id uuid,
  title text NOT NULL,
  description text,
  expected_result text,
  owner_user_id uuid REFERENCES public.users(id),
  sponsor_user_id uuid REFERENCES public.users(id),
  start_date date,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'draft',
  progress integer NOT NULL DEFAULT 0,
  estimated_cost numeric,
  submitted_by uuid REFERENCES public.users(id),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  approval_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategic_initiatives_id_org_key UNIQUE (id, organization_id),
  CONSTRAINT strategic_initiatives_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id),
  CONSTRAINT strategic_initiatives_plan_fk
    FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id),
  CONSTRAINT strategic_initiatives_objective_fk
    FOREIGN KEY (objective_id, organization_id)
    REFERENCES public.strategic_objectives(id, organization_id),
  CONSTRAINT strategic_initiatives_pillar_fk
    FOREIGN KEY (pillar_id, organization_id)
    REFERENCES public.strategic_pillars(id, organization_id),
  CONSTRAINT strategic_initiatives_kpi_fk
    FOREIGN KEY (kpi_id, organization_id)
    REFERENCES public.kpis(id, organization_id),
  CONSTRAINT strategic_initiatives_risk_fk
    FOREIGN KEY (risk_id, organization_id)
    REFERENCES public.strategic_risks(id, organization_id),
  CONSTRAINT strategic_initiatives_priority_chk
    CHECK (priority IN ('low','medium','high','critical')),
  CONSTRAINT strategic_initiatives_status_chk
    CHECK (status IN ('draft','in_review','approved','active','on_hold','completed','cancelled','archived')),
  CONSTRAINT strategic_initiatives_progress_chk CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT strategic_initiatives_title_chk CHECK (btrim(title) <> ''),
  CONSTRAINT strategic_initiatives_dates_chk
    CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date),
  CONSTRAINT strategic_initiatives_cost_chk CHECK (estimated_cost IS NULL OR estimated_cost >= 0)
);

CREATE INDEX IF NOT EXISTS strategic_initiatives_plan_idx ON public.strategic_initiatives(plan_id);
CREATE INDEX IF NOT EXISTS strategic_initiatives_objective_idx ON public.strategic_initiatives(objective_id);
CREATE INDEX IF NOT EXISTS strategic_initiatives_bu_idx ON public.strategic_initiatives(business_unit_id);
CREATE INDEX IF NOT EXISTS strategic_initiatives_status_idx ON public.strategic_initiatives(status);

GRANT SELECT, INSERT, UPDATE ON public.strategic_initiatives TO authenticated;
GRANT ALL ON public.strategic_initiatives TO service_role;

ALTER TABLE public.strategic_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategic_initiatives_select ON public.strategic_initiatives;
CREATE POLICY strategic_initiatives_select ON public.strategic_initiatives
  FOR SELECT TO authenticated
  USING (public.has_permission('initiative.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategic_initiatives_insert ON public.strategic_initiatives;
CREATE POLICY strategic_initiatives_insert ON public.strategic_initiatives
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('initiative.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategic_initiatives_update ON public.strategic_initiatives;
CREATE POLICY strategic_initiatives_update ON public.strategic_initiatives
  FOR UPDATE TO authenticated
  USING (public.has_permission('initiative.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('initiative.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS strategic_initiatives_touch ON public.strategic_initiatives;
CREATE TRIGGER strategic_initiatives_touch BEFORE UPDATE ON public.strategic_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS strategic_initiatives_audit ON public.strategic_initiatives;
CREATE TRIGGER strategic_initiatives_audit AFTER INSERT OR UPDATE ON public.strategic_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

-- ------------------------------------------------------------
-- 3. action_plans — rastreabilidade de origem (aditivo)
-- ------------------------------------------------------------
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS initiative_id uuid,
  ADD COLUMN IF NOT EXISTS origin_type text,
  ADD COLUMN IF NOT EXISTS origin_note text,
  ADD COLUMN IF NOT EXISTS derived_at timestamptz,
  ADD COLUMN IF NOT EXISTS derived_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'action_plans_initiative_fk') THEN
    ALTER TABLE public.action_plans
      ADD CONSTRAINT action_plans_initiative_fk
      FOREIGN KEY (initiative_id, organization_id)
      REFERENCES public.strategic_initiatives(id, organization_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'action_plans_derived_by_fk') THEN
    ALTER TABLE public.action_plans
      ADD CONSTRAINT action_plans_derived_by_fk
      FOREIGN KEY (derived_by) REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'action_plans_origin_type_chk') THEN
    ALTER TABLE public.action_plans
      ADD CONSTRAINT action_plans_origin_type_chk
      CHECK (origin_type IS NULL OR origin_type IN
        ('initiative','objective','kpi','risk','decision','standalone_justified'));
  END IF;
END $$;

-- Backfill conservador: apenas classifica a origem já existente.
UPDATE public.action_plans
   SET origin_type = CASE
         WHEN initiative_id IS NOT NULL THEN 'initiative'
         WHEN objective_id IS NOT NULL THEN 'objective'
         WHEN kpi_id IS NOT NULL THEN 'kpi'
         ELSE 'standalone_justified'
       END
 WHERE origin_type IS NULL;

-- Nesta fase: no máximo um plano de ação não cancelado por iniciativa.
CREATE UNIQUE INDEX IF NOT EXISTS action_plans_one_active_per_initiative_idx
  ON public.action_plans(initiative_id)
  WHERE initiative_id IS NOT NULL AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS action_plans_origin_type_idx ON public.action_plans(origin_type);

-- ------------------------------------------------------------
-- 4. Consistência e workflow das iniciativas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f9_initiative_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obj public.strategic_objectives%ROWTYPE;
  v_content_changed boolean := false;
BEGIN
  SELECT * INTO v_obj FROM public.strategic_objectives WHERE id = NEW.objective_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objetivo estratégico inexistente.';
  END IF;
  IF v_obj.organization_id <> NEW.organization_id
     OR v_obj.business_unit_id <> NEW.business_unit_id
     OR v_obj.plan_id <> NEW.plan_id THEN
    RAISE EXCEPTION 'Objetivo não pertence ao mesmo ciclo/unidade da iniciativa.';
  END IF;

  IF NEW.pillar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.strategic_pillars p
     WHERE p.id = NEW.pillar_id AND p.plan_id = NEW.plan_id
       AND p.organization_id = NEW.organization_id
       AND p.business_unit_id = NEW.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Pilar não pertence ao mesmo ciclo/unidade da iniciativa.';
  END IF;

  IF NEW.kpi_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kpis k
     WHERE k.id = NEW.kpi_id AND k.plan_id = NEW.plan_id
       AND k.organization_id = NEW.organization_id
       AND k.business_unit_id = NEW.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Indicador não pertence ao mesmo ciclo/unidade da iniciativa.';
  END IF;

  IF NEW.risk_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.strategic_risks r
     WHERE r.id = NEW.risk_id AND r.plan_id = NEW.plan_id
       AND r.organization_id = NEW.organization_id
       AND r.business_unit_id = NEW.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Risco não pertence ao mesmo ciclo/unidade da iniciativa.';
  END IF;

  -- Ativação exige aprovação prévia e conteúdo mínimo.
  IF NEW.status = 'active' THEN
    IF NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'Iniciativa só pode ser ativada após aprovação.';
    END IF;
    IF NEW.owner_user_id IS NULL
       OR nullif(btrim(coalesce(NEW.expected_result,'')),'') IS NULL
       OR NEW.due_date IS NULL THEN
      RAISE EXCEPTION 'Iniciativa ativa exige responsável, resultado esperado e prazo.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_content_changed :=
      coalesce(NEW.title,'') <> coalesce(OLD.title,'')
      OR coalesce(NEW.description,'') <> coalesce(OLD.description,'')
      OR coalesce(NEW.expected_result,'') <> coalesce(OLD.expected_result,'')
      OR coalesce(NEW.objective_id::text,'') <> coalesce(OLD.objective_id::text,'')
      OR coalesce(NEW.kpi_id::text,'') <> coalesce(OLD.kpi_id::text,'')
      OR coalesce(NEW.risk_id::text,'') <> coalesce(OLD.risk_id::text,'')
      OR coalesce(NEW.due_date::text,'') <> coalesce(OLD.due_date::text,'');

    -- Aprovar/ativar exige initiative.approve.
    IF (NEW.status IN ('approved','active') AND OLD.status NOT IN ('approved','active'))
       OR (NEW.approved_at IS DISTINCT FROM OLD.approved_at AND NEW.approved_at IS NOT NULL) THEN
      IF NOT public.has_permission('initiative.approve'::public.citext, 'business_unit',
                                   public.f2_bu_scope_id(NEW.business_unit_id)) THEN
        RAISE EXCEPTION 'Permissão negada para aprovar ou ativar iniciativas.';
      END IF;
    END IF;

    -- Alterar conteúdo central de iniciativa aprovada/ativa volta para rascunho.
    IF v_content_changed AND OLD.status IN ('approved','active')
       AND NEW.status = OLD.status THEN
      NEW.status := 'draft';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      NEW.approval_notes := NULL;
      NEW.submitted_by := NULL;
      NEW.submitted_at := NULL;
      INSERT INTO public.audit_events
        (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
      VALUES (NEW.organization_id, public.current_user_id(), 'f9.initiative.reverted_to_draft',
              'public.strategic_initiatives', NEW.id, 'update', 'trigger',
              jsonb_build_object('from', OLD.status, 'to', 'draft', 'content_changed', true));
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.f9_initiative_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS strategic_initiatives_guard ON public.strategic_initiatives;
CREATE TRIGGER strategic_initiatives_guard
  BEFORE INSERT OR UPDATE ON public.strategic_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.f9_initiative_guard();

-- ------------------------------------------------------------
-- 5. RPCs de workflow
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f9_initiative_readiness(p_initiative_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ini public.strategic_initiatives%ROWTYPE;
  pend jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO ini FROM public.strategic_initiatives WHERE id = p_initiative_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Iniciativa inexistente.'; END IF;
  IF nullif(btrim(coalesce(ini.expected_result,'')),'') IS NULL THEN
    pend := pend || jsonb_build_array(jsonb_build_object('code','initiative.expected_result'));
  END IF;
  IF ini.due_date IS NULL THEN
    pend := pend || jsonb_build_array(jsonb_build_object('code','initiative.due_date'));
  END IF;
  IF ini.owner_user_id IS NULL THEN
    pend := pend || jsonb_build_array(jsonb_build_object('code','initiative.owner'));
  END IF;
  RETURN jsonb_build_object(
    'initiative_id', ini.id,
    'status', ini.status,
    'ready', jsonb_array_length(pend) = 0,
    'pendings', pend,
    'issues', pend
  );
END $$;

CREATE OR REPLACE FUNCTION public.f9_submit_initiative_for_review(p_initiative_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ini public.strategic_initiatives%ROWTYPE;
  v_actor uuid := public.current_user_id();
BEGIN
  SELECT * INTO ini FROM public.strategic_initiatives WHERE id = p_initiative_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Iniciativa inexistente.'; END IF;
  IF NOT public.has_permission('initiative.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(ini.business_unit_id)) THEN
    RAISE EXCEPTION 'Permissão negada para enviar iniciativa para revisão.';
  END IF;
  IF ini.status NOT IN ('draft','in_review') THEN
    RAISE EXCEPTION 'Somente iniciativas em rascunho podem ser enviadas para revisão.';
  END IF;
  IF nullif(btrim(coalesce(ini.expected_result,'')),'') IS NULL OR ini.due_date IS NULL THEN
    RAISE EXCEPTION 'Iniciativa incompleta: informe resultado esperado e prazo.';
  END IF;

  UPDATE public.strategic_initiatives
     SET status = 'in_review', submitted_by = v_actor, submitted_at = now(), updated_by = v_actor
   WHERE id = p_initiative_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (ini.organization_id, v_actor, 'f9.initiative.submitted',
          'public.strategic_initiatives', ini.id, 'update', 'rpc',
          jsonb_build_object('from', ini.status, 'to', 'in_review'));

  RETURN public.f9_initiative_readiness(p_initiative_id);
END $$;

CREATE OR REPLACE FUNCTION public.f9_approve_initiative(p_initiative_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ini public.strategic_initiatives%ROWTYPE;
  v_actor uuid := public.current_user_id();
BEGIN
  SELECT * INTO ini FROM public.strategic_initiatives WHERE id = p_initiative_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Iniciativa inexistente.'; END IF;
  IF NOT public.has_permission('initiative.approve'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(ini.business_unit_id)) THEN
    RAISE EXCEPTION 'Permissão negada para aprovar iniciativas.';
  END IF;
  IF ini.status NOT IN ('draft','in_review','approved') THEN
    RAISE EXCEPTION 'Iniciativa não está em estado aprovável.';
  END IF;
  IF nullif(btrim(coalesce(ini.expected_result,'')),'') IS NULL OR ini.due_date IS NULL THEN
    RAISE EXCEPTION 'Iniciativa incompleta: informe resultado esperado e prazo.';
  END IF;

  UPDATE public.strategic_initiatives
     SET status = 'approved', approved_by = v_actor, approved_at = now(),
         approval_notes = nullif(btrim(coalesce(p_notes,'')),''), updated_by = v_actor
   WHERE id = p_initiative_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (ini.organization_id, v_actor, 'f9.initiative.approved',
          'public.strategic_initiatives', ini.id, 'update', 'rpc',
          jsonb_build_object('from', ini.status, 'to', 'approved',
                             'has_notes', nullif(btrim(coalesce(p_notes,'')),'') IS NOT NULL));

  RETURN public.f9_initiative_readiness(p_initiative_id);
END $$;

CREATE OR REPLACE FUNCTION public.f9_activate_initiative(p_initiative_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ini public.strategic_initiatives%ROWTYPE;
  v_actor uuid := public.current_user_id();
  v_ready jsonb;
BEGIN
  SELECT * INTO ini FROM public.strategic_initiatives WHERE id = p_initiative_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Iniciativa inexistente.'; END IF;
  IF NOT public.has_permission('initiative.approve'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(ini.business_unit_id)) THEN
    RAISE EXCEPTION 'Permissão negada para ativar iniciativas.';
  END IF;
  IF ini.status <> 'approved' THEN
    RAISE EXCEPTION 'Somente iniciativas aprovadas podem ser ativadas.';
  END IF;
  v_ready := public.f9_initiative_readiness(p_initiative_id);
  IF NOT (v_ready->>'ready')::boolean THEN
    RAISE EXCEPTION 'Iniciativa incompleta: % pendência(s) impedem a ativação.',
      jsonb_array_length(v_ready->'pendings');
  END IF;

  UPDATE public.strategic_initiatives
     SET status = 'active', updated_by = v_actor
   WHERE id = p_initiative_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (ini.organization_id, v_actor, 'f9.initiative.activated',
          'public.strategic_initiatives', ini.id, 'update', 'rpc',
          jsonb_build_object('from', ini.status, 'to', 'active'));

  RETURN public.f9_initiative_readiness(p_initiative_id);
END $$;

CREATE OR REPLACE FUNCTION public.f9_derive_action_plan(
  p_initiative_id uuid,
  p_due_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ini public.strategic_initiatives%ROWTYPE;
  v_actor uuid := public.current_user_id();
  v_scope uuid;
  v_existing uuid;
  v_new uuid;
  v_due date;
BEGIN
  SELECT * INTO ini FROM public.strategic_initiatives WHERE id = p_initiative_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Iniciativa inexistente.'; END IF;

  v_scope := public.f2_bu_scope_id(ini.business_unit_id);
  IF NOT (public.has_permission('initiative.manage'::public.citext, 'business_unit', v_scope)
          AND public.has_permission('action.manage'::public.citext, 'business_unit', v_scope)) THEN
    RAISE EXCEPTION 'Permissão negada para derivar plano de ação da iniciativa.';
  END IF;

  IF ini.status NOT IN ('approved','active') THEN
    RAISE EXCEPTION 'Somente iniciativas aprovadas ou ativas podem derivar plano de ação.';
  END IF;

  SELECT id INTO v_existing
    FROM public.action_plans
   WHERE initiative_id = ini.id AND status <> 'cancelled'
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('action_plan_id', v_existing, 'created', false);
  END IF;

  v_due := coalesce(ini.due_date, p_due_date);
  IF v_due IS NULL THEN
    RAISE EXCEPTION 'Informe um prazo para o plano de ação derivado.';
  END IF;

  INSERT INTO public.action_plans (
    organization_id, business_unit_id, plan_id, objective_id, kpi_id, initiative_id,
    title, why, expected_result, owner_user_id, start_date, due_date,
    status, progress, origin_type, derived_at, derived_by, created_by, updated_by
  ) VALUES (
    ini.organization_id, ini.business_unit_id, ini.plan_id, ini.objective_id, ini.kpi_id, ini.id,
    ini.title, nullif(btrim(coalesce(ini.description,'')),''),
    nullif(btrim(coalesce(ini.expected_result,'')),''),
    ini.owner_user_id, coalesce(ini.start_date, current_date), v_due,
    'draft', 0, 'initiative', now(), v_actor, v_actor, v_actor
  )
  RETURNING id INTO v_new;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (ini.organization_id, v_actor, 'f9.action_plan.derived',
          'public.action_plans', v_new, 'insert', 'rpc',
          jsonb_build_object('initiative_id', ini.id, 'plan_id', ini.plan_id,
                             'objective_id', ini.objective_id,
                             'has_kpi', ini.kpi_id IS NOT NULL,
                             'inherited_owner', ini.owner_user_id IS NOT NULL));

  RETURN jsonb_build_object('action_plan_id', v_new, 'created', true);
END $$;

REVOKE ALL ON FUNCTION public.f9_initiative_readiness(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f9_submit_initiative_for_review(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f9_approve_initiative(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f9_activate_initiative(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f9_derive_action_plan(uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.f9_initiative_readiness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f9_submit_initiative_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f9_approve_initiative(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f9_activate_initiative(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f9_derive_action_plan(uuid, date) TO authenticated;