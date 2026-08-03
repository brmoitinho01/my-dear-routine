# F7-A — Fundação de papéis (v1.0)

Migração aditiva, idempotente e reversível. **Nada** de frontend, rotas, painéis ou policies foi
alterado nesta entrega. Nenhum usuário foi criado. Nada foi removido. Não publicado.

## 1. Inspeção prévia (antes de editar)

- `public.roles.code` e `public.permissions.code` são do tipo **`citext`** — **não existe enum** de
  papéis no projeto. Portanto não há tipo a estender: adicionar papel é `INSERT` idempotente.
- Tabelas inspecionadas: `roles`, `permissions`, `role_permissions`, `user_role_assignments`,
  `scopes`, `users`, `organizations`.
- `role_permissions` **não possui** constraint única em `(role_id, permission_id)` — por isso a
  migração usa `NOT EXISTS` em vez de `ON CONFLICT` (a primeira tentativa falhou exatamente com
  `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`).
- Funções SQL de autorização já existentes e preservadas: `current_user_id`, `has_permission`,
  `accessible_scope_ids`, `accessible_organization_ids`, `gmos_has_active_role`,
  `gmos_is_group_privileged`, `gmos_is_own_record`, `gmos_user_visible`,
  `gmos_company_visible_by_unit`, `gmos_template_assigned_to_me`,
  `gmos_scope_is_same_or_descendant`, `gmos_my_authorization`, `gmos_assign_role`,
  `gmos_revoke_role`.
- Índices de `user_role_assignments`: `ura_active_uk` (`active`) e
  `ura_unique_active_assignment` (`active`/`pending`).

## 2. O que a migração garante

1. **Papéis** na organização `grupo-moitinho`: `group_owner`, `group_admin`, `manager`,
   `collaborator` — `group_admin` preservado (nenhum `UPDATE`/`DELETE`).
2. **Permissões reaproveitadas.** As seis exigidas já existiam no padrão real de códigos do
   projeto, então nada novo foi criado: `dashboard.personal`, `dashboard.team`, `dashboard.group`,
   `routine.execute_own`, `routine.manage`, `role.manage`. O `INSERT ... ON CONFLICT (code) DO
   NOTHING` permanece na migração como garantia idempotente.
3. **Mapeamento**:
   - `group_owner` → todas as 23 permissões;
   - `group_admin` → mantém todas as atuais e recebe as administrativas compatíveis (23);
   - `manager` → `organization.read`, `structure.read`, `strategy.read`, `strategy.manage`,
     `kpi.validate`, `action.read`, `action.manage`, `action.update_own`, `routine.read`,
     `routine.manage`, `routine.execute_own`, `dashboard.team`, `dashboard.personal`,
     `user.read`, `role.read` (15) — **sem** `role.assign`, `role.revoke`, `role.manage`,
     `user.manage`, `permission.read`, `audit.read`, `dashboard.group`, `organization.manage`;
   - `collaborator` → `organization.read`, `structure.read`, `action.read`, `action.update_own`,
     `routine.read`, `routine.execute_own`, `dashboard.personal` (7).
4. **Anti-duplicidade**: índice parcial único
   `ura_unique_active_assignment (user_id, role_id, scope_id) WHERE status IN ('active','pending')`
   (criado com `IF NOT EXISTS`).
5. **Atribuição**: `group_owner` no escopo `organization` do Grupo Moitinho para o usuário interno
   de `brmoitinho@yahoo.com.br`, apenas se ausente. `group_admin` de Brenno e `group_admin` de
   João Vitor preservados integralmente.
6. **Nenhuma** atribuição automática de `manager` ou `collaborator`.

## 3. SQL de verificação

```sql
-- 3.1 Os quatro papéis e o total de permissões mapeadas
SELECT r.code::text AS papel, r.status,
       (SELECT count(*) FROM public.role_permissions rp WHERE rp.role_id = r.id) AS permissoes
  FROM public.roles r
  JOIN public.organizations o ON o.id = r.organization_id AND o.slug = 'grupo-moitinho'
 ORDER BY r.code::text;
-- esperado: collaborator/active/7, group_admin/active/23, group_owner/active/23, manager/active/15

-- 3.2 Atribuições de Brenno e João
SELECT au.email, r.code::text AS papel, s.scope_type, a.status
  FROM public.user_role_assignments a
  JOIN public.users u  ON u.id = a.user_id
  JOIN auth.users au   ON au.id = u.auth_user_id
  JOIN public.roles r  ON r.id = a.role_id
  JOIN public.scopes s ON s.id = a.scope_id
 ORDER BY au.email, r.code::text;
-- esperado: brmoitinho@yahoo.com.br -> group_admin e group_owner (organization, active)
--           joaovitor20062006@gmail.com -> group_admin (organization, active)

-- 3.3 Ausência de manager/collaborator atribuídos
SELECT count(*) AS manager_collaborator_atribuidos
  FROM public.user_role_assignments a
  JOIN public.roles r ON r.id = a.role_id
 WHERE r.code::text IN ('manager','collaborator');
-- esperado: 0

-- 3.4 Proteção contra duplicidade
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'user_role_assignments' AND indexname = 'ura_unique_active_assignment';
```

## 4. Resultado da validação executada

| Verificação | Resultado |
| --- | --- |
| Papéis + permissões | `collaborator/active/7`, `group_admin/active/23`, `group_owner/active/23`, `manager/active/15` |
| Brenno | `group_owner` **e** `group_admin`, escopo `organization`, ambos `active` |
| João Vitor | `group_admin`, escopo `organization`, `active` (intacto) |
| `manager` / `collaborator` atribuídos | 0 |
| Índice `ura_unique_active_assignment` | presente |
| Teste real de duplicidade | rejeitado: `duplicate key value violates unique constraint "ura_active_uk"` |
| Total de permissões | 23 (nenhuma criada nesta rodada — todas já existiam) |
| `bunx tsgo --noEmit` / `bun run build` | sem erros |

## 5. Observação sobre o linter

Os avisos "Signed-In Users Can Execute SECURITY DEFINER Function" e "Extension in Public" são
**anteriores** a esta migração e intencionais: as RPCs `gmos_assign_role`/`gmos_revoke_role` e os
helpers de autorização precisam ser `SECURITY DEFINER` para evitar recursão de RLS, e validam
permissão internamente; a extensão `citext` no schema público é dependência do modelo.
Nenhuma policy foi tocada nesta mensagem.