# F12.1-C1 — Prioridades reais da liderança e maturidade provisória segura

Continuação de F12.1-A e F12.1-B. Aditivo e idempotente. Nada publicado, nenhum dado da RM
alterado e `f12_apply_strategy_draft` não executada no ciclo real.

## 1. Schema
`public.strategy_priority_selections`: `organization_id`, `business_unit_id`,
`dimension` (CHECK em finance | marketing_sales | operations | people | governance),
`selected boolean NOT NULL DEFAULT true`, created/updated at/by, FK composta
`(business_unit_id, organization_id)` → `business_units`, `UNIQUE (business_unit_id, dimension)`,
triggers `f1_touch_updated_at` e `f2_audit`.

RLS: `SELECT` exige `strategy.read` no escopo da unidade; `INSERT`/`UPDATE` exigem
`strategy.manage`. Sem policy ampla por authenticated, sem `DELETE` — desmarcar grava
`selected = false` via upsert. `GRANT SELECT, INSERT, UPDATE` a `authenticated`, `ALL` a
`service_role`, `anon` revogado. Zero linhas seedadas.

Nova função `f12_assessment_version()` (IMMUTABLE, retorna 1) espelha `ASSESSMENT_VERSION`
do frontend e é usada pela RPC para contar perguntas ativas.

## 2. Tema derivado × prioridade humana
- **Temas sugeridos pelo diagnóstico**: saída de `derivePriorityThemes`, leitura do sistema.
- **Prioridades escolhidas pela liderança**: linhas com `selected = true`, decisão registrada.
A revisão final mostra apenas as prioridades humanas como "Prioridades da liderança";
os temas derivados aparecem em bloco separado.

## 3. Regra 1–3
`validatePrioritySelection(selectedDimensions)` → `{ valid, status, message, count }`
(`too_few` / `ok` / `too_many`). A UI explica "Escolha de 1 a 3 temas…", mostra
"N de 3 prioridades selecionadas", bloqueia a quarta com aviso e persiste cada escolha.

## 4. Peso no ranking
`RankInput.priorityDimensions` alimenta `rankStrategicRecommendations`. Bônus determinístico
`PRIORITY_BONUS = 20` para objetivo cuja dimensão é prioridade humana, com reason em primeiro
lugar: "A liderança marcou {Dimensão} como prioridade para este ciclo." O filtro de setor é
aplicado antes: prioridade nunca torna template de outro setor elegível.

## 5. Maturidade provisória
`MaturityScore` ganhou `complete`, `completionPercent` e `isProvisional`.
`complete = total > 0 && answered === total`. Enquanto incompleto: `gaps` fica vazio, a UI
mostra badge "Resultado provisório", "X de Y respostas", progresso e score marcado como
provisório, sem exibir faixa Inicial/Estruturando/Gerenciado/Escalável. A band interna
continua calculada apenas para compatibilidade.

## 6. Quando maturidade influencia recomendação
Somente com `complete = true`: bônus/penalidade por lacuna e score de dimensão em
`rankStrategicRecommendations`, reason de menor maturidade e fator de maturidade em
`derivePriorityThemes`. Incompleta, nenhum desses efeitos ocorre.

## 7. Rationale curado
`Recomendado porque…` continua exclusivo de razões derivadas de dados do usuário/regra.
O `rationale` do template aparece em bloco separado "Por que este objetivo costuma ajudar",
rotulado como conhecimento curado, e nunca entra em `reasons`.

## 8. Novas proteções da RPC
Preservadas todas as regras A+B (draft/draft, permissão, total final 3–7, 1 KPI por objetivo,
`source` NULL, idempotência, pilar por dimensão) e adicionadas:
- `assessment_incomplete` quando as perguntas ativas da versão F12 não estão todas respondidas
  pela unidade (retorna `assessmentAnswered` e `assessmentTotal`);
- `missing_priority_selection` com 0 prioridades `selected = true`;
- `too_many_priorities` com mais de 3.
O botão final da revisão só habilita com `maturity.complete === true` e prioridade válida.

## 9. Gates e limitação
prettier nos arquivos tocados, `tsgo --noEmit`, suíte vitest verde. Sem banco de teste
isolado, a RPC **não** foi executada end-to-end.
