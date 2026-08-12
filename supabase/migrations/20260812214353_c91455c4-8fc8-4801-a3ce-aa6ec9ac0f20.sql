-- =====================================================================
-- F12 — Jornada Estratégica / Onboarding Estratégico Determinístico
-- Aditiva, idempotente. Não altera F8/F8.5/F9 nem dados existentes.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Perfil estratégico da empresa (por unidade)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_strategy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL,
  sector_code text NOT NULL DEFAULT 'general',
  business_model text NOT NULL DEFAULT 'b2b',
  stage text NOT NULL DEFAULT 'growth',
  horizon_years integer NOT NULL DEFAULT 2,
  size_band text NOT NULL DEFAULT 'small',
  main_challenge text,
  notes text,
  journey_step text NOT NULL DEFAULT 'profile',
  assessment_version integer NOT NULL DEFAULT 1,
  library_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT company_strategy_profiles_bu_uk UNIQUE (business_unit_id),
  CONSTRAINT company_strategy_profiles_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT company_strategy_profiles_sector_ck
    CHECK (sector_code IN ('general','mining','food_service')),
  CONSTRAINT company_strategy_profiles_model_ck
    CHECK (business_model IN ('b2b','b2c','b2b2c','industry','services')),
  CONSTRAINT company_strategy_profiles_stage_ck
    CHECK (stage IN ('early','growth','consolidation','turnaround')),
  CONSTRAINT company_strategy_profiles_size_ck
    CHECK (size_band IN ('micro','small','medium','large')),
  CONSTRAINT company_strategy_profiles_horizon_ck CHECK (horizon_years BETWEEN 1 AND 5),
  CONSTRAINT company_strategy_profiles_step_ck
    CHECK (journey_step IN ('profile','maturity','diagnosis','priorities','recommendations','review')),
  CONSTRAINT company_strategy_profiles_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id)
);

GRANT SELECT, INSERT, UPDATE ON public.company_strategy_profiles TO authenticated;
GRANT ALL ON public.company_strategy_profiles TO service_role;
ALTER TABLE public.company_strategy_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_strategy_profiles_select ON public.company_strategy_profiles;
CREATE POLICY company_strategy_profiles_select ON public.company_strategy_profiles
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS company_strategy_profiles_insert ON public.company_strategy_profiles;
CREATE POLICY company_strategy_profiles_insert ON public.company_strategy_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS company_strategy_profiles_update ON public.company_strategy_profiles;
CREATE POLICY company_strategy_profiles_update ON public.company_strategy_profiles
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS company_strategy_profiles_touch ON public.company_strategy_profiles;
CREATE TRIGGER company_strategy_profiles_touch BEFORE UPDATE ON public.company_strategy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS company_strategy_profiles_audit ON public.company_strategy_profiles;
CREATE TRIGGER company_strategy_profiles_audit AFTER INSERT OR UPDATE ON public.company_strategy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

-- ---------------------------------------------------------------
-- 2. Biblioteca: questionário de maturidade (global, versionado)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  dimension text NOT NULL,
  prompt text NOT NULL,
  help_text text,
  weight numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategy_assessment_questions_code_uk UNIQUE (version, code),
  CONSTRAINT strategy_assessment_questions_dimension_ck
    CHECK (dimension IN ('finance','marketing_sales','operations','people','governance')),
  CONSTRAINT strategy_assessment_questions_status_ck CHECK (status IN ('active','archived'))
);

GRANT SELECT ON public.strategy_assessment_questions TO authenticated;
GRANT ALL ON public.strategy_assessment_questions TO service_role;
ALTER TABLE public.strategy_assessment_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_assessment_questions_select ON public.strategy_assessment_questions;
CREATE POLICY strategy_assessment_questions_select ON public.strategy_assessment_questions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accessible_scope_ids('strategy.read'::public.citext, NULL)));

-- ---------------------------------------------------------------
-- 3. Respostas de maturidade (por unidade)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL,
  question_id uuid NOT NULL REFERENCES public.strategy_assessment_questions(id),
  option_value text NOT NULL,
  option_score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategy_assessment_answers_uk UNIQUE (business_unit_id, question_id),
  CONSTRAINT strategy_assessment_answers_score_ck CHECK (option_score BETWEEN 0 AND 4),
  CONSTRAINT strategy_assessment_answers_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id)
);

GRANT SELECT, INSERT, UPDATE ON public.strategy_assessment_answers TO authenticated;
GRANT ALL ON public.strategy_assessment_answers TO service_role;
ALTER TABLE public.strategy_assessment_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_assessment_answers_select ON public.strategy_assessment_answers;
CREATE POLICY strategy_assessment_answers_select ON public.strategy_assessment_answers
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_assessment_answers_insert ON public.strategy_assessment_answers;
CREATE POLICY strategy_assessment_answers_insert ON public.strategy_assessment_answers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_assessment_answers_update ON public.strategy_assessment_answers;
CREATE POLICY strategy_assessment_answers_update ON public.strategy_assessment_answers
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS strategy_assessment_answers_touch ON public.strategy_assessment_answers;
CREATE TRIGGER strategy_assessment_answers_touch BEFORE UPDATE ON public.strategy_assessment_answers
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

-- ---------------------------------------------------------------
-- 4. Biblioteca: afirmações de diagnóstico (global, versionada)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_diagnosis_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  sector_code text NOT NULL DEFAULT 'general',
  dimension text NOT NULL,
  swot_category text NOT NULL,
  statement text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategy_diagnosis_statements_code_uk UNIQUE (version, code),
  CONSTRAINT strategy_diagnosis_statements_sector_ck
    CHECK (sector_code IN ('general','mining','food_service')),
  CONSTRAINT strategy_diagnosis_statements_dimension_ck
    CHECK (dimension IN ('finance','marketing_sales','operations','people','governance')),
  CONSTRAINT strategy_diagnosis_statements_swot_ck
    CHECK (swot_category IN ('strength','weakness','opportunity','threat')),
  CONSTRAINT strategy_diagnosis_statements_status_ck CHECK (status IN ('active','archived'))
);

GRANT SELECT ON public.strategy_diagnosis_statements TO authenticated;
GRANT ALL ON public.strategy_diagnosis_statements TO service_role;
ALTER TABLE public.strategy_diagnosis_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_diagnosis_statements_select ON public.strategy_diagnosis_statements;
CREATE POLICY strategy_diagnosis_statements_select ON public.strategy_diagnosis_statements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accessible_scope_ids('strategy.read'::public.citext, NULL)));

-- ---------------------------------------------------------------
-- 5. Seleções de diagnóstico (por unidade)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_diagnosis_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL,
  statement_id uuid NOT NULL REFERENCES public.strategy_diagnosis_statements(id),
  intensity text NOT NULL DEFAULT 'medium',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategy_diagnosis_selections_uk UNIQUE (business_unit_id, statement_id),
  CONSTRAINT strategy_diagnosis_selections_intensity_ck CHECK (intensity IN ('low','medium','high')),
  CONSTRAINT strategy_diagnosis_selections_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_diagnosis_selections TO authenticated;
GRANT ALL ON public.strategy_diagnosis_selections TO service_role;
ALTER TABLE public.strategy_diagnosis_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_diagnosis_selections_select ON public.strategy_diagnosis_selections;
CREATE POLICY strategy_diagnosis_selections_select ON public.strategy_diagnosis_selections
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_diagnosis_selections_insert ON public.strategy_diagnosis_selections;
CREATE POLICY strategy_diagnosis_selections_insert ON public.strategy_diagnosis_selections
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_diagnosis_selections_update ON public.strategy_diagnosis_selections;
CREATE POLICY strategy_diagnosis_selections_update ON public.strategy_diagnosis_selections
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_diagnosis_selections_delete ON public.strategy_diagnosis_selections;
CREATE POLICY strategy_diagnosis_selections_delete ON public.strategy_diagnosis_selections
  FOR DELETE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS strategy_diagnosis_selections_touch ON public.strategy_diagnosis_selections;
CREATE TRIGGER strategy_diagnosis_selections_touch BEFORE UPDATE ON public.strategy_diagnosis_selections
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

-- ---------------------------------------------------------------
-- 6. Biblioteca curada de objetivos e KPIs (global, versionada)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_template_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  sector_code text NOT NULL DEFAULT 'general',
  dimension text NOT NULL,
  stages text[] NOT NULL DEFAULT ARRAY['early','growth','consolidation','turnaround'],
  title text NOT NULL,
  description text NOT NULL,
  rationale text NOT NULL,
  base_weight numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategy_template_objectives_code_uk UNIQUE (version, code),
  CONSTRAINT strategy_template_objectives_sector_ck
    CHECK (sector_code IN ('general','mining','food_service')),
  CONSTRAINT strategy_template_objectives_dimension_ck
    CHECK (dimension IN ('finance','marketing_sales','operations','people','governance')),
  CONSTRAINT strategy_template_objectives_status_ck CHECK (status IN ('active','archived'))
);

GRANT SELECT ON public.strategy_template_objectives TO authenticated;
GRANT ALL ON public.strategy_template_objectives TO service_role;
ALTER TABLE public.strategy_template_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_template_objectives_select ON public.strategy_template_objectives;
CREATE POLICY strategy_template_objectives_select ON public.strategy_template_objectives
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accessible_scope_ids('strategy.read'::public.citext, NULL)));

CREATE TABLE IF NOT EXISTS public.strategy_template_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_objective_id uuid NOT NULL REFERENCES public.strategy_template_objectives(id),
  code text NOT NULL,
  name text NOT NULL,
  kpi_class text NOT NULL,
  description text,
  unit text,
  formula text,
  source_hint text,
  direction text NOT NULL DEFAULT 'higher_better',
  frequency text NOT NULL DEFAULT 'monthly',
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategy_template_kpis_code_uk UNIQUE (template_objective_id, code),
  CONSTRAINT strategy_template_kpis_class_ck CHECK (kpi_class IN ('result','performance','quality')),
  CONSTRAINT strategy_template_kpis_direction_ck
    CHECK (direction IN ('higher_better','lower_better','range')),
  CONSTRAINT strategy_template_kpis_frequency_ck
    CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  CONSTRAINT strategy_template_kpis_status_ck CHECK (status IN ('active','archived'))
);

GRANT SELECT ON public.strategy_template_kpis TO authenticated;
GRANT ALL ON public.strategy_template_kpis TO service_role;
ALTER TABLE public.strategy_template_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_template_kpis_select ON public.strategy_template_kpis;
CREATE POLICY strategy_template_kpis_select ON public.strategy_template_kpis
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.accessible_scope_ids('strategy.read'::public.citext, NULL)));

-- ---------------------------------------------------------------
-- 7. Decisões sobre recomendações (por unidade)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.strategy_recommendation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_unit_id uuid NOT NULL,
  template_objective_id uuid NOT NULL REFERENCES public.strategy_template_objectives(id),
  decision text NOT NULL DEFAULT 'accepted',
  custom_title text,
  custom_description text,
  score numeric,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_objective_id uuid,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT strategy_recommendation_decisions_uk UNIQUE (business_unit_id, template_objective_id),
  CONSTRAINT strategy_recommendation_decisions_id_org_uk UNIQUE (id, organization_id),
  CONSTRAINT strategy_recommendation_decisions_decision_ck
    CHECK (decision IN ('accepted','discarded')),
  CONSTRAINT strategy_recommendation_decisions_bu_fk
    FOREIGN KEY (business_unit_id, organization_id)
    REFERENCES public.business_units(id, organization_id),
  CONSTRAINT strategy_recommendation_decisions_objective_fk
    FOREIGN KEY (applied_objective_id, organization_id)
    REFERENCES public.strategic_objectives(id, organization_id)
);

GRANT SELECT, INSERT, UPDATE ON public.strategy_recommendation_decisions TO authenticated;
GRANT ALL ON public.strategy_recommendation_decisions TO service_role;
ALTER TABLE public.strategy_recommendation_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strategy_recommendation_decisions_select ON public.strategy_recommendation_decisions;
CREATE POLICY strategy_recommendation_decisions_select ON public.strategy_recommendation_decisions
  FOR SELECT TO authenticated
  USING (public.has_permission('strategy.read'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_recommendation_decisions_insert ON public.strategy_recommendation_decisions;
CREATE POLICY strategy_recommendation_decisions_insert ON public.strategy_recommendation_decisions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP POLICY IF EXISTS strategy_recommendation_decisions_update ON public.strategy_recommendation_decisions;
CREATE POLICY strategy_recommendation_decisions_update ON public.strategy_recommendation_decisions
  FOR UPDATE TO authenticated
  USING (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                               public.f2_bu_scope_id(business_unit_id)))
  WITH CHECK (public.has_permission('strategy.manage'::public.citext, 'business_unit',
                                    public.f2_bu_scope_id(business_unit_id)));

DROP TRIGGER IF EXISTS strategy_recommendation_decisions_touch ON public.strategy_recommendation_decisions;
CREATE TRIGGER strategy_recommendation_decisions_touch BEFORE UPDATE ON public.strategy_recommendation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.f1_touch_updated_at();

DROP TRIGGER IF EXISTS strategy_recommendation_decisions_audit ON public.strategy_recommendation_decisions;
CREATE TRIGGER strategy_recommendation_decisions_audit
  AFTER INSERT OR UPDATE ON public.strategy_recommendation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.f2_audit();

-- ---------------------------------------------------------------
-- 8. Conteúdo curado (idempotente)
-- ---------------------------------------------------------------

-- 8.1 Perguntas de maturidade (versão 1) — 5 dimensões, 2 perguntas cada
INSERT INTO public.strategy_assessment_questions (version, code, dimension, prompt, help_text, weight, sort_order, options)
VALUES
 (1,'fin_01','finance','A empresa acompanha resultado financeiro mensal com fechamento confiável?','Considere DRE gerencial e conciliação.',1.5,10,
  '[{"value":"none","label":"Não acompanhamos","score":0},{"value":"informal","label":"Acompanhamos de forma informal","score":1},{"value":"partial","label":"Fechamento parcial e atrasado","score":2},{"value":"regular","label":"Fechamento mensal regular","score":3},{"value":"mature","label":"Fechamento auditado e analisado","score":4}]'::jsonb),
 (1,'fin_02','finance','Existe controle de custos por unidade e por produto/serviço?',NULL,1.0,20,
  '[{"value":"none","label":"Não existe","score":0},{"value":"informal","label":"Somente estimativas","score":1},{"value":"partial","label":"Parcial, por unidade","score":2},{"value":"regular","label":"Custos por produto/serviço","score":3},{"value":"mature","label":"Custeio detalhado e usado nas decisões","score":4}]'::jsonb),
 (1,'mkt_01','marketing_sales','A empresa tem previsibilidade de vendas e funil acompanhado?',NULL,1.5,30,
  '[{"value":"none","label":"Sem previsibilidade","score":0},{"value":"informal","label":"Depende de relacionamento pontual","score":1},{"value":"partial","label":"Funil informal","score":2},{"value":"regular","label":"Funil acompanhado mensalmente","score":3},{"value":"mature","label":"Previsão de vendas confiável","score":4}]'::jsonb),
 (1,'mkt_02','marketing_sales','A satisfação do cliente é medida de forma sistemática?',NULL,1.0,40,
  '[{"value":"none","label":"Não medimos","score":0},{"value":"informal","label":"Ouvimos reclamações espontâneas","score":1},{"value":"partial","label":"Pesquisas esporádicas","score":2},{"value":"regular","label":"Pesquisa periódica com indicador","score":3},{"value":"mature","label":"Indicador acompanhado e com plano de ação","score":4}]'::jsonb),
 (1,'ope_01','operations','Os processos críticos estão padronizados e documentados?',NULL,1.5,50,
  '[{"value":"none","label":"Nada documentado","score":0},{"value":"informal","label":"Conhecimento na cabeça das pessoas","score":1},{"value":"partial","label":"Alguns procedimentos escritos","score":2},{"value":"regular","label":"Processos críticos padronizados","score":3},{"value":"mature","label":"Padrões revisados e auditados","score":4}]'::jsonb),
 (1,'ope_02','operations','Existem rotinas recorrentes com evidência de execução?',NULL,1.0,60,
  '[{"value":"none","label":"Não existem rotinas formais","score":0},{"value":"informal","label":"Rotinas informais","score":1},{"value":"partial","label":"Rotinas em algumas áreas","score":2},{"value":"regular","label":"Rotinas com registro de execução","score":3},{"value":"mature","label":"Rotinas com evidência e verificação","score":4}]'::jsonb),
 (1,'peo_01','people','Papéis, responsabilidades e chefias estão claros?',NULL,1.5,70,
  '[{"value":"none","label":"Não estão claros","score":0},{"value":"informal","label":"Claros apenas informalmente","score":1},{"value":"partial","label":"Organograma parcial","score":2},{"value":"regular","label":"Organograma e responsabilidades definidos","score":3},{"value":"mature","label":"Descrições revisadas e avaliadas","score":4}]'::jsonb),
 (1,'peo_02','people','Existe plano de desenvolvimento e avaliação de desempenho?',NULL,1.0,80,
  '[{"value":"none","label":"Não existe","score":0},{"value":"informal","label":"Feedback informal","score":1},{"value":"partial","label":"Avaliação esporádica","score":2},{"value":"regular","label":"Ciclo anual estruturado","score":3},{"value":"mature","label":"Ciclo com metas e desenvolvimento","score":4}]'::jsonb),
 (1,'gov_01','governance','Existe rotina de reuniões de gestão com decisões registradas?',NULL,1.5,90,
  '[{"value":"none","label":"Não existe","score":0},{"value":"informal","label":"Conversas informais","score":1},{"value":"partial","label":"Reuniões sem registro","score":2},{"value":"regular","label":"Reuniões periódicas com ata","score":3},{"value":"mature","label":"Ritual com pauta, decisões e acompanhamento","score":4}]'::jsonb),
 (1,'gov_02','governance','O planejamento estratégico é acompanhado por indicadores?',NULL,1.5,100,
  '[{"value":"none","label":"Não há planejamento formal","score":0},{"value":"informal","label":"Planejamento informal","score":1},{"value":"partial","label":"Plano existe, sem indicadores","score":2},{"value":"regular","label":"Plano com indicadores acompanhados","score":3},{"value":"mature","label":"Plano, indicadores e revisões periódicas","score":4}]'::jsonb)
ON CONFLICT (version, code) DO NOTHING;

-- 8.2 Afirmações de diagnóstico
INSERT INTO public.strategy_diagnosis_statements (version, code, sector_code, dimension, swot_category, statement, weight, sort_order)
VALUES
 (1,'gen_w_margin','general','finance','weakness','Margem apertada e pouca previsibilidade de caixa',1.5,10),
 (1,'gen_w_dependency','general','marketing_sales','weakness','Faturamento concentrado em poucos clientes',1.5,20),
 (1,'gen_w_process','general','operations','weakness','Retrabalho frequente por falta de padrão',1.2,30),
 (1,'gen_w_people','general','people','weakness','Alta rotatividade e dependência de pessoas-chave',1.2,40),
 (1,'gen_w_gov','general','governance','weakness','Decisões tomadas sem dados confiáveis',1.5,50),
 (1,'gen_s_brand','general','marketing_sales','strength','Marca reconhecida na região de atuação',1.0,60),
 (1,'gen_s_team','general','people','strength','Equipe comprometida e com baixa resistência a mudanças',1.0,70),
 (1,'gen_o_expansion','general','marketing_sales','opportunity','Demanda crescente no mercado atual',1.0,80),
 (1,'gen_t_cost','general','finance','threat','Pressão de custos de insumos e energia',1.0,90),
 (1,'min_w_compliance','mining','governance','weakness','Exigências regulatórias e ambientais difíceis de comprovar',1.5,100),
 (1,'min_w_maintenance','mining','operations','weakness','Paradas não programadas de equipamentos críticos',1.5,110),
 (1,'min_w_safety','mining','people','weakness','Indicadores de segurança sem acompanhamento sistemático',1.5,120),
 (1,'min_o_capacity','mining','operations','opportunity','Capacidade instalada ociosa passível de melhor uso',1.0,130),
 (1,'food_w_waste','food_service','operations','weakness','Desperdício de insumos e falhas de ficha técnica',1.5,140),
 (1,'food_w_service','food_service','marketing_sales','weakness','Tempo de atendimento acima do esperado em picos',1.2,150),
 (1,'food_w_turnover','food_service','people','weakness','Rotatividade elevada no salão e na cozinha',1.5,160),
 (1,'food_o_delivery','food_service','marketing_sales','opportunity','Crescimento de canais de delivery e recorrência',1.0,170),
 (1,'food_t_hygiene','food_service','governance','threat','Risco sanitário e exigências de fiscalização',1.2,180)
ON CONFLICT (version, code) DO NOTHING;

-- 8.3 Objetivos curados
INSERT INTO public.strategy_template_objectives (version, code, sector_code, dimension, stages, title, description, rationale, base_weight, sort_order)
VALUES
 (1,'gen_fin_margin','general','finance',ARRAY['early','growth','consolidation','turnaround'],
  'Elevar a margem operacional com disciplina de custos',
  'Estruturar acompanhamento mensal de resultado e reduzir custos que não geram valor.',
  'Margem e caixa sustentam qualquer outra escolha estratégica.',1.4,10),
 (1,'gen_fin_cash','general','finance',ARRAY['turnaround','growth'],
  'Recuperar previsibilidade de caixa',
  'Implantar projeção de caixa rolante e política de prazos.',
  'Empresas em crescimento ou recuperação quebram por caixa, não por lucro.',1.2,20),
 (1,'gen_mkt_revenue','general','marketing_sales',ARRAY['early','growth','consolidation'],
  'Ampliar receita com previsibilidade comercial',
  'Estruturar funil, carteira e ritmo comercial com metas mensais.',
  'Receita previsível reduz a dependência de esforço heroico.',1.3,30),
 (1,'gen_mkt_customer','general','marketing_sales',ARRAY['growth','consolidation'],
  'Aumentar a satisfação e a retenção de clientes',
  'Medir satisfação de forma sistemática e tratar as causas das reclamações.',
  'Reter cliente custa menos do que conquistar cliente novo.',1.1,40),
 (1,'gen_ope_standard','general','operations',ARRAY['early','growth','consolidation','turnaround'],
  'Padronizar os processos críticos da operação',
  'Documentar padrões, criar rotinas recorrentes e exigir evidência de execução.',
  'Sem padrão não existe melhoria: o resultado vira acaso.',1.3,50),
 (1,'gen_peo_structure','general','people',ARRAY['early','growth','consolidation'],
  'Clarear papéis, responsabilidades e sucessão',
  'Formalizar organograma funcional, responsabilidades e substituições.',
  'Estrutura clara reduz conflito e acelera decisão.',1.2,60),
 (1,'gen_gov_ritual','general','governance',ARRAY['early','growth','consolidation','turnaround'],
  'Instalar ritual de gestão com decisões registradas',
  'Estabelecer reuniões periódicas com pauta, indicadores, decisões e responsáveis.',
  'O ritual é o que transforma plano em execução.',1.4,70),
 (1,'min_ope_availability','mining','operations',ARRAY['growth','consolidation','turnaround'],
  'Aumentar a disponibilidade dos equipamentos críticos',
  'Implantar manutenção preventiva e controle de paradas não programadas.',
  'Na mineração, disponibilidade de ativo é o principal motor de produção.',1.5,80),
 (1,'min_peo_safety','mining','people',ARRAY['early','growth','consolidation','turnaround'],
  'Reduzir acidentes e fortalecer a cultura de segurança',
  'Estruturar indicadores de segurança, inspeções e tratativa de desvios.',
  'Segurança é condição de operação e de licença social.',1.5,90),
 (1,'min_gov_compliance','mining','governance',ARRAY['growth','consolidation'],
  'Assegurar conformidade ambiental e regulatória',
  'Mapear obrigações, prazos e evidências de conformidade.',
  'Não conformidade paralisa a operação e destrói valor.',1.3,100),
 (1,'food_ope_waste','food_service','operations',ARRAY['early','growth','consolidation','turnaround'],
  'Reduzir desperdício e padronizar fichas técnicas',
  'Padronizar receitas, porcionamento e controle de perdas.',
  'No food service, o desperdício consome a margem silenciosamente.',1.5,110),
 (1,'food_mkt_experience','food_service','marketing_sales',ARRAY['growth','consolidation'],
  'Elevar a experiência do cliente no salão e no delivery',
  'Padronizar tempo de atendimento e tratar avaliações dos clientes.',
  'Experiência consistente sustenta recorrência e ticket.',1.3,120),
 (1,'food_peo_retention','food_service','people',ARRAY['early','growth','consolidation','turnaround'],
  'Reduzir rotatividade e formar a equipe operacional',
  'Estruturar integração, treinamento e escala previsível.',
  'Equipe estável é pré-requisito para padrão de serviço.',1.3,130)
ON CONFLICT (version, code) DO NOTHING;

-- 8.4 KPIs curados por objetivo
INSERT INTO public.strategy_template_kpis (template_objective_id, code, name, kpi_class, description, unit, formula, source_hint, direction, frequency, sort_order)
SELECT o.id, v.code, v.name, v.kpi_class, v.description, v.unit, v.formula, v.source_hint, v.direction, v.frequency, v.sort_order
FROM (VALUES
 ('gen_fin_margin','margem_operacional','Margem operacional','result','Resultado operacional sobre receita líquida.','%','(resultado operacional / receita líquida) * 100','Fechamento contábil/gerencial mensal','higher_better','monthly',10),
 ('gen_fin_margin','custo_receita','Custo fixo sobre receita','performance','Peso do custo fixo na receita do período.','%','(custo fixo / receita líquida) * 100','Fechamento gerencial','lower_better','monthly',20),
 ('gen_fin_margin','acuracia_fechamento','Fechamento no prazo','quality','Fechamentos concluídos até o prazo definido.','%','(fechamentos no prazo / fechamentos previstos) * 100','Controle interno do financeiro','higher_better','monthly',30),
 ('gen_fin_cash','saldo_caixa','Cobertura de caixa','result','Dias de operação cobertos pelo caixa disponível.','dias','saldo de caixa / desembolso médio diário','Conciliação bancária','higher_better','monthly',10),
 ('gen_fin_cash','aderencia_projecao','Aderência da projeção de caixa','quality','Desvio entre caixa projetado e realizado.','%','abs(projetado - realizado) / projetado * 100','Planilha/sistema de tesouraria','lower_better','monthly',20),
 ('gen_mkt_revenue','receita_liquida','Receita líquida','result','Receita líquida do período.','R$','soma das vendas líquidas','Faturamento','higher_better','monthly',10),
 ('gen_mkt_revenue','conversao_funil','Taxa de conversão do funil','performance','Propostas convertidas em vendas.','%','(vendas fechadas / propostas enviadas) * 100','Registro comercial','higher_better','monthly',20),
 ('gen_mkt_revenue','forecast_accuracy','Acurácia da previsão de vendas','quality','Aderência entre previsão e realizado.','%','abs(previsto - realizado) / previsto * 100','Registro comercial','lower_better','monthly',30),
 ('gen_mkt_customer','satisfacao_cliente','Satisfação do cliente','result','Índice de satisfação apurado em pesquisa.','pontos','média das notas de satisfação','Pesquisa periódica','higher_better','monthly',10),
 ('gen_mkt_customer','retencao_clientes','Retenção de clientes','performance','Clientes ativos mantidos no período.','%','(clientes mantidos / clientes do período anterior) * 100','Base de clientes','higher_better','quarterly',20),
 ('gen_mkt_customer','tratativa_reclamacoes','Reclamações tratadas no prazo','quality','Reclamações resolvidas dentro do prazo definido.','%','(reclamações no prazo / reclamações recebidas) * 100','Registro de atendimento','higher_better','monthly',30),
 ('gen_ope_standard','processos_padronizados','Processos críticos padronizados','result','Processos críticos com padrão publicado.','%','(processos padronizados / processos críticos) * 100','Mapa de processos','higher_better','quarterly',10),
 ('gen_ope_standard','aderencia_rotinas','Aderência às rotinas','performance','Execuções de rotina concluídas no prazo.','%','(execuções concluídas / execuções previstas) * 100','Módulo de rotinas do GMOS','higher_better','monthly',20),
 ('gen_ope_standard','retrabalho','Índice de retrabalho','quality','Volume de retrabalho sobre o total produzido.','%','(itens retrabalhados / itens produzidos) * 100','Controle da operação','lower_better','monthly',30),
 ('gen_peo_structure','posicoes_definidas','Posições com responsabilidades definidas','result','Posições do organograma com descrição completa.','%','(posições descritas / posições existentes) * 100','Organograma funcional do GMOS','higher_better','quarterly',10),
 ('gen_peo_structure','cobertura_sucessao','Cobertura de sucessão','performance','Posições críticas com substituto identificado.','%','(posições com sucessor / posições críticas) * 100','Organograma funcional','higher_better','quarterly',20),
 ('gen_gov_ritual','reunioes_realizadas','Rituais de gestão realizados','result','Reuniões de gestão realizadas conforme calendário.','%','(reuniões realizadas / reuniões previstas) * 100','Agenda de gestão','higher_better','monthly',10),
 ('gen_gov_ritual','decisoes_concluidas','Decisões concluídas no prazo','performance','Decisões registradas e concluídas no prazo acordado.','%','(decisões concluídas no prazo / decisões registradas) * 100','Atas e planos de ação','higher_better','monthly',20),
 ('gen_gov_ritual','indicadores_atualizados','Indicadores atualizados','quality','Indicadores com medição do período registrada.','%','(indicadores medidos / indicadores ativos) * 100','Módulo de indicadores do GMOS','higher_better','monthly',30),
 ('min_ope_availability','disponibilidade_fisica','Disponibilidade física','result','Tempo disponível dos equipamentos críticos.','%','(horas disponíveis / horas calendário) * 100','Apontamento de manutenção','higher_better','monthly',10),
 ('min_ope_availability','mtbf','Tempo médio entre falhas','performance','Intervalo médio entre falhas dos ativos críticos.','horas','horas operadas / número de falhas','Apontamento de manutenção','higher_better','monthly',20),
 ('min_ope_availability','preventiva_cumprida','Manutenção preventiva cumprida','quality','Ordens preventivas executadas no prazo.','%','(preventivas executadas / preventivas programadas) * 100','Plano de manutenção','higher_better','monthly',30),
 ('min_peo_safety','taxa_frequencia','Taxa de frequência de acidentes','result','Acidentes com afastamento por milhão de horas trabalhadas.','índice','(acidentes com afastamento * 1.000.000) / horas trabalhadas','Registro de SST','lower_better','monthly',10),
 ('min_peo_safety','inspecoes_realizadas','Inspeções de segurança realizadas','performance','Inspeções executadas conforme programação.','%','(inspeções realizadas / inspeções programadas) * 100','Programa de SST','higher_better','monthly',20),
 ('min_peo_safety','desvios_tratados','Desvios de segurança tratados','quality','Desvios com tratativa concluída no prazo.','%','(desvios tratados no prazo / desvios registrados) * 100','Registro de desvios','higher_better','monthly',30),
 ('min_gov_compliance','obrigacoes_em_dia','Obrigações legais em dia','result','Obrigações ambientais e regulatórias sem atraso.','%','(obrigações em dia / obrigações mapeadas) * 100','Matriz de obrigações','higher_better','quarterly',10),
 ('min_gov_compliance','evidencias_disponiveis','Evidências de conformidade disponíveis','quality','Obrigações com evidência arquivada e válida.','%','(obrigações com evidência / obrigações mapeadas) * 100','Repositório documental','higher_better','quarterly',20),
 ('food_ope_waste','indice_desperdicio','Índice de desperdício','result','Perda de insumos sobre o consumo total.','%','(insumo descartado / insumo consumido) * 100','Controle de estoque e produção','lower_better','monthly',10),
 ('food_ope_waste','cmv','CMV — custo da mercadoria vendida','performance','Custo de mercadoria sobre a receita.','%','(CMV / receita líquida) * 100','Fechamento gerencial','lower_better','monthly',20),
 ('food_ope_waste','fichas_padronizadas','Fichas técnicas padronizadas','quality','Itens do cardápio com ficha técnica válida.','%','(itens com ficha técnica / itens do cardápio) * 100','Cardápio e fichas técnicas','higher_better','quarterly',30),
 ('food_mkt_experience','nota_avaliacao','Nota média de avaliação','result','Nota média informada pelos clientes.','pontos','média das avaliações do período','Plataformas de avaliação e pesquisa','higher_better','monthly',10),
 ('food_mkt_experience','tempo_atendimento','Tempo médio de atendimento','performance','Tempo médio entre pedido e entrega ao cliente.','minutos','soma dos tempos / número de pedidos','Sistema de pedidos','lower_better','weekly',20),
 ('food_mkt_experience','pedidos_conformes','Pedidos entregues conformes','quality','Pedidos sem erro ou devolução.','%','(pedidos conformes / pedidos totais) * 100','Sistema de pedidos','higher_better','weekly',30),
 ('food_peo_retention','turnover','Rotatividade da equipe','result','Desligamentos sobre o quadro médio.','%','(desligamentos / quadro médio) * 100','Folha de pagamento','lower_better','monthly',10),
 ('food_peo_retention','treinamento_concluido','Treinamento de integração concluído','performance','Novos colaboradores com integração concluída.','%','(integrações concluídas / admissões) * 100','Registro de treinamento','higher_better','monthly',20),
 ('food_peo_retention','absenteismo','Absenteísmo','quality','Faltas não programadas sobre a jornada prevista.','%','(horas de falta / horas previstas) * 100','Controle de ponto','lower_better','monthly',30)
) AS v(objective_code, code, name, kpi_class, description, unit, formula, source_hint, direction, frequency, sort_order)
JOIN public.strategy_template_objectives o
  ON o.code = v.objective_code AND o.version = 1
ON CONFLICT (template_objective_id, code) DO NOTHING;

-- ---------------------------------------------------------------
-- 9. RPC transacional: levar rascunho para o planejamento
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f12_apply_strategy_draft(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan        public.strategic_plans%ROWTYPE;
  v_scope       uuid;
  v_user        uuid;
  v_accepted    integer;
  v_pillar      uuid;
  v_created_obj integer := 0;
  v_created_kpi integer := 0;
  v_rec         record;
  v_new_obj     uuid;
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

  IF v_plan.review_status = 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_approved',
      'message', 'O ciclo já está aprovado. Crie uma nova versão antes de aplicar o rascunho.');
  END IF;

  SELECT count(*) INTO v_accepted
    FROM public.strategy_recommendation_decisions d
   WHERE d.business_unit_id = v_plan.business_unit_id
     AND d.decision = 'accepted'
     AND d.applied_objective_id IS NULL;

  IF v_accepted < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_few',
      'message', 'Selecione pelo menos 3 objetivos para levar ao planejamento.');
  END IF;
  IF v_accepted > 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many',
      'message', 'Mantenha o foco: no máximo 7 objetivos por ciclo.');
  END IF;

  v_user := public.current_user_id();

  SELECT id INTO v_pillar
    FROM public.strategic_pillars
   WHERE plan_id = p_plan_id
   ORDER BY sort_order, created_at
   LIMIT 1;

  IF v_pillar IS NULL THEN
    INSERT INTO public.strategic_pillars
      (organization_id, business_unit_id, plan_id, title, description, sort_order, status, created_by, updated_by)
    VALUES (v_plan.organization_id, v_plan.business_unit_id, p_plan_id,
            'Direção estratégica', 'Pilar criado a partir da Jornada Estratégica.', 1, 'active', v_user, v_user)
    RETURNING id INTO v_pillar;
  END IF;

  FOR v_rec IN
    SELECT d.id AS decision_id, t.title, t.description,
           COALESCE(d.custom_title, t.title) AS final_title,
           COALESCE(d.custom_description, t.description) AS final_description,
           t.id AS template_id
      FROM public.strategy_recommendation_decisions d
      JOIN public.strategy_template_objectives t ON t.id = d.template_objective_id
     WHERE d.business_unit_id = v_plan.business_unit_id
       AND d.decision = 'accepted'
       AND d.applied_objective_id IS NULL
     ORDER BY t.sort_order
  LOOP
    INSERT INTO public.strategic_objectives
      (organization_id, business_unit_id, plan_id, pillar_id, title, description,
       status, progress, created_by, updated_by)
    VALUES (v_plan.organization_id, v_plan.business_unit_id, p_plan_id, v_pillar,
            v_rec.final_title, v_rec.final_description, 'draft', 0, v_user, v_user)
    RETURNING id INTO v_new_obj;

    v_created_obj := v_created_obj + 1;

    INSERT INTO public.kpis
      (organization_id, business_unit_id, plan_id, pillar_id, objective_id, name, description,
       unit, formula, source, frequency, direction, status, created_by, updated_by)
    SELECT v_plan.organization_id, v_plan.business_unit_id, p_plan_id, v_pillar, v_new_obj,
           k.name, k.description, k.unit, k.formula, k.source_hint, k.frequency, k.direction,
           'draft', v_user, v_user
      FROM public.strategy_template_kpis k
     WHERE k.template_objective_id = v_rec.template_id
       AND k.status = 'active';

    GET DIAGNOSTICS v_created_kpi = ROW_COUNT;

    UPDATE public.strategy_recommendation_decisions
       SET applied_objective_id = v_new_obj,
           applied_at = now(),
           updated_by = v_user
     WHERE id = v_rec.decision_id;
  END LOOP;

  SELECT count(*) INTO v_created_kpi
    FROM public.kpis
   WHERE plan_id = p_plan_id
     AND objective_id IN (
       SELECT applied_objective_id FROM public.strategy_recommendation_decisions
        WHERE business_unit_id = v_plan.business_unit_id AND applied_objective_id IS NOT NULL
     );

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, metadata, source)
  VALUES (v_plan.organization_id, v_user, 'strategy.draft_applied', 'strategic_plans', p_plan_id, 'apply',
          jsonb_build_object('objectives', v_created_obj, 'businessUnitId', v_plan.business_unit_id), 'f12');

  RETURN jsonb_build_object('ok', true, 'planId', p_plan_id,
    'objectivesCreated', v_created_obj, 'kpisCreated', v_created_kpi,
    'message', 'Rascunho aplicado ao planejamento como rascunho, sem responsáveis nem metas.');
END;
$$;

REVOKE ALL ON FUNCTION public.f12_apply_strategy_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f12_apply_strategy_draft(uuid) TO authenticated;