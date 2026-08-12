# Avaliação arquitetural do GMOS — do onboarding ao planejamento (modo planejamento)

Nada foi alterado. Base verificada: `src/lib/gmos/*` (strategy, initiatives, org-chart, f2, method,
my-work, dashboards), rotas `/planejamento`, `/planos-de-acao`, `/rotinas`, `/organograma`,
`/painel-*`, `/metodo`, e o histórico em `.lovable/plan.md` + `docs/gmos/`.

## 1. O que já existe para os quatro resultados

**Planejamento estratégico — maduro.** `strategic_plans` com identidade (missão, visão, valores,
norte), versão e workflow (`draft → in_review → approved → active`), `plan_diagnostics` (contexto,
SWOT, prioridades, premissas), `strategic_pillars`, `strategic_objectives`, `kpis`,
`kpi_measurements`, `strategic_risks`. RPCs `f8_plan_completeness`, `f8_submit_plan_for_review`,
`f8_approve_plan`, `f8_activate_plan`. Assistente de 5 etapas em `/planejamento` (1.440 linhas)
com `strategy-assistant.tsx` e regras puras testadas em `strategy.ts`.

**Planos de ação — maduro.** `action_plans` em 5W2H, com `initiative_id`, `origin_type`,
`origin_note`, `derived_at/by`; `strategic_initiatives` (F9) com workflow próprio e
`f9_derive_action_plan` transacional; índice único parcial de uma ação viva por iniciativa.
Tela `/planos-de-acao` com cadeia de origem e filtro por origem.

**Rotinas — funcional.** `routine_templates` + `routine_executions`, geração idempotente,
`routine-access.ts` (`canOperateExecution`), telas `/rotinas` e `/meu-trabalho` com buckets
temporais. Falta a conversão ação recorrente → rotina e evidências como entidade (F10).

**Organograma — fundação + tela.** `org_people`, `organizational_positions`,
`position_assignments` com guards de ciclo de chefia, headcount e escopo ancestral;
`org-chart.ts` com `buildOrgTree`, `validateOrgChart`, `responsibilitySummary`,
`positionDefinitionCompleteness`; tela `/organograma` com árvore, lista e alertas. Tabelas vazias.

**Governança/rituais — ausente.** Reuniões, pauta, decisões e revisão de ciclo (F11) não existem.
Existe `audit_events` (técnico), não ritual.

## 2. Como o fluxo de Planejamento Estratégico funciona hoje

Sequência real: escolher empresa/filial (contexto de UI) → ciclo existente ou criado →
etapa 1 direcionamento → etapa 2 diagnóstico → etapa 3 pilares/objetivos/riscos →
etapa 4 indicadores e metas → etapa 5 revisão, envio, aprovação e ativação.

Dados exigidos para ativar: missão, visão, valores e norte; contexto, forças, fraquezas,
oportunidades, ameaças e prioridades; 3 a 7 objetivos ativos, cada um com responsável e ao
menos um indicador ativo; cada indicador com fórmula, fonte, unidade, responsável, baseline e
meta. Medições não entram na completude. Permissões: `strategy.read` para ler,
`strategy.manage` para editar/enviar, `strategy.approve` para aprovar/ativar.

Característica central: **a completude é calculada no banco** (`f8_plan_completeness`), o
frontend nunca muda status direto e toda transição é auditada. Isso é o ativo mais valioso do
projeto e deve ser a espinha dorsal de qualquer onboarding.

## 3. Lacunas para o onboarding "descrevo a empresa e o sistema me conduz"

1. **Não existe porta de entrada de empresa nova.** O assistente pressupõe organização,
   empresa, filial e ciclo já criados; não há um fluxo único que crie a estrutura mínima.
2. **Não existe captura de perfil da empresa** (setor, porte, modelo de operação, dores,
   horizonte, maturidade de gestão). Nada dessa informação é armazenada.
3. **Nenhuma biblioteca de conteúdo.** Não há catálogo de objetivos, indicadores (com fórmula,
   unidade, direção, frequência), riscos, iniciativas ou rotinas por setor. O usuário precisa
   escrever tudo em branco — a maior fricção real.
4. **Sem sugestão nem scoring.** Não há priorização de objetivos, avaliação de maturidade,
   nem "quão pronto está meu ciclo" além da lista de pendências.
5. **Sem diagnóstico guiado.** SWOT é texto livre; não há perguntas fechadas que gerem
   prioridades derivadas de respostas.
6. **Sem organograma mínimo assistido.** Objetivos exigem responsável, mas não há um passo que
   crie pessoas/posições antes de exigi-los; hoje é possível travar o usuário.
7. **Sem rituais.** Ativado o ciclo, não há calendário de reuniões, pauta ou decisão — o ciclo
   morre depois da ativação.
8. **Sem progresso persistido do onboarding** (retomar de onde parou entre sessões e usuários).
9. **Sem separação clara demo × operacional** para empresas novas.

## 4. O que dá para fazer 100% determinístico (sem IA)

Praticamente todo o onboarding. Ordem recomendada:

- **Questionário de perfil** (setor, porte, unidades, horizonte, prioridade percebida,
  maturidade) com respostas fechadas — persistido como perfil da empresa.
- **Biblioteca versionada por setor** (mineração, alimentação/restaurante, construção,
  serviços administrativos): pilares canônicos, objetivos-modelo, indicadores completos
  (nome, fórmula, unidade, direção, frequência, fonte típica), riscos frequentes, iniciativas
  típicas e rotinas recorrentes. Conteúdo curado por humano, não gerado.
- **Regras de recomendação** por mapeamento perfil → itens da biblioteca, com pesos. Nada de
  criação silenciosa: cada sugestão é um cartão que o usuário **aceita, edita ou descarta**.
- **SWOT guiado**: checklists por domínio (pessoas, processo, cliente, financeiro, ativos)
  cujas marcações geram rascunho de prioridades ordenadas por peso.
- **Scoring determinístico**: maturidade de gestão, completude do ciclo (já existe),
  cobertura objetivo→indicador→iniciativa→ação, qualidade do indicador
  (`isKpiIncomplete` já existe), lacunas de responsabilidade (`validateOrgChart` já existe).
- **Templates de metas** a partir de baseline + direção + horizonte (regra aritmética, não
  opinião), sempre editáveis.
- **Organograma mínimo**: passo que cria posições essenciais a partir do porte/setor e vincula
  pessoas, antes de exigir responsáveis nos objetivos.
- **Rituais como agenda gerada por regra**: cadência mensal/trimestral derivada da frequência
  dos indicadores; pauta montada por consulta (desvios, atrasos, medições pendentes, decisões
  abertas).
- **Exportação** do planejamento em documento.

Conclusão: o objetivo de produto não depende de IA. Depende de biblioteca curada + regras.

## 5. O que realmente exigiria IA

Só a **geração de texto novo a partir de descrição livre**:

- transformar um parágrafo de descrição da empresa em missão/visão/valores redigidos;
- resumir entrevista ou texto solto em contexto e SWOT narrativos;
- propor objetivos com redação própria, fora de qualquer catálogo;
- reescrever/normalizar tom de textos escritos pelo usuário;
- classificar texto livre em setor/domínio quando o usuário se recusa a responder o formulário;
- sugerir nome e descrição de indicador inédito não presente na biblioteca.

Tudo isso é **redação e classificação**, nunca decisão nem validação.

## 6. Arquitetura híbrida proposta

```text
Perfil da empresa (formulário fechado)
        │
        ▼
Motor determinístico ── Biblioteca versionada (setor)
        │  regras, pesos, scoring, templates de meta
        ▼
Rascunho de ciclo em cartões de sugestão (aceitar | editar | descartar)
        │                                   ▲
        │                                   │ (opcional)
        │                          Copiloto IA: redação/resumo
        ▼
Assistente F8 existente (etapas 1–5)
        │
        ▼
Validação no banco (f8_plan_completeness) → aprovação → ativação → rituais
```

Princípios não negociáveis:

- **Método e validação sempre no banco.** IA nunca chama RPC de transição, nunca grava direto,
  nunca decide completude. Continua valendo `f8_*`/`f9_*` como fonte única de verdade.
- **IA só produz proposta**, marcada com origem (`manual` | `library` | `ai`), sujeita a
  aceite humano explícito e registrada em auditoria com quem aceitou.
- **Sem IA o produto funciona inteiro.** O copiloto é desligável por empresa e por permissão.
- **Nenhum campo de responsabilidade** (responsável, aprovador, chefia) aceita origem IA.
- Camada de IA isolada em server function própria, sem acesso de escrita ao domínio.

## 7. Riscos de deixar a IA decidir

- **Missão/visão/valores**: texto genérico e intercambiável destrói a credibilidade executiva
  do sistema; o cliente percebe "texto de robô" e desacredita o método inteiro.
- **SWOT**: inventa fatos sobre a empresa (fraquezas e ameaças que não existem) e o
  diagnóstico deixa de ser uma base honesta para decisão.
- **Objetivos**: metas sem lastro operacional, número de objetivos fora da faixa útil, e perda
  do compromisso — ninguém defende objetivo que não escreveu.
- **Indicadores**: fórmula plausível mas sem fonte de dado real; indicador que não se mede
  gera dashboard falso, o pior resultado possível para uma plataforma de gestão.
- **Responsáveis**: atribuição sem autoridade real, conflito com RLS e escopos, e risco de
  responsabilidade formal atribuída a quem não pode responder.
- **Organograma**: hierarquia inventada, chefia incoerente, quebra de guards de ciclo/escopo e
  risco trabalhista/organizacional concreto.
- **Transversal**: rastreabilidade perdida (não se sabe quem decidiu), auditoria enfraquecida,
  homogeneização entre clientes e dependência de fornecedor externo para o núcleo do produto.

## Recomendação de próximos incrementos

1. **F10** como já planejado (ação recorrente → rotina + evidências) — fecha a execução.
2. **F11** rituais (reuniões, pauta, decisões, revisão de ciclo) — sem isso o ciclo não vive.
3. **F12 Onboarding determinístico**: perfil da empresa + biblioteca versionada por setor +
   cartões de sugestão + organograma mínimo, tudo aditivo e sem IA.
4. **F13 Copiloto opcional** de redação, com origem rastreada e aceite humano, apenas sobre
   campos textuais e jamais sobre responsabilidade ou validação.
