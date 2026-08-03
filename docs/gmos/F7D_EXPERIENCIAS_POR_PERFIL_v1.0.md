# F7-D — Experiências por perfil (Colaborador, Gestor, Proprietário)

Somente frontend e consultas de leitura. Nenhuma migração, nenhum dado alterado,
nenhuma permissão concedida no cliente: a autorização continua sendo do banco
(RLS + `public.has_permission` + `public.gmos_my_authorization`).

## Novas telas

| Rota | Permissão exigida | Perfil típico |
| --- | --- | --- |
| `/meu-trabalho` | `dashboard.personal` | Colaborador (e todos os papéis) |
| `/painel-equipe` | `dashboard.team` | Gestor, administrador, proprietário |
| `/painel-grupo` | `dashboard.group` | Proprietário e administrador do Grupo |

`/rotinas` passou a exigir `routine.read` na própria rota (antes só a RLS filtrava).
A criação e edição de modelos continua condicionada a `routine.manage` no escopo.

## Colaborador
- `/meu-trabalho` mostra apenas execuções e planos com `owner_user_id` = usuário interno.
- Blocos: em atraso, hoje, próximas, concluídas, além dos planos de ação próprios.
- Registro de conclusão ou impedimento com observação e evidência; evidência é
  obrigatória quando o modelo exige.
- Sem criação de modelos, sem planejamento, sem gestão de acessos.

## Gestor
- `/painel-equipe` usa a filial selecionada no contexto corporativo.
- Métricas: rotinas pendentes/atrasadas, aderência, planos de ação e atrasos,
  medições aguardando validação e indicadores em atenção/crítico.
- Gestão de rotinas permanece em `/rotinas`, no próprio escopo.

## Proprietário do Grupo
- `/painel-grupo` consolida todas as filiais visíveis, com filtros de empresa,
  filial e período, e navegação do consolidado para cada filial.
- Saúde por empresa, indicadores críticos, riscos por severidade e auditoria
  recente (somente com `audit.read`, sem exposição de metadata).

## Regras de leitura preservadas
- Semáforo e gráficos usam **somente** medições com `status = 'validated'`.
- Indicador sem medição validada aparece como "Sem medição validada" — nunca zero.
- Execução sem responsável aparece como "Responsável a definir".
- Severidade de risco é derivada de `impact` × `probability` (campos existentes).

## Arquivos
- `src/lib/gmos/my-work.ts`, `src/lib/gmos/group-dashboard.ts`
- `src/components/gmos/dashboard-blocks.tsx`
- `src/routes/_authenticated/meu-trabalho.tsx`, `painel-equipe.tsx`, `painel-grupo.tsx`
- `src/lib/gmos/navigation.ts`, `src/components/gmos/app-shell.tsx`
- Testes: `src/lib/gmos/dashboards.test.ts` (16 testes no total)

## Reversão
Puramente aditivo: remover os três arquivos de rota, `dashboard-blocks.tsx`,
`my-work.ts`, `group-dashboard.ts`, `dashboards.test.ts` e desfazer os itens
`meu-trabalho`/`painel-equipe`/`painel-grupo` em `navigation.ts` e `app-shell.tsx`,
além do `RequirePermission` em `rotinas.tsx`. Banco não é afetado.
