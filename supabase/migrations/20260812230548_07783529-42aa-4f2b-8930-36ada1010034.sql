-- F12.1-C2A.1 — confirmação server-authoritative + trigger endurecida + gate na aplicação.

CREATE OR REPLACE FUNCTION public.f12_invalidate_diagnosis_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_bu uuid;
  v_org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_bu := OLD.business_unit_id;
    v_org := OLD.organization_id;
  ELSE
    v_bu := NEW.business_unit_id;
    v_org := NEW.organization_id;
  END IF;

  UPDATE public.company_strategy_profiles
     SET diagnosis_reviewed_at = NULL,
         diagnosis_reviewed_by = NULL
   WHERE business_unit_id = v_bu
     AND organization_id = v_org
     AND diagnosis_reviewed_at IS NOT NULL;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.f12_invalidate_diagnosis_review() FROM PUBLIC;

-- Confirmação da revisão do diagnóstico: autoria e horário são autoridade do banco.
CREATE OR REPLACE FUNCTION public.f12_confirm_diagnosis_review(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile public.company_strategy_profiles%ROWTYPE;
  v_scope   uuid;
  v_user    uuid;
  v_at      timestamptz;
BEGIN
  SELECT * INTO v_profile
    FROM public.company_strategy_profiles
   WHERE id = p_profile_id;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_found',
      'message', 'Perfil estratégico não encontrado para esta unidade.');
  END IF;

  v_scope := public.f2_bu_scope_id(v_profile.business_unit_id);
  IF NOT public.has_permission('strategy.manage'::public.citext, 'business_unit', v_scope) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden',
      'message', 'Você não tem permissão para gerir o planejamento desta unidade.');
  END IF;

  v_user := public.current_user_id();

  UPDATE public.company_strategy_profiles
     SET diagnosis_reviewed_at = now(),
         diagnosis_reviewed_by = v_user,
         updated_by = v_user
   WHERE id = p_profile_id
  RETURNING diagnosis_reviewed_at INTO v_at;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, metadata, source)
  VALUES (v_profile.organization_id, v_user, 'strategy.diagnosis_reviewed',
          'company_strategy_profiles', p_profile_id, 'confirm',
          jsonb_build_object('businessUnitId', v_profile.business_unit_id), 'f12');

  RETURN jsonb_build_object('ok', true,
    'diagnosisReviewedAt', v_at,
    'diagnosisReviewedBy', v_user,
    'message', 'Revisão do diagnóstico registrada.');
END;
$function$;

REVOKE ALL ON FUNCTION public.f12_confirm_diagnosis_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f12_confirm_diagnosis_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f12_confirm_diagnosis_review(uuid) TO service_role;

-- Aplicação do rascunho: preserva A+B+C1 e passa a exigir diagnóstico revisado.
CREATE OR REPLACE FUNCTION public.f12_apply_strategy_draft(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_plan        public.strategic_plans%ROWTYPE;
  v_scope       uuid;
  v_user        uuid;
  v_existing    integer;
  v_pending     integer;
  v_final       integer;
  v_capacity    integer;
  v_missing     integer;
  v_priorities  integer;
  v_a_total     integer;
  v_a_answered  integer;
  v_reviewed    timestamptz;
  v_pillar      uuid;
  v_title       text;
  v_aliases     text[];
  v_created_obj integer := 0;
  v_created_kpi integer := 0;
  v_rec         record;
  v_kpi         record;
  v_new_obj     uuid;
  v_new_kpi     uuid;
  v_next_sort   integer;
BEGIN
  SELECT * INTO v_plan FROM public.strategic_plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_not_found',
      'message', 'Ciclo de planejamento não encontrado.');
  END IF;

  v_scope := public.f2_bu_scope_id(v_plan.business_unit_id);
  IF NOT public.has_permission('strategy.manage'::public.citext, 'business_unit', v_scope) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden',
      'message', 'Você não tem permissão para alterar o planejamento desta unidade.');
  END IF;

  IF v_plan.status <> 'draft' OR coalesce(v_plan.review_status, 'draft') <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_not_editable',
      'message', 'Só é possível aplicar o rascunho em um ciclo em rascunho, ainda não enviado para revisão nem ativado.');
  END IF;

  SELECT count(*) INTO v_existing
    FROM public.strategic_objectives
   WHERE plan_id = p_plan_id AND status <> 'cancelled';

  SELECT count(*) INTO v_pending
    FROM public.strategy_recommendation_decisions d
   WHERE d.business_unit_id = v_plan.business_unit_id
     AND d.decision = 'accepted'
     AND d.applied_objective_id IS NULL;

  v_final := v_existing + v_pending;
  v_capacity := GREATEST(7 - v_existing, 0);

  IF v_existing > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_over_limit',
      'message', 'Este ciclo já tem mais de 7 objetivos ativos. Ajuste o planejamento antes de aplicar o rascunho.',
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  IF v_final > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many',
      'message', 'Este ciclo comporta até ' || v_capacity || ' novo(s) objetivo(s). Reduza a seleção para manter no máximo 7 no total.',
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  IF v_final < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_few',
      'message', 'O ciclo precisa terminar com ao menos 3 objetivos. Hoje há ' || v_existing || ' e você selecionou ' || v_pending || '.',
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  -- Questionário de maturidade precisa estar completo antes de aplicar o rascunho.
  SELECT count(*) INTO v_a_total
    FROM public.strategy_assessment_questions q
   WHERE q.version = public.f12_assessment_version()
     AND q.status = 'active';

  SELECT count(*) INTO v_a_answered
    FROM public.strategy_assessment_answers a
    JOIN public.strategy_assessment_questions q ON q.id = a.question_id
   WHERE a.business_unit_id = v_plan.business_unit_id
     AND q.version = public.f12_assessment_version()
     AND q.status = 'active';

  IF v_a_total = 0 OR v_a_answered < v_a_total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'assessment_incomplete',
      'message', 'Complete o diagnóstico de maturidade antes de levar o rascunho ao planejamento.',
      'assessmentAnswered', v_a_answered, 'assessmentTotal', v_a_total,
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  -- F12.1-C2A.1 — revisão explícita do diagnóstico guiado da MESMA org + unidade do plano.
  SELECT p.diagnosis_reviewed_at INTO v_reviewed
    FROM public.company_strategy_profiles p
   WHERE p.business_unit_id = v_plan.business_unit_id
     AND p.organization_id = v_plan.organization_id
   LIMIT 1;

  IF v_reviewed IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'diagnosis_not_reviewed',
      'message', 'Conclua a revisão do diagnóstico antes de levar o rascunho ao planejamento.',
      'diagnosisReviewed', false,
      'assessmentAnswered', v_a_answered, 'assessmentTotal', v_a_total,
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  -- Decisão humana explícita de prioridades: 1 a 3 temas.
  SELECT count(*) INTO v_priorities
    FROM public.strategy_priority_selections s
   WHERE s.business_unit_id = v_plan.business_unit_id
     AND s.selected IS TRUE;

  IF v_priorities = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_priority_selection',
      'message', 'Escolha de 1 a 3 temas prioritários da liderança antes de levar o rascunho ao planejamento.',
      'prioritiesSelected', v_priorities, 'diagnosisReviewed', true,
      'assessmentAnswered', v_a_answered, 'assessmentTotal', v_a_total,
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  IF v_priorities > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_priorities',
      'message', 'Selecione no máximo 3 temas prioritários para este ciclo.',
      'prioritiesSelected', v_priorities, 'diagnosisReviewed', true,
      'assessmentAnswered', v_a_answered, 'assessmentTotal', v_a_total,
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  -- Fonte de verdade: todo objetivo aceito precisa de ao menos 1 indicador escolhido.
  SELECT count(*) INTO v_missing
    FROM public.strategy_recommendation_decisions d
   WHERE d.business_unit_id = v_plan.business_unit_id
     AND d.decision = 'accepted'
     AND d.applied_objective_id IS NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.strategy_recommendation_kpi_decisions k
         JOIN public.strategy_template_kpis tk ON tk.id = k.template_kpi_id
        WHERE k.business_unit_id = d.business_unit_id
          AND k.decision = 'accepted'
          AND k.template_objective_id = d.template_objective_id
          AND tk.template_objective_id = d.template_objective_id
     );

  IF v_missing > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_kpi_selection',
      'message', 'Selecione pelo menos um indicador para cada objetivo antes de levar o rascunho ao planejamento.',
      'objectivesWithoutKpi', v_missing, 'diagnosisReviewed', true,
      'existingObjectives', v_existing, 'pendingObjectives', v_pending,
      'finalObjectives', v_final, 'capacityRemaining', v_capacity);
  END IF;

  v_user := public.current_user_id();

  FOR v_rec IN
    SELECT d.id AS decision_id,
           d.template_objective_id,
           t.dimension,
           COALESCE(d.custom_title, t.title) AS final_title,
           COALESCE(d.custom_description, t.description) AS final_description
      FROM public.strategy_recommendation_decisions d
      JOIN public.strategy_template_objectives t ON t.id = d.template_objective_id
     WHERE d.business_unit_id = v_plan.business_unit_id
       AND d.decision = 'accepted'
       AND d.applied_objective_id IS NULL
     ORDER BY t.sort_order
     FOR UPDATE OF d
  LOOP
    v_title := public.f12_dimension_pillar_title(v_rec.dimension);
    v_aliases := public.f12_dimension_pillar_aliases(v_rec.dimension);

    SELECT id INTO v_pillar
      FROM public.strategic_pillars
     WHERE plan_id = p_plan_id
       AND status <> 'archived'
       AND lower(btrim(title)) = ANY (v_aliases)
     ORDER BY sort_order, created_at
     LIMIT 1;

    IF v_pillar IS NULL THEN
      SELECT coalesce(max(sort_order), 0) + 1 INTO v_next_sort
        FROM public.strategic_pillars WHERE plan_id = p_plan_id;

      INSERT INTO public.strategic_pillars
        (organization_id, business_unit_id, plan_id, title, description, sort_order, status, created_by, updated_by)
      VALUES (v_plan.organization_id, v_plan.business_unit_id, p_plan_id, v_title,
              'Pilar criado a partir da Jornada Estratégica.', v_next_sort, 'active', v_user, v_user)
      RETURNING id INTO v_pillar;
    END IF;

    INSERT INTO public.strategic_objectives
      (organization_id, business_unit_id, plan_id, pillar_id, title, description,
       status, progress, created_by, updated_by)
    VALUES (v_plan.organization_id, v_plan.business_unit_id, p_plan_id, v_pillar,
            v_rec.final_title, v_rec.final_description, 'draft', 0, v_user, v_user)
    RETURNING id INTO v_new_obj;

    v_created_obj := v_created_obj + 1;

    UPDATE public.strategy_recommendation_decisions
       SET applied_objective_id = v_new_obj,
           applied_at = now(),
           updated_by = v_user
     WHERE id = v_rec.decision_id
       AND applied_objective_id IS NULL;

    FOR v_kpi IN
      SELECT k.id AS decision_id, tk.name, tk.description, tk.unit, tk.formula,
             tk.direction, tk.frequency
        FROM public.strategy_recommendation_kpi_decisions k
        JOIN public.strategy_template_kpis tk ON tk.id = k.template_kpi_id
       WHERE k.business_unit_id = v_plan.business_unit_id
         AND k.decision = 'accepted'
         AND k.applied_kpi_id IS NULL
         AND k.template_objective_id = v_rec.template_objective_id
         AND tk.template_objective_id = v_rec.template_objective_id
       ORDER BY tk.sort_order
       FOR UPDATE OF k
    LOOP
      INSERT INTO public.kpis
        (organization_id, business_unit_id, plan_id, pillar_id, objective_id,
         name, description, unit, formula, source, frequency, direction,
         baseline_value, target_value, owner_user_id, status, created_by, updated_by)
      VALUES (v_plan.organization_id, v_plan.business_unit_id, p_plan_id, v_pillar, v_new_obj,
              v_kpi.name, v_kpi.description, v_kpi.unit, v_kpi.formula, NULL,
              v_kpi.frequency, v_kpi.direction, NULL, NULL, NULL, 'draft', v_user, v_user)
      RETURNING id INTO v_new_kpi;

      v_created_kpi := v_created_kpi + 1;

      UPDATE public.strategy_recommendation_kpi_decisions
         SET applied_kpi_id = v_new_kpi,
             applied_at = now(),
             updated_by = v_user
       WHERE id = v_kpi.decision_id
         AND applied_kpi_id IS NULL;
    END LOOP;
  END LOOP;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, metadata, source)
  VALUES (v_plan.organization_id, v_user, 'strategy.draft_applied', 'strategic_plans', p_plan_id, 'apply',
          jsonb_build_object('objectives', v_created_obj, 'kpis', v_created_kpi,
            'existingObjectives', v_existing, 'finalObjectives', v_final,
            'prioritiesSelected', v_priorities, 'diagnosisReviewed', true,
            'assessmentAnswered', v_a_answered, 'assessmentTotal', v_a_total,
            'businessUnitId', v_plan.business_unit_id), 'f12');

  RETURN jsonb_build_object('ok', true, 'planId', p_plan_id,
    'objectivesCreated', v_created_obj, 'kpisCreated', v_created_kpi,
    'existingObjectives', v_existing, 'pendingObjectives', v_pending,
    'finalObjectives', v_final, 'capacityRemaining', GREATEST(7 - v_final, 0),
    'prioritiesSelected', v_priorities, 'diagnosisReviewed', true,
    'assessmentAnswered', v_a_answered, 'assessmentTotal', v_a_total,
    'message', 'Rascunho aplicado ao planejamento. Fonte, responsáveis, baseline e metas continuam pendentes de validação.');
END;
$function$;

REVOKE ALL ON FUNCTION public.f12_apply_strategy_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f12_apply_strategy_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.f12_apply_strategy_draft(uuid) TO service_role;