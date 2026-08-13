# F8.1-A.1 — Correções de integridade antes da camada de IA

Base: commit F8.1-A (`0e6b0839d0e4c1a7bb6ce8081a7ce9b02adebecf`). Evolução aditiva, sem publicação
e sem alteração de dados oficiais da RM.

## 1. Diagnóstico com zero sinais volta a ser válido

- `PlanningDiagnosisInput` passa a carregar `diagnosisReviewedAt: string | null`.
- `fetchPlanningDiagnosisInput` traz `profile.diagnosisReviewedAt`
  (`company_strategy_profiles.diagnosis_reviewed_at`).
- `diagnosisReadiness` agora exige: perfil, maturidade completa, `diagnosisReviewedAt != null` e
  1–3 prioridades da liderança. **Zero sinais selecionados é permitido.**
- Pendência exibida quando não houve revisão: `Concluir a revisão do Diagnóstico da Jornada.`
- Com zero sinais, `synthesizePlanningDiagnostic` devolve strengths/weaknesses/opportunities/threats
  vazios e `contextSummary` factual (`0 sinais de diagnóstico selecionados pela liderança.`).
  Nenhuma SWOT é inventada.

## 2. Gate de confirmação do diagnóstico

- Novo helper puro `diagnosisConfirmDecision({ readiness, replacement, canEdit })` →
  `mode: "confirm" | "replace" | "blocked"`.
- `GuidedPlanningDiagnosis` só renderiza `Confirmar diagnóstico no Planejamento` ou
  `Substituir diagnóstico pelo da Jornada` quando `readiness.ready === true`.
- Jornada incompleta: CTA único é `Continuar Jornada Estratégica` + microcópia explicando que
  concluir a revisão sem sinais também é resposta válida.
- Modo avançado manual do `/planejamento` permanece inalterado.

## 3. Confirmação atômica do direcionamento

RPC `public.f8_confirm_structured_direction(p_plan_id uuid, p_choices jsonb, p_identity jsonb)`:

- `SECURITY DEFINER`, `SET search_path TO ''`, referências schema-qualified.
- Carrega o plano e deriva `organization_id` / `business_unit_id` do próprio plano; o cliente
  nunca é autoridade de escopo.
- Exige `strategy.manage` no escopo da BU (`public.has_permission` + `public.f2_bu_scope_id`).
- Recusa ciclo com `review_status = 'approved'` (mesmo critério do `approvedLocked` do F8).
- Valida no servidor: focus 1–3, entregas de valor 1–3, formas de competir 1–2, comportamentos 3–5,
  ambição obrigatória, `priority_dimension` entre as 5 dimensões e texto obrigatório quando o
  código `other` está presente.
- Faz upsert em `plan_direction_choices` e grava `mission`, `vision`, `values_text`,
  `strategic_north` em `strategic_plans` na MESMA transação.
- Workflow/versão preservados pelos guards existentes do F8 (`f8_plan_review_guard`); não aprova,
  não ativa e não atribui pessoas.
- Registra `audit_events` (`f8.direction.structured_confirmed`).
- Retorna `{ ok, message, choicesId, created }`.
- `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`.

Frontend: `directionMutation` chama apenas `confirmStructuredDirection(planId, choices, identity)`.
`savePlanDirectionChoices` permanece exportada para compatibilidade/leitura, mas não participa mais
do caminho oficial de confirmação. Nenhum uso de service role no cliente.

## 4. Autoria

`created_by` / `updated_by` de `plan_direction_choices` ficavam nulos (sem default e sem trigger).
Novo trigger `trg_plan_direction_choices_authorship` (`public.f81_touch_authorship`,
`SECURITY DEFINER`, `search_path` vazio) preenche a autoria com `public.current_user_id()`:
`created_by` imutável após o insert, `updated_by` a cada update. Autoria enviada pelo cliente é
sempre descartada.

## 5. Testes e gates

- Suíte: **214 testes verdes** (206 preservados + 8 novos).
- Novos cenários: zero sinais + revisão concluída = válido; sinais > 0 + revisão pendente =
  inválido; prioridades 0 e > 3 inválidas; zero sinais gera SWOT oficial vazio e resumo factual;
  confirmação/substituição bloqueadas sem readiness; bloqueio em perfil somente leitura.
- `prettier`, `bunx tsgo --noEmit`, `bunx vitest run` e `bun run build` executados com sucesso.

### Limitação declarada

O projeto não possui banco de teste isolado nem harness de assertion SQL. Portanto a validação da
RPC é estática (revisão do SQL + testes puros equivalentes às mesmas cardinalidades). A RPC **não
foi executada** no ciclo real da RM e nenhum dado oficial foi alterado
(`plan_direction_choices` permanece com zero linhas para a RM).
