# F8.1-A — Direcionamento por decisões estruturadas (v1.0)

Bloco aditivo e reversível. F8, F9, F12 e F12.1 permanecem preservados. Nenhuma IA,
nenhuma frase inventada: todo texto oficial é síntese determinística de escolhas
explícitas da liderança.

## 1. Banco (aditivo)

`public.plan_direction_choices` — uma linha por ciclo (`UNIQUE (plan_id)`):
`focus_groups`, `value_propositions`, `competitive_edges`, `ambition`, `value_codes`,
`priority_dimension`, textos curtos de "Outro", auditoria e `updated_at`.
`GRANT SELECT/INSERT/UPDATE` a `authenticated`, `ALL` a `service_role`, sem `DELETE`.
RLS: leitura exige `strategy.read` e escrita `strategy.manage` no escopo da unidade.
Nenhuma migration destrutiva; nenhum dado removido.

## 2. Domínio puro

- `src/lib/gmos/strategic-direction-builder.ts` — bibliotecas de opções (foco, valor,
  forma de competir, ambição, comportamentos, prioridade), limites de cardinalidade,
  `validateDirectionChoices`, `synthesizeMission/Vision/Values/StrategicNorth`,
  `synthesizeStrategicIdentity` e `identityReplacement`.
- `src/lib/gmos/planning-diagnosis.ts` — ponte factual F12 → F8:
  `selectedStatementsBySwot`, `synthesizeContextSummary`, `synthesizePlanningDiagnostic`,
  `diagnosisReadiness` e `diagnosticReplacement`. Categoria SWOT sem sinal marcado fica
  vazia de propósito.

## 3. Experiência

`/planejamento`, etapa 1: cards e chips de decisão com prévia do texto sintetizado.
Substituir texto existente diferente exige confirmação com comparação lado a lado.
Etapa 2: diagnóstico montado a partir da Jornada, com fatos (setor, modelo, fase,
maturidade, prioridades, sinais) e CTA para completar a Jornada quando faltar insumo.
As textareas livres continuam disponíveis apenas em **Modo avançado** recolhido.
Permissão nunca é decidida no frontend: `canEdit` vem de `strategy.manage` e ciclo
aprovado continua bloqueado para edição.

## 4. Leituras e escritas

`fetchPlanDirectionChoices` / `savePlanDirectionChoices` em `src/lib/gmos/strategy.ts`
(escolhas e texto oficial gravados na mesma ação) e `fetchPlanningDiagnosisInput` em
`src/lib/gmos/strategy-journey.ts`. Tudo sujeito a RLS; nenhum service role no cliente.

## 5. Testes

`src/lib/gmos/strategic-direction.test.ts` — 19 testes novos: validação de
cardinalidade e "Outro", síntese vazia sem escolhas, estabilidade determinística,
confirmação de substituição, agrupamento SWOT, prontidão da Jornada e maturidade
provisória. Suíte total: **206 testes verdes**.

## 6. Pendências

- Conteúdo humano de decisões da RM Mineração.
- F8.1-B: objetivos e indicadores também por decisão guiada.
