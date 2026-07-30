# GMOS — F3 Contexto Corporativo v1.0

## Objetivo
Encerrar o viés da RM Mineração como empresa principal. O GMOS passa a operar como
plataforma do **Grupo Moitinho**, com empresas e filiais equivalentes, e a RM Mineração
continua como uma empresa normal dentro do Grupo.

## Escopo atual
Organização: Grupo Moitinho.

| Empresa | Slug | Filial | Slug da filial |
|---|---|---|---|
| Meu Querido | `meu-querido` | Filial Meu Querido | `filial-meu-querido` |
| XRM Pré-Moldados | `xrm-pre-moldados` | Filial XRM Pré-Moldados | `filial-xrm-pre-moldados` |
| RM Mineração | `rm-mineracao` | Filial RM Mineração | `filial-rm-mineracao` |

## Banco — migração incremental e idempotente
- Criadas apenas as filiais ausentes (Meu Querido e XRM Pré-Moldados) com `status='active'`.
- A Filial RM Mineração foi preservada; nenhum dado F2 foi alterado, movido ou excluído.
- Scopes `business_unit` garantidos de forma idempotente, com `parent_scope_id` apontando
  para o scope `company` correspondente.
- Criações registradas em `public.audit_events` com `source='migration'`.
- Nenhum `DROP`, `DELETE` ou `TRUNCATE`. Nenhuma alteração de RLS, grants ou permissões.

Contagens após a migração: 3 empresas, 3 filiais, 7 scopes, 1 plano estratégico,
4 pilares e 5 modelos de rotina (todos ainda vinculados à Filial RM Mineração).

## Frontend — contexto de empresa/filial
### Princípio de segurança
A seleção de empresa/filial é **exclusivamente preferência de interface**. Ela não concede
nenhum privilégio: toda leitura e escrita continua protegida por RLS e por
`public.has_permission(code, 'business_unit', scope_id)` avaliado no servidor.

### Componentes
- `src/lib/gmos/f3.ts`
  - `fetchWorkspaceOptions()` — lista apenas empresas/filiais que a RLS torna visíveis.
  - `fetchMe()` — identidade interna (`public.users.id`) do usuário autenticado.
  - `fetchScopePermissions(scopeId)` — consulta `has_permission` para
    `strategy.manage`, `action.manage` e `routine.manage` no scope selecionado.
  - `fetchUnitSummary(businessUnitId)` — contagens reais por filial para a visão corporativa.
- `src/components/gmos/workspace-context.tsx`
  - `WorkspaceProvider` / `useWorkspace()`.
  - Persistência da preferência em `localStorage` (`gmos.contexto.filial`).
  - A preferência é **revalidada** contra as filiais realmente visíveis; sem correspondência,
    cai para a primeira filial visível.
- `src/components/gmos/app-shell.tsx` — seletor Empresa / Filial no cabeçalho; navegação
  renomeada para “Visão do Grupo”.
- `src/routes/_authenticated/route.tsx` — provider montado acima do AppShell.

### Remoção do acoplamento
- `RM_BU_SLUG` e `fetchWorkspace()` foram removidos de `src/lib/gmos/f2.ts`.
- O tipo `Workspace` agora vive em `f3.ts` e é reexportado por `f2.ts` por compatibilidade.
- `/planejamento`, `/planos-de-acao` e `/rotinas` operam sobre
  `workspace.businessUnitId` vindo do contexto; nenhuma consulta usa slug fixo.
- Chaves de cache do React Query incluem o `businessUnitId`, evitando vazamento de dados
  entre empresas ao trocar o contexto.

### Rota `/`
Visão corporativa real: estrutura do Grupo, consolidado (ciclos, KPIs, planos, rotinas
ativas, atrasos, execuções pendentes) e um cartão por empresa/filial com botão
“Usar esta filial”. Filiais sem permissão de leitura aparecem com mensagem própria,
sem quebrar a página.

## Estados de interface
Carregando, vazio, erro, sessão expirada e sem permissão continuam cobertos por
`src/components/gmos/states.tsx`. Sem filial visível, os módulos exibem
“Nenhuma filial disponível” em vez de erro técnico.

## Fora de escopo
- Sem hard delete no frontend (apenas arquivar/cancelar/pausar).
- Nenhuma criação automática de plano, KPI, ação ou rotina para as novas filiais.
- Nenhuma alteração de grants, políticas ou funções em relação ao hotfix F2.
