# F12.1-C2A — Estado central da Jornada, progresso real e retomada segura

Continuação de F12.1-A, F12.1-B e F12.1-C1. Aditivo e idempotente. Nada publicado, nenhum dado
da RM criado ou alterado e `f12_apply_strategy_draft` não executada no ciclo real.

## 1. Banco (aditivo)
`public.company_strategy_profiles` ganhou `diagnosis_reviewed_at timestamptz` e
`diagnosis_reviewed_by uuid` (FK para `public.users`). Nenhuma coluna removida, nenhuma policy
afrouxada: a escrita segue a policy de `strategy.manage` na unidade.

Trigger `f12_invalidate_diagnosis_review()` (SECURITY DEFINER) em
`strategy_diagnosis_selections`: qualquer INSERT/UPDATE/DELETE de sinal limpa
`diagnosis_reviewed_at/by` da unidade. Revisão só volta a valer com nova confirmação humana.

## 2. Máquina central de estado
`deriveJourneyStatus(input): JourneyDerivedStatus` em `src/lib/gmos/strategy-recommendations.ts` é
a única fonte de verdade de fase, progresso, etapa atual, retomada e próxima ação. Pura,
determinística e sem I/O.

Fases: `not_started → profile → maturity → diagnosis → priorities → recommendations →
ready_to_apply → formalizing_plan → complete`.

## 3. Gates substantivos (nada de "clicou = concluiu")
- **Perfil**: perfil persistido e válido.
- **Maturidade**: `maturity.complete` — todas as perguntas ativas respondidas. Parcial não conclui.
- **Diagnóstico**: confirmação explícita de revisão. Vale com 0 sinais; invalida ao mudar sinal.
- **Prioridades**: 1 a 3 prioridades `selected = true` (`validatePrioritySelection`).
- **Recomendações**: rascunho pendente com total final 3–7 (`validateStrategicDraft`) e ≥ 1
  indicador por objetivo (`validateKpiSelection`).
- **Revisão**: só conclui após aplicação real no ciclo F8.

## 4. Progresso
6 etapas de peso igual. `not_started` = 0%. Após aplicar sem pendências, o teto é
`JOURNEY_FORMALIZING_MAX_PERCENT = 95`: 100% e a fase `complete` exigem a completude oficial do F8
(`officialPlanReady`), que **não** é calculada no frontend — contrato reservado à F12.1-C2B.

## 5. Retomada
`resolveJourneyResumeStep(status, savedStep)` respeita a etapa salva apenas quando ela não está
adiante do dado real; caso contrário volta para a etapa derivada. A retomada roda uma vez por
unidade e não sobrescreve navegação manual do usuário.

## 6. Pendente vs. histórico
`pendingObjectives` / `pendingKpis` contam apenas decisões sem `applied_*_id`. O que já foi levado
ao planejamento aparece como histórico na revisão e nunca volta a ser pendência.

## 7. UI
Bloco de orientação executiva no topo da Jornada: fase, motivo, percentual, contagens e um único
botão de próxima ação (etapa da jornada ou ir ao Planejamento). A etapa Diagnóstico ganhou
"Concluir revisão do diagnóstico" com aviso de invalidação. O botão final da revisão usa
exclusivamente `derived.readyToApply`.

## 8. Gates
prettier nos arquivos tocados, `tsgo --noEmit` limpo, suíte vitest verde (145 testes, 7 novos em
`strategy-journey-state.test.ts`). A RPC continua não executada end-to-end por falta de banco
isolado.
