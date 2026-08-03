# GMOS — Do planejamento estratégico à execução (plano incremental)

Base real verificada agora: 3 empresas, 3 filiais, 0 áreas/departamentos, 1 ciclo estratégico
(RM, status rascunho), 4 pilares, 4 objetivos, 9 indicadores, 54 medições, 6 planos de ação,
5 modelos de rotina, 16 execuções, 4 riscos, 23 permissões, 4 papéis, 3 usuários internos.
Telas existentes: `/` (foco por perfil), `/planejamento`, `/planos-de-acao`, `/rotinas`,
`/meu-trabalho`, `/painel-equipe`, `/painel-grupo`, `/estrutura`, `/acessos`, `/metodo`,
`/apresentacao`.

Nada aqui é reescrita: o núcleo (escopos, RLS, `has_permission`, auditoria, F2) é mantido.

## 1. O que falta para o fluxo de ponta a ponta

O fluxo pedido é
Empresa/Unidade/Área → Ciclo → Diagnóstico → Objetivos → Indicadores/metas → Iniciativas →
Planos de ação → Rotinas → Evidências → Reuniões → Decisões → Revisão.

O que já existe no banco: ciclo (`strategic_plans`), pilares, objetivos, indicadores, metas
(campos de baseline/meta/limites), medições com validação, planos de ação 5W2H, rotinas e
execuções, riscos, auditoria imutável.

O que **não** existe hoje e sustenta o método:
- Diagnóstico do ciclo (contexto, forças/fraquezas, prioridades) — hoje não há onde registrar.
- Iniciativas/projetos entre objetivo e plano de ação — planos de ação hoje só apontam para
  objetivo/indicador.
- Evidências como registro próprio (hoje é campo de texto/link; não há bucket de storage).
- Reuniões e decisões — inexistentes.
- Comentários/menções e histórico legível por item (existe `audit_events`, mas técnico).
- Workflow de aprovação (rascunho → em revisão → aprovado → ativo → concluído/arquivado)
  aplicado ao ciclo e às contribuições.
- Versão do ciclo para revisão estratégica.
- Áreas: `departments` existe e está vazio; escopo por área já é suportado pelos triggers.

## 2. Experiência de ponta a ponta (alvo)

- **Diretor** abre `/planejamento`, escolhe empresa/filial e vê um **assistente do ciclo** com
  etapas numeradas e estado por etapa (vazio, em preenchimento, pronto). Continua de onde parou.
- **Gestores e líderes** contribuem no diagnóstico e propõem objetivos como **contribuição**
  (status "em revisão"); o diretor aprova ou devolve com comentário. Contribuição em item já
  ativo (progresso, evidência, comentário) é executada direto, sem aprovação.
- **Objetivo → indicador**: cada objetivo exige ao menos 1 indicador com unidade, direção,
  fórmula, frequência, responsável, baseline e meta; indicador incompleto é sinalizado (regra
  `isKpiIncomplete` já existe) e bloqueia a ativação do ciclo.
- **Iniciativa → plano de ação**: iniciativa é o "projeto" que atende um objetivo/indicador/risco.
  Botão "Derivar plano de ação" pré-preenche 5W2H a partir da iniciativa.
- **Ação recorrente → rotina**: ação marcada como recorrente oferece "Converter em rotina";
  cria `routine_templates` vinculado à origem e **encerra** a ação como convertida, evitando
  duplicidade (nunca as duas abertas para o mesmo trabalho).
- **Responsável** usa `/meu-trabalho`: atualiza progresso, registra conclusão/impedimento e
  anexa evidência (texto/link agora; arquivo quando houver storage).
- **Reunião** gera pauta automática do escopo/período: desvios de indicador, ações atrasadas,
  rotinas com baixa aderência, medições pendentes de validação, decisões anteriores em aberto.
  Cada item pode virar **decisão** com responsável e prazo, e a decisão pode gerar ação.
- **Revisão do ciclo**: fecha o ciclo, congela um snapshot de versão e abre o próximo com
  objetivos/indicadores herdáveis.

## 3. Rastreabilidade mínima

```text
Ciclo ── Diagnóstico
  └─ Pilar ─ Objetivo ─┬─ Indicador ─ Medição ─ Evidência
                       ├─ Iniciativa ─ Plano de ação ─┬─ Evidência
                       │                              └─ Rotina ─ Execução ─ Evidência
                       └─ Risco
Reunião ─ Item de pauta ─ Decisão ─ (Ação | Rotina | Ajuste de meta)
```

Regras antiórfão/antiduplicação:
- Plano de ação exige exatamente uma origem: iniciativa, objetivo, indicador, risco ou decisão.
- Rotina exige origem (objetivo/indicador/iniciativa/decisão) ou marcação explícita de
  "rotina de conformidade" com justificativa.
- Indicador sem objetivo não entra em painel; objetivo sem indicador impede ativar o ciclo.
- Ação convertida em rotina fica com status `converted` e link para a rotina.
- Decisão de reunião sempre aponta para um item de pauta e um responsável.
- Na interface: bloco "Cadeia de origem" em cada ação/rotina (ciclo › pilar › objetivo ›
  indicador › iniciativa) e, no objetivo, a lista descendente de iniciativas, ações e rotinas.

## 4. Colaboração e governança

| Papel | Ciclo/diagnóstico/objetivos | Indicadores e metas | Iniciativas/ações | Rotinas | Reuniões/decisões |
| --- | --- | --- | --- | --- | --- |
| Admin (group_admin) | gerencia | gerencia | gerencia | gerencia | gerencia |
| Diretor (novo papel) | aprova e ativa | aprova metas | aprova | aprova | conduz e decide |
| Gestor (manager) | propõe | propõe, valida medição | cria e gerencia no escopo | gerencia no escopo | conduz na filial |
| Líder (novo papel) | propõe | propõe | cria no escopo da área | executa e acompanha | registra pauta |
| Operador (collaborator) | lê | lê | atualiza os próprios | executa os próprios | lê |

- Novas permissões previstas: `diagnosis.read/manage`, `initiative.read/manage`,
  `meeting.read/manage`, `decision.manage`, `plan.approve`, `comment.write`, `evidence.write`.
- Workflow único: `draft → in_review → approved → active → done | archived`, com autor,
  revisor, data e justificativa; transições auditadas em `audit_events`.
- Precisa aprovação: criar/alterar objetivo, meta, iniciativa e fechar ciclo.
  Não precisa: progresso, comentário, evidência, execução de rotina, conclusão de ação própria.
- Comentários com menção (`@usuário`) por entidade, sem editar histórico; histórico legível
  derivado de `audit_events` + comentários.

## 5. Painéis e reuniões

- **Executivo por ciclo/empresa/área**: reaproveita `/painel-grupo` e `group-dashboard.ts`,
  acrescentando completude do ciclo (etapas prontas) e cobertura objetivo→indicador→ação.
- **Meu trabalho**: mantém buckets atuais (`late/today/upcoming/later/recentlyDone/doneOlder`)
  e passa a incluir decisões atribuídas ao usuário.
- **Painel de equipe**: mantém `team-dashboard.ts` e ganha ações sem origem e objetivos sem
  indicador como pendências de qualidade.
- **Reunião**: nova tela `/reunioes` com pauta gerada por consulta (desvios, atrasos, aderência,
  medições pendentes, decisões abertas), registro de presença simples e decisões com prazo.

## 6. Arquitetura e dados

Reaproveitar sem mudança: `organizations`, `companies`, `business_units`, `departments`,
`scopes`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `users`,
`audit_events`, `kpis`, `kpi_measurements`, `strategic_pillars`, `strategic_objectives`,
`strategic_risks`, `routine_templates`, `routine_executions`.

Adaptar (aditivo, sem destruir dados da RM):
- `strategic_plans`: `version int default 1`, `parent_plan_id`, `workflow_status`,
  `approved_by/at`, `previous_plan_id` para revisão.
- `action_plans`: `initiative_id`, `origin_type`, `converted_to_template_id`,
  `recurrence_candidate boolean`.
- `routine_templates`: `objective_id`, `kpi_id`, `initiative_id`, `origin_note`.

Novas entidades indispensáveis agora: `plan_diagnostics`, `initiatives`, `entity_comments`,
`evidences` (polimórfica controlada por `entity_type`+`entity_id`), `meetings`,
`meeting_agenda_items`, `decisions`.

Fases posteriores: aprovações formais em tabela própria, snapshots de versão, storage de
arquivos, OKR/cascata entre filiais, integrações e alertas.

RLS/escopo: todas as novas tabelas seguem o padrão vigente — `organization_id` +
`business_unit_id`, GRANT explícito para `authenticated`/`service_role`, RLS habilitada e
policies por `public.has_permission(<code>, 'business_unit', f2_bu_scope_id(business_unit_id))`,
mais leitura própria por `owner_user_id`. Nenhuma policy ampla por "autenticado".

Migração: tudo aditivo e idempotente. Dados da RM permanecem; backfill só de `origin_type`
inferido dos vínculos já existentes (`objective_id`/`kpi_id`) sem apagar nada, e rollback por
script reverso documentado em `docs/gmos/`.

## 7. Entrega em fases pequenas

**F8 — Concluir o planejamento da RM (primeiro incremento).**
Diagnóstico + assistente do ciclo + validação de completude + ativação do ciclo com aprovação.
Aceite: diretor conclui o ciclo da RM de rascunho a ativo, sem objetivo sem indicador nem
indicador incompleto; tudo auditado. Risco: ciclo atual em rascunho com dados demonstrativos —
tratar demo separado do operacional.
Arquivos: migration aditiva (`strategic_plans`, `plan_diagnostics`), `src/lib/gmos/strategy.ts`,
`src/routes/_authenticated/planejamento.tsx`, `docs/gmos/F8_*.md`.

**F9 — Iniciativas e derivação de planos de ação.**
`initiatives`, vínculo em `action_plans`, botão "Derivar plano de ação", bloco de cadeia de origem.
Aceite: nenhuma ação nova sem origem; ação derivada herda objetivo/indicador.

**F10 — Rotinas e evidências.**
Conversão ação→rotina com bloqueio de duplicidade, `evidences`, critério de conclusão.
Aceite: ação recorrente vira rotina uma única vez e a ação fica marcada como convertida.

**F11 — Reuniões, decisões e revisão do ciclo.**
`meetings`, `meeting_agenda_items`, `decisions`, `/reunioes`, fechamento e versão do ciclo.
Aceite: reunião gera pauta automática e ao menos uma decisão com responsável e prazo; ciclo
encerrado gera versão seguinte com herança.

Transversal em todas: comentários/menções, workflow de status e testes puros das regras
(origem obrigatória, conversão única, completude do ciclo).

## 8. Menor conjunto de telas da primeira versão profissional

1. `/planejamento` — assistente do ciclo (diagnóstico, pilares, objetivos, indicadores, metas, ativação).
2. `/objetivo/$id` — cadeia completa: indicadores, iniciativas, ações, rotinas, riscos, comentários.
3. `/planos-de-acao` — lista e detalhe com origem e evidências.
4. `/rotinas` — modelos e execuções.
5. `/meu-trabalho` — execução por responsável.
6. `/painel-equipe` e `/painel-grupo` — gestão e visão executiva.
7. `/reunioes` — pauta e decisões (entra na F11).

## Próximo incremento recomendado

**F8 — Concluir e cadastrar o planejamento estratégico da RM**: migration aditiva de
`strategic_plans` (versão e workflow) + `plan_diagnostics` com GRANT/RLS, regras puras de
completude do ciclo em `src/lib/gmos/strategy.ts` com testes, e reformulação de `/planejamento`
como assistente por etapas com aprovação e ativação auditadas. Nada além disso nesta fase.
