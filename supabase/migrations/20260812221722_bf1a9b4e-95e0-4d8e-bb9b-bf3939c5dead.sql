CREATE OR REPLACE FUNCTION public.f12_dimension_pillar_title(p_dimension text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE p_dimension
    WHEN 'finance' THEN 'Finanças'
    WHEN 'marketing_sales' THEN 'Marketing e Vendas'
    WHEN 'operations' THEN 'Operações'
    WHEN 'people' THEN 'Pessoas'
    WHEN 'governance' THEN 'Governança'
    ELSE 'Direção estratégica'
  END
$$;

REVOKE ALL ON FUNCTION public.f12_dimension_pillar_title(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f12_dimension_pillar_title(text) TO authenticated, service_role;

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
  v_pillar      uuid;
  v_title       text;
  v_created_obj integer := 0;
  v_rec         record;
  v_new_obj     uuid;
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

  -- Ciclo elegível: rascunho editável em ambos os eixos do F8.
  IF v_plan.status <> 'draft' OR coalesce(v_plan.review_status, 'draft') <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_not_editable',
      'message', 'Só é possível aplicar o rascunho em um ciclo em rascunho, ainda não enviado para revisão nem ativado.');
  END IF;

  -- Objetivo válido: mesmo conceito do F8 (status <> 'cancelled').
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

  v_user := public.current_user_id();

  FOR v_rec IN
    SELECT d.id AS decision_id,
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

    -- A) pilar compatível já existente no ciclo
    SELECT id INTO v_pillar
      FROM public.strategic_pillars
     WHERE plan_id = p_plan_id
       AND status <> 'archived'
       AND lower(btrim(title)) = lower(v_title)
     ORDER BY sort_order, created_at
     LIMIT 1;

    -- B) criar pilar canônico da dimensão apenas neste ciclo
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
  END LOOP;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, metadata, source)
  VALUES (v_plan.organization_id, v_user, 'strategy.draft_applied', 'strategic_plans', p_plan_id, 'apply',
          jsonb_build_object('objectives', v_created_obj, 'existingObjectives', v_existing,
            'finalObjectives', v_final, 'businessUnitId', v_plan.business_unit_id), 'f12');

  RETURN jsonb_build_object('ok', true, 'planId', p_plan_id,
    'objectivesCreated', v_created_obj, 'kpisCreated', 0,
    'existingObjectives', v_existing, 'pendingObjectives', v_pending,
    'finalObjectives', v_final, 'capacityRemaining', GREATEST(7 - v_final, 0),
    'message', 'Rascunho aplicado ao planejamento como rascunho, sem indicadores, responsáveis nem metas.');
END;
$function$;

REVOKE ALL ON FUNCTION public.f12_apply_strategy_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f12_apply_strategy_draft(uuid) TO authenticated;