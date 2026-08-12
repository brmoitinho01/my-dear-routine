# F12.1-A — Hardening da integração Jornada (F12) × Planejamento (F8)

Escopo: apenas integridade da RPC `f12_apply_strategy_draft` e reflexo mínimo no frontend.
F8, F8.5 e F9 preservados. Nenhum dado oficial da RM foi alterado; a RPC não foi executada
no ciclo real. Nada publicado.

## 1. Faixa 3–7 pelo total final
`existentes + pendentes = final`, com objetivo válido no mesmo conceito do F8
(`strategic_objectives.status <> 'cancelled'`). Erros: `plan_over_limit`, `too_many`, `too_few`.
Retorno inclui `existingObjectives`, `pendingObjectives`, `finalObjectives`, `capacityRemaining`.

## 2. Ciclo elegível
Somente `status = 'draft'` e `review_status = 'draft'`. Qualquer outro estado retorna
`plan_not_editable`.

## 3. KPIs
Auto-criação removida. `kpisCreated` é sempre 0 nesta fase; `source_hint` não é copiado.

## 4. Pilares por dimensão
`f12_dimension_pillar_title`: finance→Finanças, marketing_sales→Marketing e Vendas,
operations→Operações, people→Pessoas, governance→Governança. Reutiliza pilar não arquivado
com título equivalente no próprio plano; se não houver, cria o pilar canônico apenas nesse
plano. Pilares existentes não são movidos nem renomeados.

## 5. Idempotência
`FOR UPDATE` nas decisões pendentes e `UPDATE ... WHERE applied_objective_id IS NULL`;
decisão já aplicada nunca reaplica. Sem dedupe heurístico por título.

## 6. Frontend
`fetchCurrentPlan` prioriza ciclo em rascunho editável e retorna `objectiveCount` e `editable`.
`validateStrategicDraft(accepted, existing)` calcula total final e capacidade restante;
revisão e painel lateral exibem "comporta até N novo(s)".

## 7. Gates
prettier, `tsgo --noEmit`, 118 testes verdes (6 novos de capacidade).
