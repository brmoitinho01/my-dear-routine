# F8 — Conclusão do Planejamento Estratégico (v1.0)

Objetivo: permitir que o Grupo Moitinho conclua profissionalmente o ciclo estratégico
existente da RM Mineração dentro do sistema, com colaboração de gestores e aprovação
formal da liderança. Evolução aditiva: nenhuma tabela, coluna, política ou registro
anterior foi removido.

## Banco (aditivo)

`strategic_plans` — novas colunas:

- `mission`, `vision`, `values_text`, `strategic_north` — identidade estratégica do ciclo.
- `version` (default 1), `review_status` (`draft` | `in_review` | `approved`),
  `submitted_at`, `submitted_by`, `approved_at`, `approved_by`, `approval_notes`.

`plan_diagnostics` (nova tabela, 1 por ciclo):

- `context_summary`, `strengths`, `weaknesses`, `opportunities`, `threats`,
  `strategic_priorities`, `assumptions`, `review_status`, marcos de submissão/aprovação.
- FK composta `(plan_id, organization_id)` e `(business_unit_id, organization_id)`:
  o diagnóstico nunca atravessa organização.
- GRANT explícito para `authenticated` e `service_role`; RLS habilitada com policies por
  `public.has_permission` no escopo `business_unit` (leitura por `strategy.read`,
  escrita por `strategy.manage`). Sem DELETE.

`permissions` — nova permissão `strategy.approve` (escopos `organization`, `company`,
`business_unit`), concedida a `group_owner` e `group_admin`.

## RPCs auditadas (SECURITY DEFINER)

- `f8_plan_completeness(uuid)` — fonte única de completude. Retorna `ready`, contagens e
  a lista de pendências com `code`, `section` e mensagem em pt-BR. Exige `strategy.read`.
- `f8_submit_plan_for_review(uuid)` — `draft` → `in_review`. Exige `strategy.manage`.
  Bloqueia quando faltam direcionamento, diagnóstico ou o mínimo de objetivos.
- `f8_approve_plan(uuid, text)` — → `approved`, com autoria, data e parecer. Exige
  `strategy.approve` e completude total.
- `f8_activate_plan(uuid)` — ciclo aprovado → `active`. Exige `strategy.approve`.

Toda transição grava evento em `audit_events`. O frontend não altera `review_status`
diretamente: apenas chama as RPCs.

## Frontend

`src/lib/gmos/strategy.ts` — leitura, escrita e regras puras:
`stageProgress`, `workflowActions`, `pendingsBySection`, `isSubmittable`,
`parseCompleteness`, `isFilled`, `onlyOwned` não é usado aqui (permanece em `my-work`).

`src/components/gmos/strategy-assistant.tsx` — passos, barra de status do ciclo,
formulários de direcionamento e diagnóstico, lista de pendências e painel de revisão.

`src/routes/_authenticated/planejamento.tsx` — assistente de 5 etapas:

1. Direcionamento (missão, visão, valores, norte estratégico)
2. Diagnóstico (contexto, SWOT, prioridades, premissas)
3. Objetivos (pilares, objetivos, riscos)
4. Indicadores e metas (KPIs e medições)
5. Revisão e ativação (consistência, envio, aprovação, ativação)

Cada etapa mostra suas pendências reais vindas do banco. Nada é preenchido
automaticamente e nenhum responsável é atribuído pelo sistema.

## Regras de completude (banco)

- Direcionamento: os quatro campos preenchidos.
- Diagnóstico: contexto, forças, fraquezas, oportunidades, ameaças e prioridades.
- Objetivos: de 3 a 7 ativos, todos com responsável e com ao menos um indicador ativo.
- Indicadores: vinculados a objetivo, com fórmula, fonte, unidade, responsável,
  baseline e meta.
- Medições não participam da completude: pertencem à execução, não ao planejamento.

## Papéis

- Colaborador: leitura das etapas.
- Gestor (`strategy.manage`): edita conteúdo e envia para revisão.
- Liderança (`strategy.approve`): aprova e ativa. Não existe autoaprovação implícita:
  a permissão é sempre verificada no escopo real da filial.

## Testes

`src/lib/gmos/strategy.test.ts` — 17 testes: campos em branco, progresso por etapa,
faixa de 3 a 7 objetivos, itens cancelados/arquivados ignorados, submissão bloqueada,
aprovação sem permissão, ativação já ativa e normalização do JSON do banco.
Suíte completa: 68 testes verdes, `tsgo --noEmit` e `bun run build` sem erros.

## Não verificado

A navegação autenticada do assistente não pôde ser exercitada no navegador nesta
entrega porque não havia sessão de preview disponível (`signed_out`). Regras, tipos,
testes e build foram validados; a verificação visual autenticada segue pendente.
