# F12.1-C2A.2 — Cobertura de testes da máquina central da Jornada

Escopo: SOMENTE qualidade/regressão. Nenhuma migration, nenhuma alteração de schema,
nenhuma escrita nos dados da RM, nenhuma RPC executada no ciclo real, nada publicado.
Nenhuma regra de negócio funcional foi alterada (nenhum bug real foi revelado pelos testes).

Arquivo de testes: `src/lib/gmos/strategy-journey-state.test.ts`
Unidade sob teste: `deriveJourneyStatus` e `resolveJourneyResumeStep`
(`src/lib/gmos/strategy-recommendations.ts`) — puras, sem data/hora, sem rede.

## Matriz de cenários

| Grupo | Cenário | Resultado esperado | Status |
| --- | --- | --- | --- |
| Prioridades | revisado + 0 prioridades | fase `priorities`, ação "Escolha de 1 a 3 prioridades" | ✅ |
| Prioridades | 1 prioridade | gate válido, fase `recommendations` (sem rascunho) | ✅ |
| Prioridades | 3 prioridades | gate válido, `count = 3` | ✅ |
| Prioridades | 4 prioridades | `too_many`, não avança, `readyToApply=false` (regressão C1) | ✅ |
| Capacidade | 4 existentes + 3 pendentes com KPI, ciclo editável | `finalCount=7`, `ready_to_apply` | ✅ |
| Capacidade | 4 existentes + 4 pendentes | `too_many`, ação "Revise os objetivos do ciclo" | ✅ |
| Capacidade | 0 existentes + 2 pendentes | `too_few`, bloqueado | ✅ |
| Capacidade | 0 existentes + 3 pendentes com KPI | válido, `readyToApply=true` | ✅ |
| KPIs | objetivo pendente sem indicador | `readyToApply=false`, ação "Selecione indicadores para cada objetivo" | ✅ |
| KPIs | indicador de outro objetivo | não satisfaz o objetivo atual (`missingObjectiveIds=["c"]`) | ✅ |
| Plano | rascunho válido + `hasPlan=false` | href `/planejamento`, orienta criar ciclo | ✅ |
| Plano | rascunho válido + `planEditable=false` | href `/planejamento`, orienta ciclo em rascunho | ✅ |
| Plano | rascunho válido + ciclo editável | `ready_to_apply`, `readyToApply=true` | ✅ |
| Histórico | aplicado sem pendências, `officialPlanReady=null` | `formalizing_plan`, percent < 100 | ✅ |
| Histórico | aplicado + novos pendentes | `pendingObjectives` só novos; histórico em `appliedObjectives` | ✅ |
| Histórico | `pendingKpis` x `appliedKpis` | permanecem separados | ✅ |
| Histórico | histórico + novo rascunho estourando capacidade | continua inválido | ✅ |
| Retomada | persisted à frente da pendência | volta à primeira pendência | ✅ |
| Retomada | persisted atrás e já concluída | avança para `resumeStep` | ✅ |
| Retomada | persisted igual à pendência | mantém | ✅ |
| Retomada | persisted null/undefined | usa `resumeStep` | ✅ |
| Diagnóstico | maturidade completa + 0 sinais + review=false | `diagnosis` | ✅ |
| Diagnóstico | mesma entrada + review=true | `priorities` | ✅ |
| Diagnóstico | review invalidada com sinais > 0 | volta para `diagnosis`, `readyToApply=false` | ✅ |
| Contrato F8 | applied + `officialPlanReady=null` | `formalizing_plan`, percent ≤ 95 | ✅ |
| Contrato F8 | applied + `officialPlanReady=false` | `formalizing_plan` | ✅ |
| Contrato F8 | applied + `officialPlanReady=true` | `complete`, 100% | ✅ |
| Contrato F8 | `officialPlanCompleteness=42` | apenas propagado; fase e percent inalterados | ✅ |

Testes A/B/C1/C2A anteriores preservados sem afrouxamento de assertions.

## Wrappers legados

`rg` confirmou zero callers de `journeyProgress`, `nextJourneyAction` e `JourneyState`
fora do próprio `strategy-recommendations.ts` (nem em rotas, nem em testes, nem em docs).
Foram marcados com `@deprecated` para impedir uso novo; comportamento e assinatura
inalterados, sem impacto na rota `/jornada-estrategica`.

## Gates executados

| Gate | Comando | Resultado |
| --- | --- | --- |
| Formatação | `bunx prettier --write` (arquivos tocados) | OK |
| Tipos | `bunx tsgo --noEmit` | OK, zero erros |
| Testes | `bunx vitest run` | 10 arquivos, 173 testes, 173 passando |
| Build | `bun run build` | OK, `✓ built in 8.11s` + artefatos do worker gerados |

Total de testes: 145 → 173 (28 novos).
