# F7-E1 — Classificação temporal e medições pendentes (v1.0)

Correção pequena, sem migration, sem alteração de dados/acessos e sem publicação.
Arquivos: `src/lib/gmos/my-work.ts`, `src/lib/gmos/group-dashboard.ts`,
`src/lib/gmos/dashboards.test.ts` e consumidores ajustados apenas para compilar.

## 1. Classificação temporal (`my-work.ts`)

`TimeBuckets<T>` = `late | today | upcoming | later | recentlyDone | doneOlder`.

- `bucketByDue(items, today, doneStatus, options?)` recebe a data base `today`
  explicitamente e nunca lê o relógio do sistema.
- `upcoming`: somente de amanhã até `today + 7`, inclusive.
- `later`: `today + 8` em diante e itens abertos sem `dueDate`.
- `late`: aberto com `dueDate < today`; status terminal nunca é atrasado.
- Concluídos/cancelados usam `completedReference`:
  - `recentlyDone`: referência entre `today - 14` e `today`, inclusive;
  - `doneOlder`: anterior a `today - 14` ou sem referência.
- Rotina: `completedReference = completed_at`, fallback `due_date`.
- Ação: `updated_at` é selecionado na consulta, exposto em `MyAction.updatedAt`
  e `completedReference = updated_at`, fallback `due_date`.
- `onlyOwned(items, meUserId)` exportado: exclui `ownerUserId` nulo e diferente;
  sem usuário retorna lista vazia. `onlyMine` permanece como alias.

## 2. Medições pendentes (`group-dashboard.ts`)

`pendingMeasurements()` filtra exclusivamente `status === "pending"`. O enum real
de `kpi_measurements.status` é `('pending','validated','rejected')`, portanto
`validated` e `rejected` (e qualquer valor futuro) ficam fora do "aguardando
validação".

## 3. Testes (data fixa `2026-02-01`)

Amanhã e `+7` em `upcoming`; `+8` e item sem prazo em `later`; concluído há 14
dias em `recentlyDone` e há 15 dias ou sem referência em `doneOlder`;
`completed`/`cancelled` nunca em `late`; `onlyOwned` excluindo owner nulo e de
outro usuário; `pendingMeasurements` retornando só `pending`.

## 4. Qualidade

Prettier nos arquivos tocados, `bunx tsgo --noEmit` sem erros, `bunx vitest run`
com 51 testes verdes, `bun run build` com sucesso.

## 5. Rollback

`git revert <commit-F7E1>`. Sem efeito de banco, dados, papéis ou publicação.
