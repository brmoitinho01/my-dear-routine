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
- `src/components/gmos/executive-demo-panel.tsx` — semáforo de KPIs (no alvo / em atenção / crítico), progresso médio das ações, **Execuções concluídas** (taxa de conclusão do conjunto exibido, com texto `X de Y execuções`) e três tendências (realizado vs meta) com Recharts.
- Cadeia visual **objetivo → KPI (histórico e meta) → plano de ação** em `/planejamento`.
- O aviso aparece em `/`, `/apresentacao`, `/planejamento`, `/planos-de-acao` e `/rotinas` apenas quando o contexto selecionado contém o lote.

## Regra de semáforo
Calculada na leitura, com a última competência de cada KPI:
- `menor é melhor`: no alvo se `realizado ≤ meta`; em atenção até `meta × 1,10`; crítico acima.
- `maior é melhor` / `faixa ideal`: no alvo se `realizado ≥ meta`; em atenção até `meta × 0,90`; crítico abaixo.
- Sem medição ou sem meta: "sem medição", nunca estimado.

## Ressalvas de apresentação (hotfix F5)
- `/apresentacao` exibe o selo **"Fase 5 · Demonstração controlada"**; o encerramento diz **"Pronto para demonstração"** e declara explicitamente: protótipo executivo para validação, **não homologado para operação/produção**.
- O bloco passou a se chamar **"Visão consolidada do Grupo"**: a estrutura organizacional é lida da base; os indicadores da RM Mineração incluem o lote demonstrativo identificado pelo banner; Meu Querido e XRM Pré-Moldados permanecem sem dados inventados.
- A métrica `completed / total de execuções` **não é chamada de aderência**. No painel executivo ela se chama **"Execuções concluídas"** e representa a taxa de conclusão do conjunto exibido.
- O KPI **"Aderência às rotinas críticas"** continua separado, com fórmula, meta e medições originais — não foi alterado por este hotfix.
- Hotfix exclusivamente de frontend/documentação: nenhuma migration, escrita no banco, alteração de usuários, papéis, RLS, secrets ou publicação.

## Blocos de apresentação executiva (F5 — melhoria de apresentação)
Ordem da rota `/apresentacao`: Hero → Contexto da apresentação → Leitura executiva → Painel executivo/gráficos → Do planejamento à execução → Visão consolidada → Capacidades → Segurança → Encerramento.

- **Contexto da apresentação** (`src/components/gmos/presentation-context.tsx` → `PresentationContext`): organização (Grupo Moitinho), empresa e filial selecionadas, período das medições retornado pelo painel e natureza dos dados — "Cenário demonstrativo" quando `panel.isDemo`, "Dados operacionais" caso contrário. A natureza nunca é decidida por empresa/slug em hardcode.
- **Leitura executiva** (`ExecutiveReading`, mesmo arquivo): frases derivadas apenas de `ExecutivePanel` — total e distribuição de KPIs (no alvo / em atenção / crítico / sem medição), progresso médio e planos concluídos, taxa de conclusão das execuções e período analisado. A conclusão é neutra e condicional (críticos → priorização; atenção → atenção; todos medidos no alvo → dentro do alvo; sem medição → nenhuma conclusão). Rodapé fixo: "Leitura automática do cenário; decisão e validação permanecem humanas."
- **Do planejamento à execução** (`src/components/gmos/presentation-flow.tsx`): o fluxo genérico foi reaproveitado e movido para esta seção (sem duplicação), com artefatos por etapa — Planejar (objetivo, pilar, meta), Medir (KPI, fórmula, competência, fonte), Agir (plano 5W2H, prazo, custo, progresso), Executar (rotina, evidência, status) e Governar (RLS, permissões, auditoria, validação humana). Cada etapa liga para rota existente: `/planejamento`, `/planos-de-acao`, `/rotinas`, `/acessos`. O texto declara que o fluxo é a arquitetura já construída e que integrações, alertas e reuniões avançadas são próximas fases.
- Escopo estritamente frontend/leitura: nenhuma migration, escrita, alteração de RLS/permissões/usuários, secrets, integrações ou publicação.
