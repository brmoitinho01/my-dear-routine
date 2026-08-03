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

---

## Correções aplicadas na F7-E (revisão corretiva)

- Classificação temporal de "Meu trabalho" reescrita: `upcoming` cobre apenas de
  amanhã até +7 dias; itens além disso, ou sem prazo, vão para `later`
  ("Mais adiante", colapsado). Conclusões passam por `doneRecent` (últimos 14
  dias, por `completed_at` na rotina e `updated_at` na ação, com `due_date` como
  fallback) e `doneOlder`. A data base é sempre injetada; a função pura não lê o
  relógio do sistema.
- Medições aguardando validação = somente `status = 'pending'`. O enum real de
  `kpi_measurements.status` é `('pending','validated','rejected')`; `rejected`
  não é pendência e `draft`/`cancelled` não existem no schema.
- `/rotinas` decide a UI por `can()` no `scope_id` real da filial em contexto:
  criar/editar/pausar/arquivar/gerar exige `routine.manage`; concluir, bloquear
  ou iniciar exige ser responsável com `routine.execute_own` **ou** ter
  `routine.manage` (`canOperateExecution`). Colaborador não vê gestão de modelo.
- O responsável do modelo não substitui o da execução: herança apenas quando
  `routine_executions.owner_user_id` é nulo (registros legados), documentado em
  `effectiveOwnerId`.
- `ExecutionCard` é o único componente de registro de execução, usado por
  `/rotinas` e `/meu-trabalho`, preservando `requires_evidence`, notas e
  evidência em texto/URL.
- Home mantém o painel consolidado e ganha bloco de destaque por perfil com
  contagens reais, sem redirecionamento automático e sem duplicar consultas.
- Navegação ordenada por papel principal (`orderNavForRole`), sem esconder
  Método GMOS nem Apresentação de quem tem leitura estratégica.

## Limitações reais mantidas

- Upload de arquivo de evidência não existe: apenas texto ou link.
- Responsáveis reais ainda não atribuídos em grande parte das ações e rotinas.
- Não há usuários reais `manager`/`collaborator` para testes de sessão isolada.
- Áreas/departamentos e escopos por departamento seguem pendentes.
