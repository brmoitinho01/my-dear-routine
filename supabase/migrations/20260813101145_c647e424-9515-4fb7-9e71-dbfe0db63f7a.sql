-- F8.1-A.1 — autoria server-authoritative em plan_direction_choices
CREATE OR REPLACE FUNCTION public.f81_touch_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := public.current_user_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := v_user;
    NEW.updated_by := v_user;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.updated_by := v_user;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.f81_touch_authorship() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_plan_direction_choices_authorship ON public.plan_direction_choices;
CREATE TRIGGER trg_plan_direction_choices_authorship
BEFORE INSERT OR UPDATE ON public.plan_direction_choices
FOR EACH ROW EXECUTE FUNCTION public.f81_touch_authorship();

-- F8.1-A.1 — confirmação atômica: escolhas estruturadas + identidade oficial
CREATE OR REPLACE FUNCTION public.f8_confirm_structured_direction(
  p_plan_id uuid,
  p_choices jsonb,
  p_identity jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_plan    public.strategic_plans%ROWTYPE;
  v_scope   uuid;
  v_user    uuid;
  v_focus   text[];
  v_props   text[];
  v_edges   text[];
  v_values  text[];
  v_amb     text;
  v_dim     text;
  v_cf      text;
  v_cvp     text;
  v_cce     text;
  v_id      uuid;
  v_created boolean := false;
BEGIN
  SELECT * INTO v_plan FROM public.strategic_plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_not_found',
      'message', 'Ciclo de planejamento não encontrado.');
  END IF;

  v_scope := public.f2_bu_scope_id(v_plan.business_unit_id);
  IF NOT public.has_permission('strategy.manage'::public.citext, 'business_unit', v_scope) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden',
      'message', 'Você não tem permissão para gerir o planejamento desta unidade.');
  END IF;

  IF COALESCE(v_plan.review_status, 'draft') = 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_locked',
      'message', 'Ciclo aprovado: o direcionamento não pode ser alterado sem uma revisão do ciclo.');
  END IF;

  -- normalização do payload (o cliente nunca informa organização, unidade ou autoria)
  SELECT COALESCE(array_agg(x), '{}'::text[]) INTO v_focus
    FROM jsonb_array_elements_text(COALESCE(p_choices->'focusGroups', '[]'::jsonb)) x;
  SELECT COALESCE(array_agg(x), '{}'::text[]) INTO v_props
    FROM jsonb_array_elements_text(COALESCE(p_choices->'valuePropositions', '[]'::jsonb)) x;
  SELECT COALESCE(array_agg(x), '{}'::text[]) INTO v_edges
    FROM jsonb_array_elements_text(COALESCE(p_choices->'competitiveEdges', '[]'::jsonb)) x;
  SELECT COALESCE(array_agg(x), '{}'::text[]) INTO v_values
    FROM jsonb_array_elements_text(COALESCE(p_choices->'valueCodes', '[]'::jsonb)) x;

  v_amb := NULLIF(btrim(COALESCE(p_choices->>'ambition', '')), '');
  v_dim := NULLIF(btrim(COALESCE(p_choices->>'priorityDimension', '')), '');
  v_cf  := NULLIF(btrim(COALESCE(p_choices->>'customFocus', '')), '');
  v_cvp := NULLIF(btrim(COALESCE(p_choices->>'customValueProposition', '')), '');
  v_cce := NULLIF(btrim(COALESCE(p_choices->>'customCompetitiveEdge', '')), '');

  -- cardinalidades (mesmas regras da camada pura DIRECTION_LIMITS)
  IF array_length(v_focus, 1) IS NULL OR array_length(v_focus, 1) > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_focus',
      'message', 'Selecione de 1 a 3 focos do ciclo.');
  END IF;
  IF array_length(v_props, 1) IS NULL OR array_length(v_props, 1) > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_value_propositions',
      'message', 'Selecione de 1 a 3 entregas de valor.');
  END IF;
  IF array_length(v_edges, 1) IS NULL OR array_length(v_edges, 1) > 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_competitive_edges',
      'message', 'Selecione 1 ou 2 formas de competir.');
  END IF;
  IF array_length(v_values, 1) IS NULL OR array_length(v_values, 1) < 3
     OR array_length(v_values, 1) > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_value_codes',
      'message', 'Selecione de 3 a 5 comportamentos inegociáveis.');
  END IF;
  IF v_amb IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_ambition',
      'message', 'Escolha a principal ambição do ciclo.');
  END IF;
  IF v_dim IS NULL OR v_dim NOT IN ('finance','marketing_sales','operations','people','governance') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_priority_dimension',
      'message', 'Escolha um tema prioritário válido.');
  END IF;

  -- "Outro" exige o texto correspondente
  IF 'other' = ANY(v_focus) AND v_cf IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_custom_focus',
      'message', 'Descreva o outro foco escolhido.');
  END IF;
  IF 'other' = ANY(v_props) AND v_cvp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_custom_value_proposition',
      'message', 'Descreva a outra entrega de valor escolhida.');
  END IF;
  IF 'other' = ANY(v_edges) AND v_cce IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_custom_competitive_edge',
      'message', 'Descreva a outra forma de competir escolhida.');
  END IF;

  v_user := public.current_user_id();

  SELECT id INTO v_id FROM public.plan_direction_choices WHERE plan_id = p_plan_id;

  IF v_id IS NULL THEN
    INSERT INTO public.plan_direction_choices
      (organization_id, business_unit_id, plan_id, focus_groups, value_propositions,
       competitive_edges, ambition, value_codes, priority_dimension,
       custom_focus, custom_value_proposition, custom_competitive_edge)
    VALUES
      (v_plan.organization_id, v_plan.business_unit_id, p_plan_id, v_focus, v_props,
       v_edges, v_amb, v_values, v_dim, v_cf, v_cvp, v_cce)
    RETURNING id INTO v_id;
    v_created := true;
  ELSE
    UPDATE public.plan_direction_choices
       SET focus_groups = v_focus,
           value_propositions = v_props,
           competitive_edges = v_edges,
           ambition = v_amb,
           value_codes = v_values,
           priority_dimension = v_dim,
           custom_focus = v_cf,
           custom_value_proposition = v_cvp,
           custom_competitive_edge = v_cce
     WHERE id = v_id;
  END IF;

  -- identidade oficial na MESMA transação; workflow/versão preservados pelos guards do F8
  UPDATE public.strategic_plans
     SET mission         = NULLIF(btrim(COALESCE(p_identity->>'mission', '')), ''),
         vision          = NULLIF(btrim(COALESCE(p_identity->>'vision', '')), ''),
         values_text     = NULLIF(btrim(COALESCE(p_identity->>'valuesText', '')), ''),
         strategic_north = NULLIF(btrim(COALESCE(p_identity->>'strategicNorth', '')), ''),
         updated_by      = v_user
   WHERE id = p_plan_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, metadata, source)
  VALUES (v_plan.organization_id, v_user, 'f8.direction.structured_confirmed',
          'public.plan_direction_choices', v_id,
          CASE WHEN v_created THEN 'insert' ELSE 'update' END,
          jsonb_build_object('planId', p_plan_id,
                             'businessUnitId', v_plan.business_unit_id,
                             'priorityDimension', v_dim,
                             'ambition', v_amb,
                             'focusCount', array_length(v_focus, 1),
                             'valueCount', array_length(v_values, 1)),
          'f8.1-a.1');

  RETURN jsonb_build_object('ok', true, 'choicesId', v_id, 'created', v_created,
    'message', 'Direcionamento estratégico registrado a partir das suas escolhas.');
END $$;

REVOKE ALL ON FUNCTION public.f8_confirm_structured_direction(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f8_confirm_structured_direction(uuid, jsonb, jsonb) TO authenticated;