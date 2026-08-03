# F7 — Rollback (v1.0)

A entrega é aditiva. Reverter não apaga dados, papéis, permissões ou atribuições.

## 1. Banco

Único objeto criado no ciclo F7:

```sql
DROP FUNCTION IF EXISTS public.gmos_scope_is_same_or_descendant(uuid, uuid);
```

Papéis, permissões, `role_permissions`, atribuições, policies e GRANTs anteriores
**não foram alterados** e portanto nada precisa ser restaurado.

Se for necessário reverter apenas a atribuição de `group_owner` a Brenno
(preservando `group_admin`), use a RPC auditada — nunca `DELETE`:

```sql
SELECT public.gmos_revoke_role('<assignment_id>', 'Rollback controlado da F7 conforme decisão registrada.');
```

Atenção: a RPC bloqueia a revogação do **último** `group_owner` ativo. Isso é proteção,
não defeito; conceda o papel a outro responsável antes, se a revogação for realmente desejada.

## 2. Frontend

Reverter os arquivos abaixo para a revisão anterior à F7:

- `src/lib/auth-context.tsx`
- `src/components/gmos/permission-gate.tsx` (remover)
- `src/components/gmos/access-admin-panel.tsx` (remover)
- `src/lib/gmos/iam.ts` (remover)
- `src/lib/gmos/rbac.ts`, `src/lib/gmos/rbac.test.ts` (remover)
- `src/lib/gmos/navigation.ts`, `src/lib/gmos/navigation.test.ts` (remover)
- `src/components/gmos/app-shell.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/index.tsx`
- `src/routes/_authenticated/acessos.tsx`

## 3. Validação pós-rollback

1. `bunx tsgo --noEmit`
2. `bunx vitest run`
3. `bun run build`
4. Login real: `/`, `/estrutura`, `/acessos` carregam com estados de carregamento,
   vazio, erro e falta de permissão preservados.
