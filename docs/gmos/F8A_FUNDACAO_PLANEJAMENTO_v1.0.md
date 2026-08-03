# F8-A — Fundação segura do Planejamento Estratégico (v1.0)

Bloco aditivo, idempotente e reversível sobre o HEAD atual. F6, F7 e F7-E1 permanecem
integralmente preservados. **A F8 não está concluída**: este bloco entrega banco,
biblioteca e testes. O assistente visual de `/planejamento` é o bloco F8-B.

Nada de conteúdo estratégico foi criado, nenhum responsável foi atribuído e nenhum dado
foi removido.

## 1. `strategic_plans` — identidade estratégica e governança da revisão

Colunas adicionadas (se ausentes): `mission`, `vision`, `values_text`, `strategic_north`,
`version` (`NOT NULL DEFAULT 1`, `CHECK version > 0`), `review_status`
(`NOT NULL DEFAULT 'draft'`, `CHECK IN ('draft','in_review','approved')`),
`submitted_by` (FK `users`), `submitted_at`, `approved_by` (FK `users`), `approved_at`,
`approval_notes`.

Backfill: `status IN ('active','closed')` → `review_status = 'approved'`;
`status = 'draft'` → `review_status = 'draft'`. Nenhum texto preenchido.

## 2. `plan_diagnostics` — um diagnóstico por ciclo

`organization_id`, `business_unit_id`, `plan_id`, `context_summary`, `strengths`,
`weaknesses`, `opportunities`, `threats`, `strategic_priorities`, `assumptions`,
`review_status`, `submitted_by/at`, `approved_by/at`, `approval_notes`,
`created_at/by`, `updated_at/by`.

- `UNIQUE (plan_id)` — um registro por ciclo; `UNIQUE (id, organization_id)`.
- FKs compostas no padrão vigente: `(business_unit_id, organization_id)` →
  `business_units` e `(plan_id, organization_id)` → `strategic_plans`.
- Triggers `f1_touch_updated_at` e `f2_audit`.

## 3. Autorização

- Permissão `strategy.approve` (`domain = strategy`, risco alto,
  `allowed_scope_types = {organization, company, business_unit}`), concedida **somente** a
  `group_owner` e `group_admin`. `manager` e `collaborator` não recebem.
- `GRANT SELECT, INSERT, UPDATE` a `authenticated` e `ALL` a `service_role`; sem `DELETE`.
- RLS habilitada, sem policy ampla por "authenticated":
  - `SELECT` exige `has_permission('strategy.read','business_unit', f2_bu_scope_id(business_unit_id))`;
  - `INSERT`/`UPDATE` exigem `strategy.manage` no mesmo escopo.
- Nenhum uso de service role no frontend.

## 4. Funções e RPCs

Todas `SECURITY DEFINER` com `SET search_path TO ''`, sem `EXECUTE` para `anon`,
com `GRANT EXECUTE` a `authenticated` e validação interna de usuário, permissão e escopo:

- `f8_plan_completeness(p_plan_id uuid)` → JSONB com `ready`, `counts` e a lista de
  pendências em `issues` (e em `pendings`, mantido por compatibilidade), cada item no
  formato `{code, message, section}` com códigos estáveis e mensagens em português.
  O cálculo fica em `f8_plan_completeness_core`.
- `f8_submit_plan_for_review(p_plan_id uuid)` — exige `strategy.manage`; só aceita quando
  identidade e diagnóstico estão completos e existem ao menos 3 objetivos.
- `f8_approve_plan(p_plan_id uuid, p_notes text default null)` — exige `strategy.approve`
  e `ready = true`; aprova plano **e** diagnóstico na mesma transação.
- `f8_activate_plan(p_plan_id uuid)` — exige `strategy.approve`, aprovação prévia e
  `ready = true` para levar o ciclo a `active`.

### Regras de completude (medições não entram)

Missão, visão, valores e norte; diagnóstico com contexto, forças, fraquezas,
oportunidades, ameaças e prioridades; 3 a 7 objetivos não cancelados; todos os objetivos
não cancelados com responsável; cada objetivo com ao menos um KPI não arquivado; todos os
KPIs não arquivados vinculados a objetivo e com fórmula, fonte, responsável, unidade,
baseline e meta; período do ciclo válido. `review_status = 'approved'` é requisito da
ativação, não da completude.

Códigos estáveis: `plan.missing`, `identity.mission|vision|values|north`,
`diagnosis.missing|context|strengths|weaknesses|opportunities|threats|priorities`,
`objectives.min|max|owner|kpi`, `kpis.min|objective|config`, `cycle.period`.

## 5. Proteções e auditoria

- `f8_plan_review_guard` e `f8_diagnostic_review_guard` impedem que um `UPDATE` direto
  aprove o ciclo ou mude sua situação sem `strategy.approve` — burlar a RPC não funciona.
- Edição de missão/visão/valores/norte em ciclo aprovado devolve o **plano** para `draft`
  sem desativar ciclo ativo. Edição de diagnóstico aprovado devolve **diagnóstico e
  plano** para `draft`, também sem desativar o ciclo.
- `audit_events` registra `f8.plan.submitted`, `f8.plan.approved`,
  `f8.plan.approval_rejected`, `f8.plan.activated`, `f8.plan.reverted_to_draft` e
  `f8.diagnosis.reverted_to_draft`. O `metadata` guarda versão, transição, contagens,
  códigos de pendência e marcadores booleanos — **nunca textos estratégicos completos**.

## 6. `src/lib/gmos/strategy.ts`

Tipos (`ReviewStatus`, `StrategicIdentity`, `Diagnostic`, `Completeness`, `Issue`),
leitura/escrita sujeitas a RLS (`fetchIdentity`, `fetchDiagnostic`, `saveIdentity`,
`saveDiagnostic`), as quatro RPCs (`fetchCompleteness`, `submitPlanForReview`,
`approvePlan`, `activatePlan`) e funções puras: `normalizeText`, `identityComplete`,
`diagnosisComplete`, `mapIssuesBySection`, `workflowActions` (mais `parseCompleteness`,
`stageProgress` e `isSubmittable`, já usados no projeto).
A rota `/planejamento` não foi redesenhada neste bloco.

## 7. Testes (Vitest)

`src/lib/gmos/strategy.test.ts`: espaços em branco não contam; identidade completa e
incompleta; diagnóstico completo e incompleto (premissas opcionais); agrupamento de issues
por seção com fallback `other`; `manager` submete mas não aprova nem ativa; perfil com
`strategy.approve` aprova em revisão e ativa após aprovação, e não ativa sem `ready`.
Suíte total do projeto: 75 testes verdes.

## 8. Validação no banco (RM Mineração)

Contagens preservadas: 1 plano, 4 pilares, 4 objetivos, 9 KPIs, 54 medições, 6 ações,
5 modelos de rotina, 16 execuções e 4 riscos. Ciclo em rascunho continua
`review_status = 'draft'`, `version = 1`, textos de identidade `NULL`, `plan_diagnostics`
vazia. `strategy.approve` presente em `group_owner`/`group_admin` e ausente em
`manager`/`collaborator`. RLS ativa em `plan_diagnostics`. Ativação de ciclo incompleto
falha por pendências de completude.

## 9. Pendências

- F8-B: assistente visual de cinco etapas em `/planejamento`.
- Conteúdo humano de identidade e diagnóstico da RM e definição de responsáveis.
