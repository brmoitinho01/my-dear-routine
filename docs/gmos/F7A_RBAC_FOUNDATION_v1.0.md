# F7-A / F7-B — Fundação de RBAC real e autorização tipada

Escopo desta entrega: **somente fundação**. Nenhum painel ou rota operacional nova.

## 1. Estado inspecionado antes da alteração

- Papéis já existentes em `public.roles`: `group_owner`, `group_admin`, `manager`, `collaborator`.
- 17 permissões ativas em `public.permissions` (código `citext`).
- Atribuições ativas em `public.user_role_assignments`:
  - Brenno Rebouças Moitinho — `group_owner` e `group_admin`, escopo `organization` (Grupo Moitinho).
  - João Vitor — `group_admin`, escopo `organization`.
- Índices de unicidade já presentes: `ura_active_uk` e `ura_unique_active_assignment`
  (`user_id, role_id, scope_id` para status `active`/`pending`) — **duplicidade já impedida**,
  nada foi recriado.

## 2. Migração aplicada (aditiva e idempotente)

Única alteração de banco necessária:

- `public.gmos_scope_is_same_or_descendant(candidate, assigned)` — `SECURITY DEFINER`,
  `search_path` vazio, `EXECUTE` revogado de `PUBLIC`/`anon` e concedido a
  `authenticated`/`service_role`.

Nada foi removido, renomeado ou reescrito. Nenhum dado, papel, permissão, policy
ou GRANT existente foi alterado.

## 3. Equivalência de nomes (solicitado → existente)

| Solicitado                    | Implementação no banco                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| `current_user_id`             | `public.current_user_id()`                                       |
| `has_permission`              | `public.has_permission(code, scope_type, scope_id)`              |
| `scope_is_same_or_descendant` | `public.gmos_scope_is_same_or_descendant(uuid, uuid)` **(novo)** |
| `is_group_privileged`         | `public.gmos_is_group_privileged()`                              |
| `has_active_role`             | `public.gmos_has_active_role(code)`                              |
| `owns_record`                 | `public.gmos_is_own_record(user_id)`                             |
| `dashboard.personal.read`     | `dashboard.personal`                                             |
| `dashboard.team.read`         | `dashboard.team`                                                 |
| `dashboard.group.read`        | `dashboard.group`                                                |
| `routine.own.execute`         | `routine.execute_own`                                            |
| `routine.scope.manage`        | `routine.manage`                                                 |
| `iam.assignments.manage`      | `role.assign` + `role.revoke`                                    |

Os códigos já existiam com essa nomenclatura desde a M0/F2; criar sinônimos
duplicaria a matriz de permissões sem ganho de segurança.

## 4. Matriz de papéis × permissões (resumo)

| Papel          | Escopo típico           | Leitura               | Execução            | Gestão        | IAM                          |
| -------------- | ----------------------- | --------------------- | ------------------- | ------------- | ---------------------------- |
| `group_owner`  | organização             | tudo                  | sim                 | sim           | `role.assign`, `role.revoke` |
| `group_admin`  | organização             | tudo                  | sim                 | sim           | `role.assign`, `role.revoke` |
| `manager`      | empresa / filial / área | escopo + descendentes | sim                 | sim no escopo | não                          |
| `collaborator` | filial / área           | próprio trabalho      | somente o que é seu | não           | não                          |

A herança é **descendente**: uma atribuição em um escopo vale para ele e para todos
os escopos filhos, conforme `public.has_permission` e `gmos_scope_is_same_or_descendant`.

## 5. Frontend — autorização tipada

- `src/lib/gmos/rbac.ts`: funções puras (`buildAuthorization`, `primaryRoleCode`) e leitura via
  `public.gmos_my_authorization()`. Nada concede acesso.
- `src/lib/auth-context.tsx`: `AuthProvider` único com sessão + autorização real, expondo
  `user`, `internalUser`, `roles`, `permissions`, `scopes`, `primaryRole`, `isGroupOwner`,
  `isGroupAdmin`, `isManager`, `isCollaborator`, `hasNoAssignment`, `can(permission, scopeId?)`,
  `loading`, `error`, `refresh`, `signOut`.
- `src/components/gmos/permission-gate.tsx`: `PermissionGate`, `RequirePermission`,
  `AuthorizationGate` (aguarda autorização e bloqueia sem atribuição) e `AccessDenied`.
- `src/lib/gmos/navigation.ts`: filtragem de menu por permissão (pura e testada).
- Nenhum e-mail, papel ou permissão codificado no frontend.

## 6. Testes

`bunx vitest run` — 9 testes aprovados:

- `rbac.test.ts`: papel principal determinístico, herança de escopo, negação fora do escopo.
- `navigation.test.ts`: sem autorização, colaborador, usuário sem atribuição ativa, proprietário.

`bunx tsgo --noEmit` sem erros.

## 7. Fora de escopo nesta entrega

Removidos por não pertencerem à F7-A/F7-B: `/meu-trabalho`, `/painel-grupo`,
`/painel-equipe`, painel de administração de acessos e seus módulos de consulta.
Serão reintroduzidos nas fases F7-C/F7-D com especificação própria.
