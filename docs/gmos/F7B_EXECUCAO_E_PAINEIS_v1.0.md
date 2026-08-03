# F7-B — Execução por responsabilidade e painéis por perfil (v1.0)

Escopo: somente frontend e camadas de leitura/escrita já autorizadas pela RLS.
Nenhuma migration, nenhum dado alterado, nenhuma publicação.

## O que mudou

1. `src/lib/gmos/routine-access.ts` (novo)
   Regras puras de execução: `isMine`, `canExecute`, `ownerDisplay`.
   Antes, qualquer perfil com escrita no escopo via `/rotinas` podia concluir
   execução de terceiros. Agora o botão só aparece para quem gerencia rotina no
   escopo (`routine.manage`) ou é o responsável com `routine.execute_own`.
   A decisão final continua sendo da RLS; o frontend apenas deixa de oferecer
   ações que o banco recusaria.

2. `src/components/gmos/execution-card.tsx` (novo)
   Cartão único de execução, usado por `/rotinas` e `/meu-trabalho`.
   Elimina a duplicação de dois cartões divergentes. Deixa explícito que
   evidência é texto ou link: upload de arquivo não existe nesta versão.

3. `src/lib/gmos/my-work.ts` (reescrito)
   Consulta apenas registros com `owner_user_id` igual ao usuário interno atual
   (id vindo de `gmos_my_authorization`, nunca de e-mail).
   Itens sem responsável nunca são atribuídos a alguém.
   Janelas explícitas: próximas = 7 dias, concluídas recentemente = 14 dias.
   Buckets: `late`, `today`, `upcoming`, `recentlyDone`.

4. `src/lib/gmos/team-dashboard.ts` (novo)
   `fetchTeamDashboard` reaproveita as consultas de `group-dashboard.ts` e
   acrescenta os modelos de rotina do escopo. `buildTeamAggregates` é puro e
   entrega rotinas de hoje/atraso/concluídas, ações atrasadas e próximas,
   indicadores em atenção e medições pendentes de validação.
   Somente medições com status `validated` alimentam semáforo e aderência.

5. `f2.ts` e `group-dashboard.ts`
   Passam a ler `owner_user_id` em execuções e planos de ação, o que permite
   exibir "Responsável não definido" sem inventar nomes.

6. `/` (visão do Grupo)
   Bloco "Comece por aqui" com atalhos por perfil, filtrados por
   `dashboard.personal`, `dashboard.team` e `dashboard.group`. Nenhum link
   aparece sem permissão real.

## Matriz de execução de rotina

| Situação | `routine.manage` no escopo | `routine.execute_own` e é responsável | Pode registrar |
| --- | --- | --- | --- |
| Gestor no escopo | sim | — | sim |
| Colaborador responsável | não | sim | sim |
| Colaborador não responsável | não | sim, mas outro responsável | não |
| Execução sem responsável | não | — | não |
| Execução concluída/cancelada | — | — | não |

## Pendências declaradas

- Upload de arquivo de evidência não está implementado: o campo aceita texto ou
  link. Não há bucket de storage nesta versão.
- Validação de medição continua sendo feita em `/planejamento`; o painel da
  equipe apenas lista as pendências.
- Nomes de responsáveis não são exibidos (apenas "Você", "Definido" ou
  "Responsável não definido"), porque o diretório de pessoas ainda não está
  liberado por RLS para gestores.

## Validação

- `bunx tsgo --noEmit` sem erros.
- `bunx vitest run`: 24 testes, incluindo regras de execução própria, janelas
  temporais e agregados do painel da equipe.
- `bun run build` concluído.
