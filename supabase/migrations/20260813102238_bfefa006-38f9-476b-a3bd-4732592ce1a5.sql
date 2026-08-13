-- F8.1-B1 — Retrato do negócio: definições de fatos, snapshots e valores.
-- Aditivo e idempotente. NENHUM valor de empresa real é criado.

-- ---------------------------------------------------------------
-- 1. Biblioteca versionada de definições de fatos (global)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_fact_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1,
  code text NOT NULL,
  label text NOT NULL,
  description text NULL,
  dimension text NOT NULL,
  category text NOT NULL,
  value_type text NOT NULL,
  unit text NULL,
  universal boolean NOT NULL DEFAULT true,
  sector_code text NULL,
  business_model text NULL,
  importance text NOT NULL,
  derived boolean NOT NULL DEFAULT false,
  source_fact_codes text[] NOT NULL DEFAULT '{}',
  allow_negative boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategy_fact_definitions_dimension_ck
    CHECK (dimension IN ('finance','marketing_sales','operations','people','governance')),
  CONSTRAINT strategy_fact_definitions_value_type_ck
    CHECK (value_type IN ('currency','percentage','number','days','hours','boolean','text_short')),
  CONSTRAINT strategy_fact_definitions_importance_ck
    CHECK (importance IN ('core','recommended','optional'))
);

CREATE UNIQUE INDEX IF NOT EXISTS strategy_fact_definitions_code_uk
  ON public.strategy_fact_definitions
  (version, code, COALESCE(sector_code, ''), COALESCE(business_model, ''));

GRANT SELECT ON public.strategy_fact_definitions TO authenticated;
GRANT ALL ON public.strategy_fact_definitions TO service_role;
ALTER TABLE public.strategy_fact_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_fact_definitions_select ON public.strategy_fact_definitions;
CREATE POLICY strategy_fact_definitions_select ON public.strategy_fact_definitions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accessible_scope_ids('strategy.read'::public.citext, NULL)));

-- ---------------------------------------------------------------
-- 2. Snapshots do retrato do negócio (por unidade)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_business_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  business_unit_id uuid NOT NULL,
  reference_date date NOT NULL DEFAULT current_date,
  period_label text NULL,
  currency_code text NOT NULL DEFAULT 'BRL',
  review_status text NOT NULL DEFAULT 'draft',
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT strategy_business_snapshots_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units (id, organization_id),
  CONSTRAINT strategy_business_snapshots_review_ck
    CHECK (review_status IN ('draft','reviewed')),
  CONSTRAINT strategy_business_snapshots_currency_ck
    CHECK (char_length(currency_code) = 3)
);

CREATE INDEX IF NOT EXISTS strategy_business_snapshots_bu_idx
  ON public.strategy_business_snapshots (business_unit_id, reference_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.strategy_business_snapshots TO authenticated;
GRANT ALL ON public.strategy_business_snapshots TO service_role;
ALTER TABLE public.strategy_business_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_business_snapshots_select ON public.strategy_business_snapshots;
CREATE POLICY strategy_business_snapshots_select ON public.strategy_business_snapshots
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_business_snapshots_insert ON public.strategy_business_snapshots;
CREATE POLICY strategy_business_snapshots_insert ON public.strategy_business_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_business_snapshots_update ON public.strategy_business_snapshots;
CREATE POLICY strategy_business_snapshots_update ON public.strategy_business_snapshots
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)));

-- ---------------------------------------------------------------
-- 3. Valores dos fatos
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_business_fact_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  business_unit_id uuid NOT NULL,
  snapshot_id uuid NOT NULL REFERENCES public.strategy_business_snapshots(id),
  fact_definition_id uuid NOT NULL REFERENCES public.strategy_fact_definitions(id),
  numeric_value numeric NULL,
  text_value text NULL,
  boolean_value boolean NULL,
  source_note text NULL,
  confidence text NOT NULL DEFAULT 'exact',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT strategy_business_fact_values_unique UNIQUE (snapshot_id, fact_definition_id),
  CONSTRAINT strategy_business_fact_values_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units (id, organization_id),
  CONSTRAINT strategy_business_fact_values_confidence_ck
    CHECK (confidence IN ('exact','estimated','unavailable')),
  CONSTRAINT strategy_business_fact_values_unavailable_ck
    CHECK (confidence <> 'unavailable'
      OR (numeric_value IS NULL AND text_value IS NULL AND boolean_value IS NULL)),
  CONSTRAINT strategy_business_fact_values_note_len
    CHECK (source_note IS NULL OR char_length(source_note) <= 120)
);

CREATE INDEX IF NOT EXISTS strategy_business_fact_values_snapshot_idx
  ON public.strategy_business_fact_values (snapshot_id);

GRANT SELECT, INSERT, UPDATE ON public.strategy_business_fact_values TO authenticated;
GRANT ALL ON public.strategy_business_fact_values TO service_role;
ALTER TABLE public.strategy_business_fact_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_business_fact_values_select ON public.strategy_business_fact_values;
CREATE POLICY strategy_business_fact_values_select ON public.strategy_business_fact_values
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_business_fact_values_insert ON public.strategy_business_fact_values;
CREATE POLICY strategy_business_fact_values_insert ON public.strategy_business_fact_values
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_business_fact_values_update ON public.strategy_business_fact_values;
CREATE POLICY strategy_business_fact_values_update ON public.strategy_business_fact_values
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
    public.f2_bu_scope_id(business_unit_id)));

-- ---------------------------------------------------------------
-- 4. Autoria server-authoritative + updated_at + auditoria
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_business_snapshots_authorship ON public.strategy_business_snapshots;
CREATE TRIGGER trg_business_snapshots_authorship
  BEFORE INSERT OR UPDATE ON public.strategy_business_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.f81_touch_authorship();

DROP TRIGGER IF EXISTS trg_business_snapshots_touch ON public.strategy_business_snapshots;
CREATE TRIGGER trg_business_snapshots_touch
  BEFORE UPDATE ON public.strategy_business_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS trg_business_fact_values_authorship ON public.strategy_business_fact_values;
CREATE TRIGGER trg_business_fact_values_authorship
  BEFORE INSERT OR UPDATE ON public.strategy_business_fact_values
  FOR EACH ROW EXECUTE FUNCTION public.f81_touch_authorship();

DROP TRIGGER IF EXISTS trg_business_fact_values_touch ON public.strategy_business_fact_values;
CREATE TRIGGER trg_business_fact_values_touch
  BEFORE UPDATE ON public.strategy_business_fact_values
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS trg_business_fact_values_audit ON public.strategy_business_fact_values;
CREATE TRIGGER trg_business_fact_values_audit
  AFTER INSERT OR UPDATE ON public.strategy_business_fact_values
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

-- ---------------------------------------------------------------
-- 5. Invalidação automática da revisão ao editar fatos core/recommended
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f81_invalidate_snapshot_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_importance text;
BEGIN
  SELECT importance INTO v_importance
    FROM public.strategy_fact_definitions
   WHERE id = NEW.fact_definition_id;

  IF COALESCE(v_importance, 'optional') IN ('core', 'recommended') THEN
    UPDATE public.strategy_business_snapshots
       SET review_status = 'draft',
           reviewed_at = NULL,
           reviewed_by = NULL
     WHERE id = NEW.snapshot_id
       AND review_status <> 'draft';
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.f81_invalidate_snapshot_review() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_business_fact_values_invalidate ON public.strategy_business_fact_values;
CREATE TRIGGER trg_business_fact_values_invalidate
  AFTER INSERT OR UPDATE ON public.strategy_business_fact_values
  FOR EACH ROW EXECUTE FUNCTION public.f81_invalidate_snapshot_review();

-- ---------------------------------------------------------------
-- 6. Revisão server-authoritative do snapshot
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f81_review_business_snapshot(p_snapshot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_snap   public.strategy_business_snapshots%ROWTYPE;
  v_scope  uuid;
  v_user   uuid;
  v_missing text[] := '{}';
BEGIN
  SELECT * INTO v_snap FROM public.strategy_business_snapshots WHERE id = p_snapshot_id;
  IF v_snap.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'snapshot_not_found',
      'message', 'Retrato do negócio não encontrado.');
  END IF;

  v_scope := public.f2_bu_scope_id(v_snap.business_unit_id);
  IF NOT public.has_permission('strategy.manage'::public.citext, 'business_unit', v_scope) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden',
      'message', 'Você não tem permissão para gerir o retrato do negócio desta unidade.');
  END IF;

  -- Um "grupo core respondido" = existe valor informado OU marcado como indisponível.
  IF NOT EXISTS (
    SELECT 1 FROM public.strategy_business_fact_values v
      JOIN public.strategy_fact_definitions d ON d.id = v.fact_definition_id
     WHERE v.snapshot_id = p_snapshot_id AND d.code = 'annual_revenue_current'
  ) THEN
    v_missing := v_missing || 'revenue';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.strategy_business_fact_values v
      JOIN public.strategy_fact_definitions d ON d.id = v.fact_definition_id
     WHERE v.snapshot_id = p_snapshot_id AND d.code = 'headcount'
  ) THEN
    v_missing := v_missing || 'headcount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.strategy_business_fact_values v
      JOIN public.strategy_fact_definitions d ON d.id = v.fact_definition_id
     WHERE v.snapshot_id = p_snapshot_id
       AND d.dimension = 'finance' AND d.code <> 'annual_revenue_current'
  ) THEN
    v_missing := v_missing || 'finance_extra';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.strategy_business_fact_values v
      JOIN public.strategy_fact_definitions d ON d.id = v.fact_definition_id
     WHERE v.snapshot_id = p_snapshot_id AND d.dimension = 'marketing_sales'
  ) THEN
    v_missing := v_missing || 'commercial';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.strategy_business_fact_values v
      JOIN public.strategy_fact_definitions d ON d.id = v.fact_definition_id
     WHERE v.snapshot_id = p_snapshot_id AND d.dimension = 'operations'
  ) THEN
    v_missing := v_missing || 'operations';
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'incomplete_core',
      'missingCoreGroups', to_jsonb(v_missing),
      'message', 'Responda todos os blocos essenciais antes de revisar. "Não tenho este dado" também é uma resposta válida.');
  END IF;

  v_user := public.current_user_id();

  UPDATE public.strategy_business_snapshots
     SET review_status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = v_user,
         updated_by = v_user
   WHERE id = p_snapshot_id;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, metadata, source)
  VALUES (v_snap.organization_id, v_user, 'f81.business_snapshot.reviewed',
          'public.strategy_business_snapshots', p_snapshot_id, 'update',
          jsonb_build_object('businessUnitId', v_snap.business_unit_id,
                             'referenceDate', v_snap.reference_date,
                             'periodLabel', v_snap.period_label),
          'f8.1-b1');

  RETURN jsonb_build_object('ok', true, 'message', 'Retrato do negócio revisado.');
END $$;

REVOKE ALL ON FUNCTION public.f81_review_business_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f81_review_business_snapshot(uuid) TO authenticated;

-- ---------------------------------------------------------------
-- 7. Biblioteca universal de fatos — V1 (SOMENTE definições)
-- ---------------------------------------------------------------
INSERT INTO public.strategy_fact_definitions
  (version, code, label, description, dimension, category, value_type, unit,
   universal, sector_code, importance, allow_negative, sort_order)
VALUES
  (1,'annual_revenue_current','Faturamento dos últimos 12 meses','Receita bruta acumulada nos últimos 12 meses ou no ano de referência.','finance','revenue','currency','BRL',true,NULL,'core',false,10),
  (1,'annual_revenue_previous','Faturamento do período anterior comparável','Mesma janela de tempo do período anterior, para permitir comparação.','finance','revenue','currency','BRL',true,NULL,'recommended',false,20),
  (1,'gross_margin_pct','Margem bruta','Percentual da receita que sobra depois dos custos diretos.','finance','margin','percentage','%',true,NULL,'recommended',true,30),
  (1,'ebitda_margin_pct','Margem operacional / EBITDA','Percentual da receita que sobra depois dos custos e despesas operacionais.','finance','margin','percentage','%',true,NULL,'recommended',true,40),
  (1,'working_capital_days','Dias de capital de giro','Dias de operação financiados pelo próprio caixa.','finance','cash','days','dias',true,NULL,'optional',false,50),
  (1,'receivables_days','Prazo médio de recebimento','Dias médios entre a venda e o recebimento.','finance','cash','days','dias',true,NULL,'optional',false,60),
  (1,'active_customers','Clientes ativos','Clientes que compraram no período considerado.','marketing_sales','customers','number','clientes',true,NULL,'recommended',false,70),
  (1,'top1_customer_revenue_pct','Participação do maior cliente','Percentual da receita concentrado no maior cliente.','marketing_sales','concentration','percentage','%',true,NULL,'recommended',false,80),
  (1,'top5_customer_revenue_pct','Participação dos 5 maiores clientes','Percentual da receita concentrado nos cinco maiores clientes.','marketing_sales','concentration','percentage','%',true,NULL,'recommended',false,90),
  (1,'recurring_revenue_pct','Receita recorrente','Percentual da receita previsível/contratada.','marketing_sales','revenue_quality','percentage','%',true,NULL,'optional',false,100),
  (1,'qualified_opportunities_month','Oportunidades qualificadas por mês','Oportunidades comerciais qualificadas geradas por mês.','marketing_sales','pipeline','number','oportunidades',true,NULL,'optional',false,110),
  (1,'win_rate_pct','Conversão de oportunidades','Percentual de oportunidades que viram venda.','marketing_sales','pipeline','percentage','%',true,NULL,'optional',false,120),
  (1,'average_ticket','Ticket médio','Valor médio por venda ou por cliente no período.','marketing_sales','pricing','currency','BRL',true,NULL,'optional',false,130),
  (1,'customer_churn_pct','Perda de clientes (churn)','Percentual de clientes perdidos no período, quando aplicável.','marketing_sales','retention','percentage','%',true,NULL,'optional',false,140),
  (1,'capacity_utilization_pct','Utilização da capacidade','Percentual da capacidade produtiva efetivamente utilizada.','operations','capacity','percentage','%',true,NULL,'recommended',false,150),
  (1,'on_time_delivery_pct','Entrega no prazo','Percentual de entregas concluídas dentro do prazo acordado.','operations','delivery','percentage','%',true,NULL,'recommended',false,160),
  (1,'rework_scrap_pct','Retrabalho e perdas','Percentual da produção perdida ou refeita.','operations','quality','percentage','%',true,NULL,'optional',false,170),
  (1,'downtime_pct','Indisponibilidade / paradas','Percentual do tempo planejado perdido com paradas.','operations','availability','percentage','%',true,NULL,'optional',false,180),
  (1,'lead_time_days','Lead time médio','Dias entre o pedido e a entrega.','operations','delivery','days','dias',true,NULL,'optional',false,190),
  (1,'safety_incidents_12m','Incidentes de segurança (12 meses)','Incidentes registrados nos últimos 12 meses.','operations','safety','number','incidentes',true,NULL,'recommended',false,200),
  (1,'headcount','Colaboradores','Total de pessoas trabalhando na unidade.','people','headcount','number','pessoas',true,NULL,'core',false,210),
  (1,'payroll_cost_pct_revenue','Custo de pessoal sobre a receita','Percentual da receita consumido por folha e encargos.','people','cost','percentage','%',true,NULL,'optional',false,220),
  (1,'turnover_pct','Turnover','Percentual de rotatividade no período.','people','retention','percentage','%',true,NULL,'recommended',false,230),
  (1,'absenteeism_pct','Absenteísmo','Percentual de ausências sobre a jornada prevista.','people','presence','percentage','%',true,NULL,'optional',false,240),
  (1,'leadership_positions','Posições de liderança previstas','Posições de liderança definidas na estrutura.','people','leadership','number','posições',true,NULL,'optional',false,250),
  (1,'filled_leadership_positions','Posições de liderança ocupadas','Posições de liderança com titular hoje.','people','leadership','number','posições',true,NULL,'optional',false,260),
  (1,'monthly_management_meeting','Existe ritual mensal de gestão?','Reunião mensal recorrente de análise de resultados.','governance','ritual','boolean',NULL,true,NULL,'recommended',false,270),
  (1,'kpis_actively_reviewed','Indicadores realmente revisados no ritual','Quantidade de indicadores analisados de fato nas reuniões.','governance','ritual','number','indicadores',true,NULL,'optional',false,280),
  (1,'financial_close_days','Dias para fechamento gerencial','Dias necessários para fechar os números do mês.','governance','data','number','dias',true,NULL,'optional',false,290),
  (1,'mining_stripping_ratio','Relação estéril/minério','Volume de estéril movimentado por unidade de minério.','operations','sector','number','x',false,'mining','optional',false,300),
  (1,'food_service_seat_turnover','Giro de mesas por dia','Quantas vezes cada mesa é ocupada por dia.','operations','sector','number','x/dia',false,'food_service','optional',false,310)
ON CONFLICT (version, code, COALESCE(sector_code, ''), COALESCE(business_model, '')) DO NOTHING;