-- =====================================================================
-- F8 — Conclusão do planejamento estratégico (aditiva, idempotente)
-- =====================================================================

-- 1. strategic_plans: identidade estratégica + governança da revisão
ALTER TABLE public.strategic_plans
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS vision text,
  ADD COLUMN IF NOT EXISTS values_text text,
  ADD COLUMN IF NOT EXISTS strategic_north text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'strategic_plans_version_ck') THEN
    ALTER TABLE public.strategic_plans
      ADD CONSTRAINT strategic_plans_version_ck CHECK (version > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'strategic_plans_review_status_ck') THEN
    ALTER TABLE public.strategic_plans
      ADD CONSTRAINT strategic_plans_review_status_ck
      CHECK (review_status IN ('draft','in_review','approved'));
  END IF;
END $$;

-- backfill seguro: ciclo já ativo/encerrado consta como aprovado; rascunho continua rascunho
UPDATE public.strategic_plans
   SET review_status = 'approved'
 WHERE status IN ('active','closed')
   AND review_status = 'draft';

-- 2. plan_diagnostics — um diagnóstico por ciclo
CREATE TABLE IF NOT EXISTS public.plan_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  context_summary text,
  strengths text,
  weaknesses text,
  opportunities text,
  threats text,
  strategic_priorities text,
  assumptions text,
  review_status text NOT NULL DEFAULT 'draft',
  submitted_by uuid REFERENCES public.users(id),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  approval_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT plan_diagnostics_plan_uk UNIQUE (plan_id),
  CONSTRAINT plan_diagnostics_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT plan_diagnostics_review_status_ck
    CHECK (review_status IN ('draft','in_review','approved')),
  CONSTRAINT plan_diagnostics_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id),
  CONSTRAINT plan_diagnostics_plan_fk
    FOREIGN KEY (plan_id, organization_id)
    REFERENCES public.strategic_plans(id, organization_id)
);

CREATE INDEX IF NOT EXISTS plan_diagnostics_bu_idx
  ON public.plan_diagnostics (business_unit_id);

GRANT SELECT, INSERT, UPDATE ON public.plan_diagnostics TO authenticated;
GRANT ALL ON public.plan_diagnostics TO service_role;

ALTER TABLE public.plan_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_diagnostics_select ON public.plan_diagnostics;
CREATE POLICY plan_diagnostics_select ON public.plan_diagnostics
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS plan_diagnostics_insert ON public.plan_diagnostics;
CREATE POLICY plan_diagnostics_insert ON public.plan_diagnostics
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS plan_diagnostics_update ON public.plan_diagnostics;
CREATE POLICY plan_diagnostics_update ON public.plan_diagnostics
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS plan_diagnostics_touch ON public.plan_diagnostics;
CREATE TRIGGER plan_diagnostics_touch BEFORE UPDATE ON public.plan_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS plan_diagnostics_audit ON public.plan_diagnostics;
CREATE TRIGGER plan_diagnostics_audit AFTER INSERT OR UPDATE ON public.plan_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

-- 3. Permissão strategy.approve
INSERT INTO public.permissions (code, description, domain, allowed_scope_types, risk, is_system)
VALUES ('strategy.approve'::public.citext,
        'Aprovar e ativar planejamento estratégico no escopo',
        'strategy', ARRAY['organization','company','business_unit'], 'high', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM public.roles r
  JOIN public.permissions p ON p.code = 'strategy.approve'::public.citext
 WHERE r.code IN ('group_owner'::public.citext, 'group_admin'::public.citext)
   AND NOT EXISTS (
     SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );

-- 4. Guardas de transição — review_status/status nunca por update genérico
CREATE OR REPLACE FUNCTION public.f8_plan_review_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_scope uuid := public.f2_bu_scope_id(NEW.business_unit_id);
  v_can_approve boolean := public.has_permission('strategy.approve'::public.citext, 'business_unit', v_scope);
  v_identity_changed boolean;
BEGIN
  -- aprovação e ativação exigem strategy.approve (RPCs usam o mesmo caminho)
  IF NEW.review_status = 'approved' AND OLD.review_status <> 'approved' AND NOT v_can_approve THEN
    RAISE EXCEPTION 'Somente perfis com strategy.approve podem aprovar o planejamento.';
  END IF;
  IF NEW.status <> OLD.status AND NOT v_can_approve THEN
    RAISE EXCEPTION 'Somente perfis com strategy.approve podem alterar a situação do ciclo.';
  END IF;

  v_identity_changed :=
       COALESCE(NEW.mission,'')          IS DISTINCT FROM COALESCE(OLD.mission,'')
    OR COALESCE(NEW.vision,'')           IS DISTINCT FROM COALESCE(OLD.vision,'')
    OR COALESCE(NEW.values_text,'')      IS DISTINCT FROM COALESCE(OLD.values_text,'')
    OR COALESCE(NEW.strategic_north,'')  IS DISTINCT FROM COALESCE(OLD.strategic_north,'');

  -- edição de conteúdo estratégico devolve apenas a revisão do ciclo para rascunho;
  -- um ciclo já ativo NÃO é desativado automaticamente.
  IF v_identity_changed AND OLD.review_status = 'approved'
     AND NEW.review_status = OLD.review_status THEN
    NEW.review_status := 'draft';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS f8_plan_review_guard_trg ON public.strategic_plans;
CREATE TRIGGER f8_plan_review_guard_trg BEFORE UPDATE ON public.strategic_plans
  FOR EACH ROW EXECUTE FUNCTION public.f8_plan_review_guard();

CREATE OR REPLACE FUNCTION public.f8_diagnostic_review_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_scope uuid := public.f2_bu_scope_id(NEW.business_unit_id);
  v_can_approve boolean := public.has_permission('strategy.approve'::public.citext, 'business_unit', v_scope);
  v_content_changed boolean;
BEGIN
  IF NEW.review_status = 'approved' AND OLD.review_status <> 'approved' AND NOT v_can_approve THEN
    RAISE EXCEPTION 'Somente perfis com strategy.approve podem aprovar o diagnóstico.';
  END IF;

  v_content_changed :=
       COALESCE(NEW.context_summary,'')      IS DISTINCT FROM COALESCE(OLD.context_summary,'')
    OR COALESCE(NEW.strengths,'')            IS DISTINCT FROM COALESCE(OLD.strengths,'')
    OR COALESCE(NEW.weaknesses,'')           IS DISTINCT FROM COALESCE(OLD.weaknesses,'')
    OR COALESCE(NEW.opportunities,'')        IS DISTINCT FROM COALESCE(OLD.opportunities,'')
    OR COALESCE(NEW.threats,'')              IS DISTINCT FROM COALESCE(OLD.threats,'')
    OR COALESCE(NEW.strategic_priorities,'') IS DISTINCT FROM COALESCE(OLD.strategic_priorities,'')
    OR COALESCE(NEW.assumptions,'')          IS DISTINCT FROM COALESCE(OLD.assumptions,'');

  IF v_content_changed AND OLD.review_status = 'approved'
     AND NEW.review_status = OLD.review_status THEN
    NEW.review_status := 'draft';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS f8_diagnostic_review_guard_trg ON public.plan_diagnostics;
CREATE TRIGGER f8_diagnostic_review_guard_trg BEFORE UPDATE ON public.plan_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.f8_diagnostic_review_guard();

-- 5. Completude do planejamento — fonte única de verdade
CREATE OR REPLACE FUNCTION public.f8_plan_completeness(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pl public.strategic_plans%ROWTYPE;
  dg public.plan_diagnostics%ROWTYPE;
  v_pend jsonb := '[]'::jsonb;
  v_obj int; v_obj_no_owner int; v_obj_no_kpi int;
  v_kpi int; v_kpi_no_obj int; v_kpi_incomplete int;
  ok boolean;
BEGIN
  SELECT * INTO pl FROM public.strategic_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'pendings',
      jsonb_build_array(jsonb_build_object('code','plan.missing','section','direction',
        'message','Ciclo estratégico inexistente ou sem permissão de leitura.')));
  END IF;

  IF NOT public.has_permission('strategy.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(pl.business_unit_id)) THEN
    RAISE EXCEPTION 'Permissão negada para ler o planejamento.';
  END IF;

  SELECT * INTO dg FROM public.plan_diagnostics WHERE plan_id = p_plan_id;

  SELECT count(*) INTO v_obj FROM public.strategic_objectives
   WHERE plan_id = p_plan_id AND status <> 'cancelled';
  SELECT count(*) INTO v_obj_no_owner FROM public.strategic_objectives
   WHERE plan_id = p_plan_id AND status <> 'cancelled' AND owner_user_id IS NULL;
  SELECT count(*) INTO v_obj_no_kpi FROM public.strategic_objectives o
   WHERE o.plan_id = p_plan_id AND o.status <> 'cancelled'
     AND NOT EXISTS (SELECT 1 FROM public.kpis k
                      WHERE k.objective_id = o.id AND k.status <> 'archived');
  SELECT count(*) INTO v_kpi FROM public.kpis
   WHERE plan_id = p_plan_id AND status <> 'archived';
  SELECT count(*) INTO v_kpi_no_obj FROM public.kpis
   WHERE plan_id = p_plan_id AND status <> 'archived' AND objective_id IS NULL;
  SELECT count(*) INTO v_kpi_incomplete FROM public.kpis
   WHERE plan_id = p_plan_id AND status <> 'archived'
     AND (btrim(coalesce(formula,'')) = '' OR btrim(coalesce(source,'')) = ''
       OR btrim(coalesce(unit,'')) = '' OR owner_user_id IS NULL
       OR baseline_value IS NULL OR target_value IS NULL);

  IF btrim(coalesce(pl.mission,'')) = '' THEN
    v_pend := v_pend || jsonb_build_object('code','identity.mission','section','direction',
      'message','Missão não preenchida.');
  END IF;
  IF btrim(coalesce(pl.vision,'')) = '' THEN
    v_pend := v_pend || jsonb_build_object('code','identity.vision','section','direction',
      'message','Visão não preenchida.');
  END IF;
  IF btrim(coalesce(pl.values_text,'')) = '' THEN
    v_pend := v_pend || jsonb_build_object('code','identity.values','section','direction',
      'message','Valores não preenchidos.');
  END IF;
  IF btrim(coalesce(pl.strategic_north,'')) = '' THEN
    v_pend := v_pend || jsonb_build_object('code','identity.north','section','direction',
      'message','Norte estratégico não preenchido.');
  END IF;

  IF dg.id IS NULL THEN
    v_pend := v_pend || jsonb_build_object('code','diagnosis.missing','section','diagnosis',
      'message','Diagnóstico do ciclo ainda não iniciado.');
  ELSE
    IF btrim(coalesce(dg.context_summary,'')) = '' THEN
      v_pend := v_pend || jsonb_build_object('code','diagnosis.context','section','diagnosis',
        'message','Resumo de contexto não preenchido.'); END IF;
    IF btrim(coalesce(dg.strengths,'')) = '' THEN
      v_pend := v_pend || jsonb_build_object('code','diagnosis.strengths','section','diagnosis',
        'message','Forças não preenchidas.'); END IF;
    IF btrim(coalesce(dg.weaknesses,'')) = '' THEN
      v_pend := v_pend || jsonb_build_object('code','diagnosis.weaknesses','section','diagnosis',
        'message','Fraquezas não preenchidas.'); END IF;
    IF btrim(coalesce(dg.opportunities,'')) = '' THEN
      v_pend := v_pend || jsonb_build_object('code','diagnosis.opportunities','section','diagnosis',
        'message','Oportunidades não preenchidas.'); END IF;
    IF btrim(coalesce(dg.threats,'')) = '' THEN
      v_pend := v_pend || jsonb_build_object('code','diagnosis.threats','section','diagnosis',
        'message','Ameaças não preenchidas.'); END IF;
    IF btrim(coalesce(dg.strategic_priorities,'')) = '' THEN
      v_pend := v_pend || jsonb_build_object('code','diagnosis.priorities','section','diagnosis',
        'message','Prioridades estratégicas não preenchidas.'); END IF;
  END IF;

  IF v_obj < 3 THEN
    v_pend := v_pend || jsonb_build_object('code','objectives.min','section','objectives',
      'message','O ciclo precisa de ao menos 3 objetivos ativos.');
  END IF;
  IF v_obj > 7 THEN
    v_pend := v_pend || jsonb_build_object('code','objectives.max','section','objectives',
      'message','O ciclo não deve passar de 7 objetivos ativos.');
  END IF;
  IF v_obj_no_owner > 0 THEN
    v_pend := v_pend || jsonb_build_object('code','objectives.owner','section','objectives',
      'message', v_obj_no_owner || ' objetivo(s) sem responsável definido.');
  END IF;
  IF v_obj_no_kpi > 0 THEN
    v_pend := v_pend || jsonb_build_object('code','objectives.kpi','section','objectives',
      'message', v_obj_no_kpi || ' objetivo(s) sem indicador vinculado.');
  END IF;

  IF v_kpi = 0 THEN
    v_pend := v_pend || jsonb_build_object('code','kpis.min','section','kpis',
      'message','Nenhum indicador ativo cadastrado no ciclo.');
  END IF;
  IF v_kpi_no_obj > 0 THEN
    v_pend := v_pend || jsonb_build_object('code','kpis.objective','section','kpis',
      'message', v_kpi_no_obj || ' indicador(es) sem objetivo vinculado.');
  END IF;
  IF v_kpi_incomplete > 0 THEN
    v_pend := v_pend || jsonb_build_object('code','kpis.config','section','kpis',
      'message', v_kpi_incomplete || ' indicador(es) sem fórmula, fonte, unidade, responsável, baseline ou meta.');
  END IF;

  IF pl.cycle_start IS NULL OR pl.cycle_end IS NULL OR pl.cycle_end <= pl.cycle_start THEN
    v_pend := v_pend || jsonb_build_object('code','cycle.period','section','direction',
      'message','Período do ciclo inválido.');
  END IF;

  ok := jsonb_array_length(v_pend) = 0;

  RETURN jsonb_build_object(
    'ready', ok,
    'planId', pl.id,
    'version', pl.version,
    'status', pl.status,
    'reviewStatus', pl.review_status,
    'diagnosisReviewStatus', dg.review_status,
    'counts', jsonb_build_object(
      'objectives', v_obj,
      'objectivesWithoutOwner', v_obj_no_owner,
      'objectivesWithoutKpi', v_obj_no_kpi,
      'kpis', v_kpi,
      'kpisWithoutObjective', v_kpi_no_obj,
      'kpisIncomplete', v_kpi_incomplete
    ),
    'pendings', v_pend
  );
END $function$;

REVOKE ALL ON FUNCTION public.f8_plan_completeness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f8_plan_completeness(uuid) TO authenticated;

-- 6. RPCs de workflow
CREATE OR REPLACE FUNCTION public.f8_submit_plan_for_review(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pl public.strategic_plans%ROWTYPE;
  v_actor uuid := public.current_user_id();
  v_scope uuid;
  v_comp jsonb;
  v_obj int;
BEGIN
  SELECT * INTO pl FROM public.strategic_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ciclo estratégico inexistente.'; END IF;
  v_scope := public.f2_bu_scope_id(pl.business_unit_id);
  IF NOT public.has_permission('strategy.manage'::public.citext, 'business_unit', v_scope) THEN
    RAISE EXCEPTION 'Permissão negada para enviar o planejamento para revisão.';
  END IF;
  IF pl.review_status = 'in_review' THEN RAISE EXCEPTION 'O planejamento já está em revisão.'; END IF;
  IF pl.review_status = 'approved' THEN RAISE EXCEPTION 'O planejamento já está aprovado.'; END IF;

  v_comp := public.f8_plan_completeness(p_plan_id);

  -- submissão exige identidade + diagnóstico completos e ao menos 3 objetivos
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_comp->'pendings') e
     WHERE e->>'section' IN ('direction','diagnosis')
        OR e->>'code' = 'objectives.min'
  ) THEN
    RAISE EXCEPTION 'Complete direcionamento, diagnóstico e ao menos 3 objetivos antes de enviar para revisão.';
  END IF;
  SELECT (v_comp->'counts'->>'objectives')::int INTO v_obj;

  UPDATE public.strategic_plans
     SET review_status = 'in_review', submitted_by = v_actor, submitted_at = now(),
         updated_by = v_actor
   WHERE id = p_plan_id;

  UPDATE public.plan_diagnostics
     SET review_status = 'in_review', submitted_by = v_actor, submitted_at = now(),
         updated_by = v_actor
   WHERE plan_id = p_plan_id AND review_status = 'draft';

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (pl.organization_id, v_actor, 'f8.plan.submitted', 'public.strategic_plans',
          p_plan_id, 'update', 'rpc',
          jsonb_build_object('version', pl.version, 'from', pl.review_status,
                             'to', 'in_review', 'objectives', v_obj));
  RETURN v_comp;
END $function$;

CREATE OR REPLACE FUNCTION public.f8_approve_plan(p_plan_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pl public.strategic_plans%ROWTYPE;
  v_actor uuid := public.current_user_id();
  v_scope uuid;
  v_comp jsonb;
  v_codes jsonb;
BEGIN
  SELECT * INTO pl FROM public.strategic_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ciclo estratégico inexistente.'; END IF;
  v_scope := public.f2_bu_scope_id(pl.business_unit_id);
  IF NOT public.has_permission('strategy.approve'::public.citext, 'business_unit', v_scope) THEN
    RAISE EXCEPTION 'Permissão negada para aprovar o planejamento.';
  END IF;

  v_comp := public.f8_plan_completeness(p_plan_id);
  IF NOT (v_comp->>'ready')::boolean THEN
    SELECT jsonb_agg(e->>'code') INTO v_codes FROM jsonb_array_elements(v_comp->'pendings') e;
    INSERT INTO public.audit_events
      (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
    VALUES (pl.organization_id, v_actor, 'f8.plan.approval_rejected', 'public.strategic_plans',
            p_plan_id, 'update', 'rpc',
            jsonb_build_object('version', pl.version, 'pendings', coalesce(v_codes,'[]'::jsonb)));
    RAISE EXCEPTION 'Planejamento incompleto: % pendência(s) impedem a aprovação.',
      jsonb_array_length(v_comp->'pendings');
  END IF;

  UPDATE public.strategic_plans
     SET review_status = 'approved', approved_by = v_actor, approved_at = now(),
         approval_notes = nullif(btrim(coalesce(p_notes,'')),''), updated_by = v_actor
   WHERE id = p_plan_id;

  UPDATE public.plan_diagnostics
     SET review_status = 'approved', approved_by = v_actor, approved_at = now(),
         approval_notes = nullif(btrim(coalesce(p_notes,'')),''), updated_by = v_actor
   WHERE plan_id = p_plan_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (pl.organization_id, v_actor, 'f8.plan.approved', 'public.strategic_plans',
          p_plan_id, 'update', 'rpc',
          jsonb_build_object('version', pl.version, 'from', pl.review_status, 'to', 'approved',
                             'has_notes', nullif(btrim(coalesce(p_notes,'')),'') IS NOT NULL));
  RETURN public.f8_plan_completeness(p_plan_id);
END $function$;

CREATE OR REPLACE FUNCTION public.f8_activate_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pl public.strategic_plans%ROWTYPE;
  v_actor uuid := public.current_user_id();
  v_scope uuid;
  v_comp jsonb;
  v_codes jsonb;
BEGIN
  SELECT * INTO pl FROM public.strategic_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ciclo estratégico inexistente.'; END IF;
  v_scope := public.f2_bu_scope_id(pl.business_unit_id);
  IF NOT public.has_permission('strategy.approve'::public.citext, 'business_unit', v_scope) THEN
    RAISE EXCEPTION 'Permissão negada para ativar o ciclo.';
  END IF;
  IF pl.status = 'closed' THEN RAISE EXCEPTION 'Ciclo encerrado não pode ser ativado.'; END IF;
  IF pl.review_status <> 'approved' THEN
    RAISE EXCEPTION 'O planejamento precisa estar aprovado antes da ativação.';
  END IF;

  v_comp := public.f8_plan_completeness(p_plan_id);
  IF NOT (v_comp->>'ready')::boolean THEN
    SELECT jsonb_agg(e->>'code') INTO v_codes FROM jsonb_array_elements(v_comp->'pendings') e;
    INSERT INTO public.audit_events
      (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
    VALUES (pl.organization_id, v_actor, 'f8.plan.activation_rejected', 'public.strategic_plans',
            p_plan_id, 'update', 'rpc',
            jsonb_build_object('version', pl.version, 'pendings', coalesce(v_codes,'[]'::jsonb)));
    RAISE EXCEPTION 'Planejamento incompleto: % pendência(s) impedem a ativação.',
      jsonb_array_length(v_comp->'pendings');
  END IF;

  UPDATE public.strategic_plans
     SET status = 'active', updated_by = v_actor
   WHERE id = p_plan_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES (pl.organization_id, v_actor, 'f8.plan.activated', 'public.strategic_plans',
          p_plan_id, 'update', 'rpc',
          jsonb_build_object('version', pl.version, 'from', pl.status, 'to', 'active'));
  RETURN public.f8_plan_completeness(p_plan_id);
END $function$;

REVOKE ALL ON FUNCTION public.f8_submit_plan_for_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f8_approve_plan(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f8_activate_plan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f8_plan_review_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f8_diagnostic_review_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f8_submit_plan_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f8_approve_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f8_activate_plan(uuid) TO authenticated;