# F7-A — Rollback da fundação de papéis (v1.0)

A migração é aditiva: reverter é opcional e não há perda de dados anteriores.
Executar em ordem, sempre em transação, revisando cada bloco antes.

## 1. Reverter a atribuição de `group_owner` de Brenno

Use a RPC auditada — **nunca** `DELETE`, para não quebrar a trilha de auditoria:

```sql
-- localizar a atribuição
SELECT a.id
  FROM public.user_role_assignments a
  JOIN public.users u ON u.id = a.user_id
  JOIN auth.users au  ON au.id = u.auth_user_id
  JOIN public.roles r ON r.id = a.role_id
 WHERE lower(au.email) = 'brmoitinho@yahoo.com.br'
   AND r.code::text = 'group_owner'
   AND a.status = 'active';

SELECT public.gmos_revoke_role('<assignment_id>',
  'Rollback controlado da F7-A conforme decisao registrada.');
```

Atenção: a RPC **bloqueia a revogação do último `group_owner` ativo**. Isso é proteção,
não defeito. O `group_admin` de Brenno e o de João Vitor permanecem intactos.

## 2. Reverter os mapeamentos de permissão criados

```sql
BEGIN;
-- manager
DELETE FROM public.role_permissions rp
 USING public.roles r, public.permissions p
 WHERE rp.role_id = r.id AND rp.permission_id = p.id
   AND r.code::text = 'manager'
   AND p.code::text IN (
     'organization.read','structure.read','strategy.read','strategy.manage','kpi.validate',
     'action.read','action.manage','action.update_own','routine.read','routine.manage',
     'routine.execute_own','dashboard.team','dashboard.personal','user.read','role.read');

-- collaborator
DELETE FROM public.role_permissions rp
 USING public.roles r, public.permissions p
 WHERE rp.role_id = r.id AND rp.permission_id = p.id
   AND r.code::text = 'collaborator'
   AND p.code::text IN (
     'organization.read','structure.read','action.read','action.update_own',
     'routine.read','routine.execute_own','dashboard.personal');

-- group_owner (papel criado pela F7-A)
DELETE FROM public.role_permissions rp
 USING public.roles r
 WHERE rp.role_id = r.id AND r.code::text = 'group_owner';
COMMIT;
```

**Não remover** mapeamentos de `group_admin`: eles são anteriores à F7-A e o rollback deve
preservá-los integralmente.

## 3. Reverter os papéis

Só é possível após os passos 1 e 2 (sem atribuições e sem mapeamentos dependentes).
Preferir desativação a exclusão física:

```sql
UPDATE public.roles SET status = 'inactive', updated_at = now()
 WHERE code::text IN ('group_owner','manager','collaborator')
   AND NOT EXISTS (
     SELECT 1 FROM public.user_role_assignments a
      WHERE a.role_id = roles.id AND a.status IN ('active','pending'));
```

`group_admin` **nunca** é alterado por este rollback.

## 4. Reverter o índice anti-duplicidade

```sql
DROP INDEX IF EXISTS public.ura_unique_active_assignment;
```

Observação: `ura_active_uk` é anterior à F7-A e deve permanecer — ela já impede duplicidade
de atribuição ativa por `(user_id, role_id, scope_id)`.

## 5. Permissões

Nenhuma permissão foi criada pela F7-A (as seis exigidas já existiam), portanto **não há
`DELETE` em `public.permissions`** neste rollback. Se um ambiente futuro criar alguma pela
primeira vez, remover apenas os códigos ausentes antes da execução, e somente após o passo 2.

## 6. Validação pós-rollback

```sql
SELECT r.code::text, r.status,
       (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id) AS permissoes
  FROM public.roles r ORDER BY r.code::text;

SELECT count(*) FROM public.user_role_assignments a
  JOIN public.roles r ON r.id = a.role_id
 WHERE r.code::text IN ('group_owner','manager','collaborator') AND a.status = 'active';
```

Depois: `bunx tsgo --noEmit`, `bunx vitest run` e `bun run build`.