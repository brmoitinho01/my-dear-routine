# F9-A — Iniciativas estratégicas e derivação de planos de ação (v1.0)

Bloco F9-A: fundação segura de iniciativas e derivação transacional de um plano de
ação a partir de uma iniciativa. Sem redesign amplo dos painéis, sem dados
fictícios, sem responsáveis atribuídos. F6–F8 preservadas.

## Migrations aplicadas
- `20260803195908_26b9d338-d0dd-46e9-843c-2919ad3de664.sql` — fundação F9.
- `20260803200618_da7a1056-aff2-4461-a885-3316433a87fa.sql` — hardening de grants.

### `strategic_initiatives`
`organization_id`, `business_unit_id`, `plan_id` e `objective_id` obrigatórios;
`pillar_id`, `kpi_id`, `risk_id` opcionais; `title` obrigatório; `description`,
`expected_result`; `owner_user_id`, `sponsor_user_id`; `start_date`/`due_date`;
`priority` low|medium|high|critical; `status`
draft|in_review|approved|active|on_hold|completed|cancelled|archived;
`progress` 0–100; `estimated_cost`; campos de submissão/aprovação; auditoria.
FKs compostas garantem que plano, pilar, objetivo, KPI e risco pertencem à mesma
organização, unidade e ciclo. Índices por objetivo, plano, unidade e status.

### `action_plans` (evolução aditiva)
Novos campos `initiative_id`, `origin_type`, `origin_note`, `derived_at`,
`derived_by`. `origin_type` aceita
initiative|objective|kpi|risk|decision|standalone_justified.
Backfill sem inventar texto: os 6 planos existentes ficaram `objective` porque
todos possuem `objective_id`. Índice único parcial
`action_plans_one_active_per_initiative_idx` impede dois planos não cancelados
para a mesma iniciativa.

## Permissões e RLS
Permissões `initiative.read`, `initiative.manage`, `initiative.approve`:
owner/admin recebem as três; manager recebe read/manage no escopo; collaborator
somente read. RLS ativa com policies SELECT/INSERT/UPDATE por `business_unit`
via `has_permission`; aprovação protegida pela RPC; grants explícitos; sem DELETE
e sem policy ampla por `authenticated` (privilégios de `anon` revogados).

## RPCs (`SECURITY DEFINER`, `search_path` vazio, `PUBLIC` revogado)
`f9_submit_initiative_for_review`, `f9_approve_initiative`,
`f9_activate_initiative`, `f9_derive_action_plan`, mais `f9_initiative_readiness`
e o guard `f9_initiative_guard`. Manager cria, edita e submete, mas não aprova;
ativação exige aprovada, responsável, resultado esperado e prazo; edição central
de iniciativa aprovada/ativa retorna para rascunho. A derivação exige iniciativa
aprovada ou ativa, bloqueia duplicidade, herda plano/objetivo/KPI/unidade, título,
`description`→`why`, resultado esperado, responsável apenas quando definido e
datas conhecidas, nasce em rascunho com `origin_type = 'initiative'`. `how`,
local e custos não são inventados. Auditoria registra o evento sem textos completos.

## Código
- `src/lib/gmos/initiatives.ts`: tipos, queries e RPCs sob RLS, além de funções
  puras de completude, workflow, cadeia de origem, filtros e `canDerive`.
- `src/components/gmos/initiatives-section.tsx` e etapa Objetivos de
  `/planejamento`: iniciativas por objetivo com criar/editar, status, responsável
  honesto, submissão/aprovação/ativação e botão derivar ação.
- `/planos-de-acao`: bloco "Cadeia de origem" (inclusive para ações antigas após o
  backfill) e criação manual exigindo origem ou `standalone_justified` com
  justificativa. Meu trabalho e rotinas não foram alterados.

## Validações de banco
0 iniciativas; 6 ações com `origin_type = 'objective'`; nenhum responsável
alterado; RLS ativa; três policies sem acesso amplo; índice de unicidade de
derivação presente. Contagens preservadas: 1 plano, 4 pilares, 4 objetivos,
9 KPIs, 54 medições, 6 ações, 5 templates, 16 execuções, 4 riscos.

## Gates
Prettier nos arquivos tocados, lint, `bunx tsgo --noEmit`, `bunx vitest run`
(112 testes) e `bun run build` — todos verdes.

## Pendências reais
Aprovação autorizada e bloqueio de derivação duplicada não foram exercitados com
sessão de usuário real nesta sessão (sem login ativo no preview); a verificação
foi estrutural no banco (policies, guard e índice único).

## Próximo passo
F10 — ação recorrente para rotina e evidências.
