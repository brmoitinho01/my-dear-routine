# F5 — Cenário Executivo Demonstrativo (DEMO-RM-2026-V1)

## Escopo
Somente a unidade existente **Filial RM Mineração** (`business_unit_id = a3deb3cf-6b83-463b-b665-983a843dab4b`).
Nenhuma outra empresa, filial, tabela, política ou usuário foi alterado.

## Natureza dos dados
Todos os registros são **ilustrativos**, criados para apresentação executiva.
Cada registro carrega o marcador textual:

`DEMO-RM-2026-V1 — cenário ilustrativo; futura origem a validar (CRTI/ERP/registro GMOS)`

gravado em `kpis.source`, `kpi_measurements.source_evidence`, `strategic_objectives.description`,
`action_plans.expected_result`, `strategic_risks.description` e `routine_executions.notes`.

## Inventário aplicado

| Tabela | Registros |
| --- | --- |
| `strategic_objectives` | 4 |
| `kpis` | 9 |
| `kpi_measurements` | 54 |
| `action_plans` | 6 |
| `strategic_risks` | 4 |
| `routine_executions` | 16 |
| **Total** | **93** |

Faixa de UUID reservada ao lote: `5f0000XX-0de0-4d00-8a00-XXXXXXXXXXXX`.
Nenhum UUID fora dessa faixa foi criado ou modificado.

## Idempotência e reversibilidade
- `docs/gmos/DEMO_RM_2026_V1_SEED.sql` — reexecutável; a segunda execução insere 0 linhas (validado: 93 `INSERT 0 0`).
- `docs/gmos/DEMO_RM_2026_V1_ROLLBACK.sql` — remove exclusivamente os 93 UUIDs do lote, na ordem inversa das dependências.
- O rollback não toca em plano, pilares, modelos de rotina, estrutura organizacional, papéis ou auditoria.

## Validações executadas
- 0 registros do lote fora da Filial RM Mineração.
- 0 KPIs órfãos (todos com objetivo válido).
- 0 políticas de exclusão (`DELETE`) nas tabelas F2 — a remoção do lote é feita por script administrativo, não pela aplicação.
- `bun run build` e typecheck sem erros.

## Frontend
- `src/components/gmos/demo-banner.tsx` — aviso "Cenário demonstrativo · RM Mineração / Dados ilustrativos para apresentação. Não representam resultados reais."
- `src/lib/gmos/demo.ts` — detecção do lote pelo marcador **real no banco** (`kpis.source LIKE 'DEMO-RM-2026-V1%'`), nunca por slug ou nome em hardcode.
- `src/components/gmos/executive-demo-panel.tsx` — semáforo de KPIs (no alvo / em atenção / crítico), progresso médio das ações, aderência de rotinas e três tendências (realizado vs meta) com Recharts.
- Cadeia visual **objetivo → KPI (histórico e meta) → plano de ação** em `/planejamento`.
- O aviso aparece em `/`, `/apresentacao`, `/planejamento`, `/planos-de-acao` e `/rotinas` apenas quando o contexto selecionado contém o lote.

## Regra de semáforo
Calculada na leitura, com a última competência de cada KPI:
- `menor é melhor`: no alvo se `realizado ≤ meta`; em atenção até `meta × 1,10`; crítico acima.
- `maior é melhor` / `faixa ideal`: no alvo se `realizado ≥ meta`; em atenção até `meta × 0,90`; crítico abaixo.
- Sem medição ou sem meta: "sem medição", nunca estimado.
