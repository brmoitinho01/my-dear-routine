# F7 — Fundação de RBAC real e autorização de frontend (v1.0)

Primeiro incremento seguro da F7. **Não inclui** `/meu-trabalho`, `/painel-equipe`
nem `/painel-grupo`. Nada foi publicado, nenhum dado foi removido e não há mocks.

## 1. Inspeção antes de editar

Verificado diretamente no banco (migrations, catálogo e dados):

- `public.roles.code` e `public.permissions.code` são `citext` — **não existe enum** de papéis,
  portanto não há enum a estender. Adicionar valores é `INSERT` idempotente, já realizado nas
  fases anteriores da F7.
- Papéis presentes e ativos na organização Grupo Moitinho: `group_owner`, `group_admin`,
  `manager`, `collaborator`.
- 23 permissões ativas, cobrindo painel pessoal (`dashboard.personal`), painel de equipe
  (`dashboard.team`), painel corporativo (`dashboard.group`), execução própria de rotina
  (`routine.execute_own`), gestão de rotina por escopo (`routine.manage`), validação por escopo
  (`kpi.validate`) e administração de atribuições (`role.assign`, `role.revoke`, `role.read`,
  `role.manage`). **Nenhuma permissão nova era necessária** — criar sinônimos duplicaria a matriz.
- Unicidade de atribuição ativa já garantida por `ura_unique_active_assignment`
  (`user_id, role_id, scope_id` para status `active`/`pending`) e por `ura_active_uk`.
- Funções auxiliares presentes: `current_user_id`, `has_permission`, `gmos_has_active_role`,
  `gmos_is_group_privileged`, `gmos_is_own_record`, `gmos_user_visible`,
  `gmos_company_visible_by_unit`, `gmos_template_assigned_to_me`, `accessible_scope_ids`,
  `accessible_organization_ids`, `gmos_my_authorization`.
- RPCs transacionais presentes: `gmos_assign_role` e `gmos_revoke_role`, com validação de
  permissão, compatibilidade papel × tipo de escopo, justificativa mínima de 10 caracteres,
  bloqueio de autoatribuição/autorrevogação e **proteção do último `group_owner` ativo**.

### Migração desta rodada

Única lacuna encontrada e corrigida, de forma aditiva e idempotente:

- `public.gmos_scope_is_same_or_descendant(candidate, assigned)` — `SECURITY DEFINER`,
  `search_path` vazio, `EXECUTE` revogado de `PUBLIC`/`anon`, concedido a
  `authenticated`/`service_role`.

Nenhuma tabela, coluna, papel, permissão, mapeamento, policy ou GRANT existente foi alterado
ou removido. Não houve atribuição automática de `manager` ou `collaborator`.

## 2. Matriz papel × permissão × escopo

| Permissão             | Domínio    | Escopos permitidos      | group_owner | group_admin | manager | collaborator |
| --------------------- | ---------- | ----------------------- | ----------- | ----------- | ------- | ------------ |
| `organization.read`   | org        | organização             | sim         | sim         | sim     | sim          |
| `organization.manage` | org        | organização             | sim         | sim         | —       | —            |
| `structure.read`      | org        | org/empresa/filial/área | sim         | sim         | sim     | sim          |
| `strategy.read`       | estratégia | org/empresa/filial      | sim         | sim         | sim     | —            |
| `strategy.manage`     | estratégia | org/empresa/filial      | sim         | sim         | sim     | —            |
| `kpi.validate`        | estratégia | org/empresa/filial      | sim         | sim         | sim     | —            |
| `action.read`         | ação       | org/empresa/filial      | sim         | sim         | sim     | sim          |
| `action.manage`       | ação       | org/empresa/filial      | sim         | sim         | sim     | —            |
| `action.update_own`   | ação       | org/empresa/filial/área | sim         | sim         | sim     | sim          |
| `routine.read`        | rotina     | org/empresa/filial      | sim         | sim         | sim     | sim          |
| `routine.manage`      | rotina     | org/empresa/filial      | sim         | sim         | sim     | —            |
| `routine.execute_own` | rotina     | org/empresa/filial/área | sim         | sim         | sim     | sim          |
| `dashboard.group`     | painel     | organização             | sim         | sim         | —       | —            |
| `dashboard.team`      | painel     | org/empresa/filial/área | sim         | sim         | sim     | —            |
| `dashboard.personal`  | painel     | org/empresa/filial/área | sim         | sim         | sim     | sim          |
| `user.read`           | iam        | org/empresa             | sim         | sim         | sim     | —            |
| `user.manage`         | iam        | organização             | sim         | sim         | —       | —            |
| `role.read`           | iam        | organização             | sim         | sim         | sim     | —            |
| `role.assign`         | iam        | org/empresa/filial/área | sim         | sim         | —       | —            |
| `role.revoke`         | iam        | org/empresa/filial/área | sim         | sim         | —       | —            |
| `role.manage`         | iam        | organização             | sim         | sim         | —       | —            |
| `permission.read`     | iam        | organização             | sim         | sim         | —       | —            |
| `audit.read`          | governança | organização             | sim         | sim         | —       | —            |

Alcance por escopo: **toda atribuição vale para o escopo concedido e para seus descendentes**
(`has_permission` sobe a cadeia de `scopes`; `gmos_scope_is_same_or_descendant` expressa a mesma
regra de forma reutilizável). Owner/admin atuam na organização; gestor no seu escopo e
descendentes; colaborador apenas no que é próprio ou atribuído a ele.

## 3. RLS revisada

Confirmado, sem alteração necessária, para `user_role_assignments`, `roles`, `permissions`,
`role_permissions`, `scopes`, `audit_events`, `routine_templates`, `routine_executions`,
`action_plans`, `strategic_plans`, `strategic_objectives`, `kpis` e `kpi_measurements`:

- todas as tabelas têm RLS habilitada e **nenhuma** policy concede acesso só por estar
  autenticado — todas passam por `has_permission`, `gmos_*` ou posse do registro;
- `audit_events` é imutável (gatilhos bloqueiam `UPDATE` e `DELETE`);
- não existe policy de `DELETE` nas entidades F1/F2 — não há exclusão física;
- leitura de rotinas/ações por colaborador é limitada a itens próprios ou atribuídos
  (`gmos_is_own_record`, `gmos_template_assigned_to_me`).

## 4. Validação por SELECT

| Verificação                                | Resultado                                                        |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Brenno (`brmoitinho@yahoo.com.br`)         | `group_owner` **e** `group_admin`, escopo organização, ativos    |
| João Vitor (`joaovitor20062006@gmail.com`) | `group_admin`, escopo organização, ativo                         |
| `manager` / `collaborator`                 | nenhuma atribuição automática (0 registros)                      |
| Duplicidade ativa                          | impedida por `ura_unique_active_assignment` + validação na RPC   |
| Permissões mapeadas                        | 23 permissões, matriz da seção 2 conferida em `role_permissions` |

## 5. Frontend

- `src/lib/gmos/rbac.ts` — funções puras (`primaryRoleCode`, `buildAuthorization`) sobre
  `public.gmos_my_authorization()`; nada concede acesso.
- `src/lib/auth-context.tsx` — autorização real tipada: `user`, `internalUser`, `roles`,
  `assignments`, `permissions`/`effectivePermissions`, `scopes`, `defaultScope`, `primaryRole`,
  `isGroupOwner`, `isGroupAdmin`, `isManager`, `isCollaborator`, `hasNoAssignment`,
  `can(permissionCode, scopeId?)`, `loading`, `error`, `refresh`, `signOut`.
  **Sem e-mail, papel ou permissão codificado na UI.**
- `src/components/gmos/permission-gate.tsx` — `PermissionGate`, `RequirePermission`,
  `AuthorizationGate` (guard de rota que aguarda a autorização e bloqueia usuário sem
  atribuição), `AccessDenied` e `RoleBadge`.
- `src/lib/gmos/navigation.ts` — menu dinâmico por permissão, apenas com rotas existentes
  (sem links quebrados).
- `src/components/gmos/app-shell.tsx` — badge de papel e menu filtrado.
- `/acessos` — leitura do próprio acesso + diretório de usuários, papéis, atribuições e escopos
  visíveis pela RLS; atribuir/revogar somente via RPC com justificativa. Owner/admin veem o
  permitido, gestor vê a equipe do seu escopo, colaborador recebe acesso negado. Sem convites.

## 6. Testes e qualidade

- Vitest já configurado. `bunx vitest run`: 10 testes aprovados
  (resolução de papel, precedência de `group_owner`, herança/negação de escopo, menu por permissão,
  usuário sem atribuição).
- `bunx tsgo --noEmit` sem erros; `bun run build` concluído; Prettier aplicado.

## 7. Estado das fases

- **F6 — Fundação do Método GMOS: concluída.**
- **F7 — RBAC real e autorização de frontend: em andamento** (este incremento entrega a fundação;
  painéis por perfil ficam para o próximo incremento).
