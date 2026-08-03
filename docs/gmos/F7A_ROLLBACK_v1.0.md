# F7-A / F7-B — Rollback

A entrega é aditiva. Reverter não afeta dados, papéis, atribuições nem policies.

## 1. Banco

Única criação de objeto:

```sql
DROP FUNCTION IF EXISTS public.gmos_scope_is_same_or_descendant(uuid, uuid);
```

Não há dado a restaurar: nenhuma tabela, coluna, papel, permissão, policy ou GRANT
existente foi alterado ou removido.

## 2. Frontend

Reverter os arquivos:

- `src/lib/auth-context.tsx` (volta ao contexto de sessão puro)
- `src/components/gmos/permission-gate.tsx` (remover)
- `src/lib/gmos/navigation.ts`, `src/lib/gmos/navigation.test.ts`
- `src/components/gmos/app-shell.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/routes/_authenticated/index.tsx`
- `src/routes/_authenticated/acessos.tsx`

## 3. Validação pós-rollback

1. `bunx tsgo --noEmit`
2. `bunx vitest run`
3. `bun run build`
4. Login real e navegação por `/`, `/estrutura`, `/acessos`.
