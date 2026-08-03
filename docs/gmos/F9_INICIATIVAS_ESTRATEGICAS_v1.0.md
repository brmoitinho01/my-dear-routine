# F9 — Iniciativas estratégicas e derivação rastreável de planos de ação (v1.0)

## Objetivo
Fechar a cadeia Ciclo → Pilar → Objetivo → KPI/Risco → **Iniciativa** → Plano de ação,
sem criar dados automaticamente e sem alterar o planejamento existente.

## Banco (aditivo)
- Nova tabela `public.strategic_initiatives` (objetivo obrigatório, pilar/KPI/risco opcionais,
  responsável, patrocinador, prazo, prioridade, custo previsto, status e trilha de aprovação).
- `public.action_plans` evoluída com `initiative_id`, `origin_type` e `origin_note`.
- Backfill: os 6 planos existentes foram classificados como `origin_type = 'objective'`;
  nenhum responsável, prazo ou vínculo foi inventado.
- RLS ativa: `SELECT` por `structure/strategy.read`, `INSERT`/`UPDATE` por `strategy.manage`
  no escopo da filial (`f2_bu_scope_id`). Sem policy de `DELETE` — nada é excluído fisicamente.
- Privilégios: `authenticated` (select/insert/update) e `service_role`. `anon` revogado.
- RPCs `SECURITY DEFINER` auditadas: `f9_initiative_readiness`, `f9_submit_initiative_for_review`,
  `f9_approve_initiative`, `f9_activate_initiative`, `f9_derive_action_plan`.
  Execução liberada apenas para `authenticated`; a autorização real é verificada dentro da função.

## Regras de workflow
- `draft → in_review → approved → active`, com `on_hold/completed/cancelled/archived`.
- Envio/aprovação exigem **resultado esperado** e **prazo**.
- Ativação exige, adicionalmente, **responsável definido**.
- Derivação de plano de ação só a partir de `approved`/`active`, uma vez por iniciativa viva
  (plano cancelado libera nova derivação) e apenas com permissão de planos de ação.
- Iniciativa cancelada/arquivada não edita e não deriva.

## Frontend
- `/planejamento`: cada objetivo exibe a seção "Iniciativas estratégicas" com criação, edição,
  transições, pendências explícitas e derivação; novos indicadores "Iniciativas ativas" e
  "Iniciativas sem plano".
- `/planos-de-acao`: origem obrigatória na criação manual (justificativa obrigatória em plano
  avulso), filtro por origem e trilha visível `Ciclo › Pilar › Objetivo › Indicador › Iniciativa`.
  Planos antigos aparecem como "Vinculado a objetivo estratégico" — nunca como derivados.

## Validação
- `bunx tsgo --noEmit` sem erros.
- `bunx vitest run`: 110 testes (21 novos em `src/lib/gmos/initiatives.test.ts`).
- Contagens preservadas após a migration: 1 ciclo, 4 pilares, 4 objetivos, 9 KPIs, 54 medições,
  6 planos de ação, 5 rotinas, 16 execuções, 4 riscos, 0 iniciativas.
- Privilégio `anon` na nova tabela: revogado (verificado por `has_table_privilege`).
