# F8-A — Fundação segura do Planejamento Estratégico (v1.0)

Bloco aditivo, idempotente e reversível. Nada de F6/F7/F7-E1 foi alterado ou removido.
A F8 **não** está concluída: este bloco entrega apenas banco + biblioteca + testes.
A refatoração da rota `/planejamento` fica para o bloco seguinte.

## 1. Banco (migration aditiva)

### 1.1 `strategic_plans` — identidade estratégica e ciclo de revisão

Colunas adicionadas: `mission`, `vision`, `values_text`, `strategic_north`,
`version` (default 1, `CHECK version > 0`), `review_status`
(`draft` | `in_review` | `approved`), `submitted_by`, `submitted_at`,
`approved_by`, `approved_at`, `approval_notes`.

Backfill aplicado sem inventar conteúdo:

- `status` em `active` / `closed` → `review_status = 'approved'`;
- `status = 'draft'` → `review_status = 'draft'`;
- textos de identidade permanecem `NULL` até serem preenchidos por quem tem
  `strategy.manage`.

### 1.2 `plan_diagnostics` — um registro por plano

Campos de conteúdo: `context_summary`, `strengths`, `weaknesses`,
`opportunities`, `threats`, `strategic_priorities`, `assumptions`.
Campos de fluxo/auditoria: `review_status`, `submitted_by/at`,
`approved_by/at`, `approval_notes`, `created_at/by`, `updated_at/by`.
Unicidade por `plan_id` (um diagnóstico por ciclo).

### 1.3 Autorização

- Permissão `strategy.approve` criada e concedida **apenas** a `group_owner` e
  `group_admin`.
- `plan_diagnostics`: `GRANT` explícito e RLS habilitada; leitura por
  `strategy.read` e escrita por `strategy.manage`, sempre resolvidas pelo escopo
  da unidade de negócio (`business_unit_id`). Nenhuma policy ampla por
  "autenticado". Sem `DELETE`.
- Guards `f8_plan_review_guard` e `f8_diagnostic_review_guard` bloqueiam
  transições de `review_status` fora das RPCs.
- Todas as funções são `SECURITY DEFINER` com `search_path` vazio.

### 1.4 RPCs

- `f8_submit_plan_for_review(p_plan_id)` — exige `strategy.manage` e completude.
- `f8_approve_plan(p_plan_id, p_notes)` — exige `strategy.approve`.
- `f8_activate_plan(p_plan_id)` — exige aprovação prévia; só então `status`
  passa a `active`.
- `f8_plan_completeness(p_plan_id)` — retorna JSONB com `ready`, contagens e
  `pendings` (mensagens estáveis em português, agrupadas por seção).

### 1.5 Regras de completude

Identidade completa; diagnóstico completo; 3 a 7 objetivos não cancelados;
responsável definido nos objetivos; pelo menos um KPI por objetivo; todos os KPIs
vinculados a objetivo e completos (unidade, direção, periodicidade, baseline,
meta); período do ciclo válido; aprovação obrigatória antes da ativação.
**Medições não entram na completude.**

### 1.6 Reedição controlada

Editar identidade ou diagnóstico já aprovado devolve **apenas o item editado**
para `draft`. Um ciclo ativo nunca é desativado por reedição.

### 1.7 Auditoria

Eventos gravados em `audit_events` registram plano, ação, ator e status; o
`metadata` guarda apenas marcadores de preenchimento (booleanos/contagens),
nunca os textos estratégicos completos.

## 2. Biblioteca — `src/lib/gmos/strategy.ts`

Tipos (`ReviewStatus`, `StrategicIdentity`, `Diagnostic`, `Completeness`,
`Pending`), carregamento/salvamento (`fetchIdentity`, `fetchDiagnostic`,
`saveIdentity`, `saveDiagnostic`), chamadas RPC (`fetchCompleteness`,
`submitPlanForReview`, `approvePlan`, `activatePlan`) e funções puras:
`parseCompleteness`, `emptyToNull`, `isFilled`, `stageProgress` (cinco etapas:
direção, diagnóstico, objetivos, indicadores, revisão), `workflowActions`
(visibilidade por permissão), `pendingsBySection` e `isSubmittable`.

## 3. Testes

`src/lib/gmos/strategy.test.ts` cobre as regras puras: normalização, parsing
defensivo de completude, progresso das etapas, agrupamento de pendências e
workflow por permissão. Suíte total do projeto: 68 testes verdes.

## 4. Validação no banco (RM Mineração)

Contagens preservadas: 1 ciclo, 4 pilares, 4 objetivos, 9 KPIs, 54 medições,
6 planos de ação, 5 templates de rotina, 16 execuções, 4 riscos.
`review_status = 'draft'`, `version = 1`, textos de identidade `NULL`
(nenhum conteúdo inventado), `plan_diagnostics` vazia,
`strategy.approve` apenas em `group_owner`/`group_admin`,
RLS ativa em `plan_diagnostics` com 3 policies.

## 5. Pendências conhecidas

- Refatoração do assistente na rota `/planejamento` (bloco seguinte).
- Conteúdo humano de identidade e diagnóstico da RM e definição de
  responsáveis — devem ser preenchidos pelos gestores, não pelo sistema.
