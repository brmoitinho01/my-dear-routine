# F7-E1 — Regras críticas corrigidas

Base: HEAD `101330838469bd62db87b9caeaa44035bc1da317`.
Escopo: apenas regras puras, consultas necessárias e testes.
**Nenhuma migration executada, nada publicado, nenhum dado, usuário, papel ou
atribuição alterado, nenhuma rota ou item de navegação modificado.**

## 1. `src/lib/gmos/my-work.ts`

- `TimeBuckets<T>` = `late`, `today`, `upcoming`, `later`, `recentlyDone`, `doneOlder`.
- `upcoming`: prazo de amanhã até hoje +7, inclusive.
- `later`: prazo maior que hoje +7 **ou** item aberto sem prazo.
- `Datable` aceita `completedReference?: string | null`, resolvido pela consulta.
  `doneReferenceDate` usa `completedReference` → `completedAt` → `updatedAt` →
  `dueDate`.
- `recentlyDone`: referência entre hoje −14 e hoje, inclusive.
- `doneOlder`: referência anterior a hoje −14 **ou** ausência de referência —
  conclusão sem referência nunca é chamada de recente.
- `bucketByDue` continua recebendo `today` explicitamente e nunca lê o relógio.
- Rotina: `completedReference = completed_at`, com fallback para `due_date`
  somente quando `completed_at` é nulo.
- Ação: `updated_at` selecionado, exposto em `updatedAt` e usado como
  `completedReference`, com fallback para `due_date`.
- `summarizeMyWork` usa os novos buckets sem alteração de significado.
- Novo helper puro `onlyOwned(items, meUserId)`: exclui responsável nulo e de
  outros usuários. `onlyMine` permanece como alias de compatibilidade. A consulta
  continua filtrando por `owner_user_id` no banco.

## 2. `src/lib/gmos/group-dashboard.ts`

`pendingMeasurements()` retorna exclusivamente `status === "pending"`. Nenhum
outro status (`validated`, `rejected`, `draft`, `cancelled` ou desconhecido) é
tratado como aguardando validação.

## 3. `src/lib/gmos/routine-access.ts`

`canOperateExecution({ currentUserId, executionOwnerId, templateOwnerId,
canExecuteOwn, canManage, status })` é a regra única:

1. `completed`/`cancelled` => `false`;
2. `canManage` => `true`;
3. execução própria: exige `canExecuteOwn` e ser o responsável efetivo.

Responsável efetivo: se `executionOwnerId` não é nulo, somente ele conta — o
responsável do modelo não substitui o da execução. `templateOwnerId` é
**fallback legado**, válido apenas quando `routine_executions.owner_user_id` é
nulo (execuções geradas antes de o responsável ser gravado na execução). Sem
responsável efetivo não há execução própria.

`canExecute` e `isMine` foram preservados como wrappers de compatibilidade e
delegam integralmente à nova regra.

## 4. Testes

`bunx vitest run`: **51 testes, todos passando** (32 em `dashboards.test.ts`).
Cobertura pedida, com data base fixa `2026-02-01`:

- amanhã (`2026-02-02`) e +7 (`2026-02-08`) => `upcoming`;
- +8 (`2026-02-09`) e item sem prazo => `later`;
- concluído há 14 dias (`2026-01-18`) => `recentlyDone`;
- concluído há 15 dias (`2026-01-17`) e sem referência => `doneOlder`;
- `completed`/`cancelled` com prazo vencido nunca entram em `late`;
- `onlyOwned` exclui responsável nulo e de outro usuário;
- `pendingMeasurements` inclui apenas `pending` e exclui
  `draft`/`rejected`/`cancelled`/`validated`;
- `canOperateExecution`: owner da execução + `executeOwn` (true), owner sem
  `executeOwn` (false), outro usuário com `manage` (true), outro sem `manage`
  (false), owner da execução prevalece sobre o do modelo, fallback de modelo só
  quando o owner da execução é nulo, `completed`/`cancelled` sempre false.

## 5. Qualidade

- Prettier apenas nos arquivos tocados.
- `bunx tsgo --noEmit`: sem erros.
- `bun run build`: sucesso.
- Nenhuma alteração visual: apenas o rename de bucket foi propagado em
  `meu-trabalho.tsx` (`doneRecent` → `recentlyDone`).

## 6. Rollback

Reversão por commit: `git revert <commit-F7E1>`. Não há efeito de banco, dados,
papéis ou publicação. Arquivos afetados: `src/lib/gmos/my-work.ts`,
`src/lib/gmos/routine-access.ts`, `src/lib/gmos/group-dashboard.ts`,
`src/lib/gmos/dashboards.test.ts`, `src/routes/_authenticated/meu-trabalho.tsx`
e este documento.
