# F12.1-B — Seleção humana de KPIs, fonte não oficial e mapeamento seguro de pilares

Continuação da F12.1-A. Aditivo e idempotente. Nada publicado. Nenhum dado da RM alterado e
`f12_apply_strategy_draft` não foi executada no ciclo real.

## 1. `strategy_recommendation_kpi_decisions`
`organization_id`, `business_unit_id`, `template_objective_id` → `strategy_template_objectives`,
`template_kpi_id` → `strategy_template_kpis`, `decision` (`accepted|discarded`),
`applied_kpi_id` → `kpis`, `applied_at`, `created_at/by`, `updated_at/by`.
FK composta `(business_unit_id, organization_id)` → `business_units`.
`UNIQUE (business_unit_id, template_kpi_id)`. Triggers `f1_touch_updated_at` e `f2_audit`.

RLS: `SELECT` exige `strategy.read` no escopo da unidade; `INSERT`/`UPDATE` exigem
`strategy.manage`. Sem policy ampla por authenticated, sem `DELETE` (desmarcar grava
`discarded` via upsert). `GRANT SELECT, INSERT, UPDATE` a `authenticated`, `ALL` a
`service_role`, `anon` revogado. Zero linhas seedadas.

## 2. Camada de acesso
`fetchKpiDecisions(businessUnitId)` e `saveKpiDecision(ctx, {...})` em
`src/lib/gmos/strategy-journey.ts`, com o client normal sob RLS.
`ApplyResult` passou a expor `objectivesWithoutKpi`.

## 3. Motor determinístico
`acceptedKpiIds(templateObjectiveId, selections, kpis)` e
`validateKpiSelection(acceptedObjectiveIds, selections, kpis)`: ausência de decisão é
"não selecionado"; só conta `accepted` cujo KPI pertence ao objetivo tanto na decisão quanto
no catálogo. Regra: ao menos 1 indicador por objetivo aceito — nunca um mínimo maior.

## 4. UX
Cada KPI tem checkbox próprio, agrupado em Resultado / Performance / Qualidade, com selo
`Selecionado para o rascunho`. Microcopy: `Fonte sugerida:`, `Fórmula sugerida:` e
`frequência sugerida:`. Objetivo no rascunho sem indicador mostra o alerta
"Escolha pelo menos 1 indicador para este objetivo…". Painel lateral e revisão mostram a
contagem de indicadores selecionados; a revisão lista apenas os aceitos. Confirmação informa
`N novos objetivos`, `M indicadores selecionados` e que fonte, responsáveis, baseline e metas
seguem pendentes.

## 5. RPC
Todas as proteções da F12.1-A preservadas (3–7 no total final, ciclo draft/draft, permissão,
idempotência, pilar por dimensão). Nova validação `missing_kpi_selection` no banco como fonte
de verdade. Cria apenas KPIs com decisão `accepted` e `applied_kpi_id IS NULL`, pertencentes
ao template do objetivo criado; grava `applied_kpi_id`/`applied_at`; `kpisCreated` reflete a
quantidade real criada na execução.

Copiado do template como rascunho técnico: `name`, `description`, `unit`, `formula`,
`direction`, `frequency`. Fica `NULL`: `source` (o `source_hint` nunca vira fonte oficial),
`owner_user_id`, `baseline_value`, `target_value`; `status = 'draft'`.

## 6. Pilares
Títulos reais inspecionados (somente leitura): `Gestão Administrativa & Financeira`,
`Gestão Comercial & Relacionamento`, `Gestão de Pessoas, Tecnologia & Suporte`,
`Gestão Produtiva, Lavra & Manutenção`. `f12_dimension_pillar_aliases` usa lista fechada,
case-insensitive, sem fuzzy: finance (finanças, financeiro, financeira, gestão administrativa
& financeira), marketing_sales (marketing e vendas, comercial, vendas, gestão comercial &
relacionamento), operations (operações, operacional, processos, gestão produtiva, lavra &
manutenção), people (pessoas, recursos humanos, gestão de pessoas, tecnologia & suporte),
governance (governança, direção e governança). "Gestão" isolado foi deliberadamente excluído
por ser ambíguo. Sem equivalência segura, cria o pilar canônico apenas no plano receptor.

## 7. Gates
prettier nos arquivos tocados, `tsgo --noEmit` limpo, 125 testes verdes (7 novos).
Sem infraestrutura de banco de teste isolado: a RPC **não** foi executada end-to-end.
