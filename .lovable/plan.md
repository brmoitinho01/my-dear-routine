# GMOS — Auditoria somente leitura (pós-F5)

Nada foi alterado: apenas leitura de arquivos e consultas `SELECT`. Nenhuma correção implementada.

## Veredito

- **Apresentação executiva imediata: APTA COM RESSALVAS.** As telas F1–F5 são coerentes, em pt-BR, navegação sem links mortos, dados demonstrativos identificados. Há 3 riscos de palco que precisam de roteiro (não de código).
- **Uso profissional futuro: NÃO APTO ainda.** Faltam RBAC efetivo, responsáveis nos KPIs/planos, validação de medições, testes e integração CRTI.

## Achados P0 (bloqueiam uso profissional; 2 afetam a apresentação)

1. **Nenhum KPI e nenhum plano de ação tem responsável.** `kpis.owner_user_id` nulo em 9/9; `action_plans.owner_user_id` nulo em 6/6. O project knowledge exige responsável declarado em KPI e em plano. Se um diretor perguntar "quem responde por isso?", a tela não responde.
2. **O semáforo executivo usa uma competência não validada.** Última competência de todos os 9 KPIs é 2026-06; essas 9 medições estão `status = 'pending'` com `validated_by` nulo. `src/lib/gmos/demo.ts:77-85` calcula saúde pela última medição sem filtrar status — a apresentação exibe número não validado como resultado.
3. **Duas unidades completamente vazias no seletor de contexto.** `Filial Meu Querido` e `Filial XRM Pré-Moldados`: 0 planos, 0 KPIs, 0 ações, 0 rotinas. Trocar de contexto durante a apresentação leva a telas vazias (estados de vazio existem e são corretos, mas o efeito narrativo é ruim).
4. **RBAC não existe de fato.** `src/lib/auth-context.tsx:1-3` declara explicitamente que o RBAC definitivo foi postergado; `_authenticated/route.tsx:6-12` só verifica "existe usuário logado", no cliente. No banco há apenas 2 atribuições, ambas `group_admin` em escopo `organization`; nenhum papel de gerente/líder/operador atribuído. Ou seja: a segregação por escopo e o cenário cross-company exigidos pelo knowledge nunca foram exercitados com usuário real. RLS está ligada nas 21 tabelas (políticas presentes, 0 política de DELETE) — a proteção existe, mas a granularidade de papéis não foi testada.

## Achados P1

5. **Plano estratégico está em `draft`.** O único plano ("Planejamento Estratégico RM Mineração 2026–2027") tem `status = 'draft'`; será apresentado como se vigente.
6. **Dados demonstrativos desatualizados em relação à data atual.** Medições mensais terminam em 2026-06-30 e hoje é 2026-07-30: julho está ausente/atrasado, o que fica visível nas tendências.
7. **Faixa de semáforo fixa em ±10% e sem suporte a "faixa ideal".** `demo.ts:77-85` usa `meta × 1,10` / `meta × 0,90` em hardcode, igual para todos os KPIs; `target_min`/`target_max` estão nulos em 9/9, então a direção "faixa ideal" prevista no knowledge não tem efeito real.
8. **Escolha dos gráficos de tendência por nome de KPI em hardcode.** `demo.ts:177-189` (`TREND_PREFERENCE`) fixa três nomes de indicador; renomear um KPI muda o painel silenciosamente.
9. **Zero testes.** Nenhum arquivo `*.test.*`/`*.spec.*` e nenhum script `test` em `package.json` (só `dev`, `build`, `build:dev`, `preview`, `lint`, `format`). O processo obrigatório do knowledge prevê "QA independente"; hoje ele é manual.
10. **Middleware de autenticação de server function não está registrado.** `src/integrations/supabase/auth-middleware.ts` (`requireSupabaseAuth`) existe e não é usado; `src/start.ts` registra apenas o anexador de token no cliente. A proteção real é só a RLS. `supabaseAdmin` (`client.server.ts`) não é importado em nenhum caminho alcançável pelo cliente — isso está correto.
11. **Código morto com vocabulário do protótipo antigo.** `src/lib/ia-mock.functions.ts` retorna respostas simuladas com "checklist", "NCs", "Cozinha", "Bar"; `src/lib/api/example.functions.ts` é boilerplate. Nenhum dos dois é importado por rota, mas ambos entram no repositório e podem confundir revisão externa.

## Achados P2

12. `.lovable/legacy-frontend/` mantém 10 rotas e um AppShell do protótipo de restaurante — não registrados no router, mas presentes.
13. Não há estado "sem permissão" próprio por tela: ele é um ramo dentro de `ErrorBlock` (`src/components/gmos/states.tsx:39-47`), dependente da classificação de `translateError`. Nunca foi exercitado por um usuário sem escopo.
14. `routine_templates` não carrega o marcador do lote (0 de 5), embora as 16 execuções carreguem. Está documentado como pré-existente, mas cria assimetria de inventário/rollback.
15. `DEMO_TITLE = "Cenário demonstrativo · RM Mineração"` (`demo.ts:7-8`) é o único ponto que nomeia empresa em código; é rótulo de aviso, não fonte de dados.
16. **Nomenclatura: limpa.** Zero ocorrências de "Daily Restaurant", "Meu Querido", "restaurant", "RMS", "Lovable App"/"Lovable Generated Project" em `src/`. Branding "GMOS / Grupo Moitinho Operating System" consistente em `__root.tsx:78-88` e em todas as telas. Todas as 8 rotas de conteúdo têm `head()` próprio com title, description, og e `noindex`. Os 7 itens de menu (`app-shell.tsx:32-40`) correspondem 1:1 a rotas existentes: nenhum link morto.
17. **Integração CRTI: pendente e declarada como pendente.** `docs/gmos/CRTI_INTEGRATION_MAP_v1.0.md` lista as lacunas (sem credencial, sem tabela de correspondência, sem regra de fechamento). Nenhuma rota, job ou secret de integração existe. Coerente com o knowledge.
18. **Documentação e rollback presentes:** `F1_ROLLBACK`, `F2_ROLLBACK`, `F3_CORPORATE_CONTEXT`, `F4_PRESENTATION_READY`, `F5_DEMO_RM_2026`, `DEMO_RM_2026_V1_SEED.sql` e `DEMO_RM_2026_V1_ROLLBACK.sql` por UUID. Inventário do F5 confere com o banco: 4 objetivos, 9 KPIs, 54 medições, 6 ações, 4 riscos, 16 execuções, 100% marcados.
19. Conflito com o knowledge: a "Fase atual" declarada é "Fase 0 — fundação, ainda não implementar telas funcionais", mas F1–F5 já estão implantadas. O documento de conhecimento está desatualizado em relação ao sistema.

## Roteiro de apresentação segura (7 minutos)

Contexto fixo em **RM Mineração / Filial RM Mineração** do início ao fim. Não trocar de empresa no seletor.

1. **0:00–0:40 — `/auth`.** Entrar com o usuário administrador. Frase: acesso interno, sem cadastro público.
2. **0:40–2:00 — `/apresentacao`.** Ler o ciclo de gestão e o painel executivo da filial. Ao mostrar o semáforo, dizer: "última competência fechada, junho/2026; os valores do lote demonstrativo estão marcados como ilustrativos". Apontar o aviso "Cenário demonstrativo".
3. **2:00–3:00 — `/` Visão do Grupo.** Mostrar a consolidação e explicar que as outras duas filiais ainda não têm ciclo cadastrado — isso é o roadmap, não uma falha.
4. **3:00–4:30 — `/planejamento`.** Percorrer a cadeia objetivo → KPI (fórmula, unidade, direção, meta, histórico) → plano de ação. Este é o trecho mais forte.
5. **4:30–5:30 — `/planos-de-acao`.** Mostrar 5W2H, custo previsto/realizado e progresso. Se perguntarem sobre responsável, responder que a atribuição nominal entra na próxima etapa (é o achado P0-1).
6. **5:30–6:30 — `/rotinas`.** Aderência e evidência.
7. **6:30–7:00 — `/estrutura` e `/acessos`.** Hierarquia e escopos, declarando que é leitura nesta versão.

Não fazer ao vivo: trocar para Meu Querido ou XRM; criar/editar registro; abrir `/acessos` esperando papéis por unidade; prometer CRTI como existente.

## Plano profissional por etapas (proposta, sem execução)

- **Etapa A — Credibilidade do dado (P0-1, P0-2, P1-5, P1-6).** Atribuir responsável a todo KPI e plano; validar ou marcar visualmente a competência pendente; filtrar semáforo por medição validada com rótulo "aguardando validação"; decidir a promoção do plano de `draft` para vigente; fechar a competência de julho.
- **Etapa B — RBAC real (P0-4, P2-13).** Reintroduzir leitura de papéis/escopos no `auth-context`, aplicar `requireSupabaseAuth` nas server functions, criar usuários de teste por papel (diretor, gerente, líder, operador) e provar cross-company negado, com estado "sem permissão" próprio por tela.
- **Etapa C — Regra de KPI configurável (P1-7, P1-8).** Limites de semáforo por KPI no banco (incluindo faixa ideal com `target_min`/`target_max`) e seleção de tendências por configuração, não por nome.
- **Etapa D — Qualidade (P1-9, P1-11, P2-12).** Introduzir Vitest com script `test`, cobrir cálculo de semáforo, aderência e RLS por papel; remover o código morto do protótipo.
- **Etapa E — Onboarding das demais unidades (P0-3).** Ciclo, pilares, KPIs e rotinas para Meu Querido e XRM, com dados reais.
- **Etapa F — CRTI (P2-17).** Só depois de contrato de dados, tabela de correspondência e regra de fechamento homologadas; carga idempotente entrando como `pending`.
- **Etapa G — Governança documental (P2-19).** Atualizar o project knowledge para refletir F1–F5 concluídas.
