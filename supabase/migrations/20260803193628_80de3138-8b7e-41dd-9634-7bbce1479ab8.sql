-- F8-A: alias 'issues' na completude + auditoria do retorno implícito a rascunho

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

  -- edição de identidade devolve apenas a revisão do ciclo para rascunho;
  -- um ciclo já ativo NÃO é desativado automaticamente.
  IF v_identity_changed AND OLD.review_status = 'approved'
     AND NEW.review_status = OLD.review_status THEN
    NEW.review_status := 'draft';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;

    INSERT INTO public.audit_events
      (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
    VALUES (NEW.organization_id, public.current_user_id(), 'f8.plan.reverted_to_draft',
            'public.strategic_plans', NEW.id, 'update', 'trigger',
            jsonb_build_object('version', NEW.version, 'from', 'approved', 'to', 'draft',
                               'reason', 'identity_changed', 'plan_status', NEW.status));
  END IF;

  RETURN NEW;
END $function$;

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

    INSERT INTO public.audit_events
      (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
    VALUES (NEW.organization_id, public.current_user_id(), 'f8.diagnosis.reverted_to_draft',
            'public.plan_diagnostics', NEW.id, 'update', 'trigger',
            jsonb_build_object('from', 'approved', 'to', 'draft',
                               'reason', 'diagnosis_changed', 'plan_id', NEW.plan_id));

    -- o ciclo também deixa de estar aprovado, sem desativar ciclo ativo
    UPDATE public.strategic_plans
       SET review_status = 'draft', approved_by = NULL, approved_at = NULL
     WHERE id = NEW.plan_id AND review_status = 'approved';
  END IF;

  RETURN NEW;
END $function$;

-- completude: expõe as pendências também como 'issues' (mesmo conteúdo)
CREATE OR REPLACE FUNCTION public.f8_plan_completeness(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_base jsonb := public.f8_plan_completeness_core(p_plan_id);
BEGIN
  RETURN v_base || jsonb_build_object('issues', COALESCE(v_base->'pendings','[]'::jsonb));
END $function$;

REVOKE ALL ON FUNCTION public.f8_plan_completeness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f8_plan_completeness(uuid) TO authenticated;