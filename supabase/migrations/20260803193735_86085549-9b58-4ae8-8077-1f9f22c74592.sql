CREATE OR REPLACE FUNCTION public.f8_plan_completeness_core(p_plan_id uuid)
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

REVOKE ALL ON FUNCTION public.f8_plan_completeness_core(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f8_plan_completeness_core(uuid) TO authenticated;