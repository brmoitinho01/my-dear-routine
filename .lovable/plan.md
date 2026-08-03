# GMOS — Refatoração para plataforma universal de planejamento e gestão

Análise feita sobre o código e o banco atuais (somente leitura). Nenhuma migração, escrita ou publicação foi executada.

> Primeiro incremento executado (F6 — Fundação do Método GMOS): catálogo canônico tipado, rota `/metodo`, navegação reorganizada, bloco "Estrutura oficial do Grupo" em `/estrutura`, card do método no painel e texto de acesso atualizado. Somente frontend, consultas de leitura e documentação (`docs/gmos/F6_METODO_GMOS_FOUNDATION_v1.0.md`). O restante do plano abaixo permanece pendente.

## Estado verificado hoje

Banco (consultado agora):
- Empresas cadastradas: RM Mineração, XRM Pré-Moldados, Meu Querido — 1 unidade cada. Não existe registro de Elite, Blue House, XRM Construtora nem Toca Hub.
- Estrutura: 7 escopos, 0 departamentos, 3 usuários, 1 papel, 2 atribuições, 17 permissões (domínios org, iam, strategy, action, routine, governance).
- Dados F2/F5: 1 plano, 4 pilares, 4 objetivos, 9 KPIs, 54 medições, 6 planos de ação, 4 riscos, 5 rotinas, 16 execuções — tudo na Filial RM Mineração.

Código: 7 rotas autenticadas (`apresentacao`, `index`, `estrutura`, `planejamento`, `planos-de-acao`, `rotinas`, `acessos`), camada de dados em `src/lib/gmos/{structure,f2,f3,demo}.ts`, contexto corporativo em `workspace-context.tsx`, navegação fixa em `app-shell.tsx`.

## 1. O que já existe e se reaproveita

Manter praticamente intacto:
- Fundação multiempresa e RBAC: `organizations`, `companies`, `business_units`, `departments`, `scopes`, `scope_types`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `users`, `audit_events` e as funções `has_permission`, `accessible_scope_ids`, `accessible_organization_ids`, `current_user_id`, `f1_sync_entity_scope`, gatilhos de auditoria e de `updated_at`.
- Os quatro níveis pedidos (Grupo, Empresa, Unidade, Área) já são representáveis: `scope_types` cobre organization/company/business_unit/department — "Área" passa a ser `departments` sem nova tabela.
- Padrões de frontend: RLS-first, estados de carregando/vazio/erro/sem permissão, `RecordDialog`, `ConfirmDialog`, `PageHeader`, `WorkspaceProvider`, painel executivo com Recharts.
- Núcleo estratégico parcial: `strategic_plans` (Ciclo), `strategic_pillars`, `strategic_objectives`, `kpis`, `kpi_measurements`, `action_plans`, `strategic_risks`, `routine_templates`, `routine_executions`.

## 2. Incompatibilidades com a nova arquitetura

1. Cadeia incompleta: faltam Diagnóstico, Iniciativa/Projeto, Reunião, Decisão, Evidência e Revisão estratégica. Hoje Objetivo vai direto a Ação.
2. Meta não é entidade: alvo mora em colunas de `kpis` (`target_value`, `target_min/max`), sem histórico por ciclo/período.
3. `business_unit_id NOT NULL` em todas as tabelas F2 impede plano de nível Grupo/Empresa e planos de nível Área.
4. Sem noção de maturidade nem de módulos setoriais: nenhuma tabela de configuração por empresa, nada de feature flags.
5. Sem taxonomia genérica (categorias/tipos), o que empurraria para tabelas por setor — exatamente o que se quer evitar.
6. Ausência de Toca Hub como centro de custos compartilhados e de vínculo cliente interno.
7. Navegação organizada por tabela ("Planejamento", "Planos de ação", "Rotinas") em vez de pelo método de cinco etapas.
8. Camada `demo.ts` e banners DEMO-RM-2026-V1 amarram a experiência a uma unidade específica.
9. "Elite" não existe no banco nem no código — a remoção pedida é só garantia documental/validação, não trabalho de dados.

## 3. Modelo conceitual — 12 domínios centrais

1. Organização e estrutura — organizations, companies, business_units (unidade), departments (área), scopes.
2. Pessoas e acesso — users, roles, permissions, role_permissions, user_role_assignments.
3. Configuração e maturidade — perfil da empresa: nível (Essencial/Estruturado/Gerenciado/Otimizado), módulos setoriais ativos, recursos avançados opcionais.
4. Identidade estratégica — missão, visão, valores, propósito, posicionamento por empresa/ciclo.
5. Ciclos — `strategic_plans` renomeado conceitualmente para Ciclo, com escopo flexível (grupo/empresa/unidade/área).
6. Diagnóstico — registros tipados (SWOT simples no Essencial; PESTEL, Cinco Forças, stakeholders como tipos adicionais quando o recurso está ativo). Uma tabela + tipo, não uma tabela por framework.
7. Objetivos e temas — pilares/temas + objetivos (3 a 7 por ciclo, validado na UI).
8. Indicadores e medições — kpis + kpi_measurements + nova entidade Meta (alvo por indicador, período e ciclo, com histórico).
9. Iniciativas e ações — Iniciativa/Projeto como agrupador; `action_plans` passa a pendurar em iniciativa ou direto no objetivo.
10. Rotinas e controles — routine_templates/routine_executions, com tipo de controle e categoria setorial.
11. Governança — reuniões, decisões, revisões estratégicas, riscos, evidências (anexos/links) e `audit_events`.
12. Economia e custos — orçamento essencial por ciclo/iniciativa, custo previsto vs realizado e rateio de custos compartilhados do Toca Hub.

Princípio: setor entra como categoria/tipo/atributos, nunca como tabela nova. Ex.: "britagem" é uma categoria de rotina/controle de RM Mineração; "CMV" é um indicador de Meu Querido; "medição de obra" é um tipo de controle de XRM Construtora.

## 4. Navegação e experiência simplificada

Sidebar reorganizada pelo método GMOS, com o seletor de Empresa/Unidade já existente:

```text
Painel            visão consolidada por nível selecionado
1 Direcionar      identidade estratégica, ciclo vigente
2 Diagnosticar    diagnóstico resumido (avançados só se ativados)
3 Planejar        objetivos, indicadores, metas, iniciativas, orçamento
4 Executar        ações, rotinas, evidências
5 Controlar       painel de resultados, reuniões, decisões, revisão, riscos
Configurar        maturidade, módulos setoriais, estrutura, acessos
Apresentação      modo executivo (mantido)
```

Regras de UX: um assistente "Começar do zero em 20 minutos" que cria ciclo, 3 objetivos, indicadores e responsáveis; nenhum campo avançado aparece no nível Essencial; cada tela só mostra o que a permissão do escopo permite.

## 5. Módulos setoriais sem duplicar o núcleo

- Um catálogo de módulos (mineração, pré-moldados, construtora, projetos/instalação, restaurante, centro de serviços) e uma ativação por empresa.
- Cada módulo entrega apenas: catálogo de indicadores sugeridos, categorias de rotina/controle, campos extras opcionais em JSONB validado e vocabulário de rótulos.
- Nenhum módulo cria tabela nova de negócio. Se um módulo exigir tabela própria no futuro, isso é decisão explícita, não padrão.
- Toca Hub usa o mesmo núcleo, com clientes internos (empresas atendidas), serviços, SLA e rateio no domínio 12.

## 6. Maturidade e feature flags

- Quatro camadas: Essencial → Estruturado → Gerenciado → Otimizado, definidas por empresa.
- Cada recurso avançado (PESTEL, Cinco Forças, stakeholders detalhados, mapa de processos, riscos avançados, auditorias, compliance, ESG, cenários, OKRs avançados, mapas estratégicos) é uma flag com nível mínimo sugerido, podendo ser ligada isoladamente.
- Flags controlam apenas exibição e obrigatoriedade — nunca autorização. Autorização continua em RLS + `has_permission`.
- Hook `useCompanyFeatures()` no frontend, leitura da configuração da empresa selecionada.

## 7. Migração incremental e reversível

Cada fase = uma migração aditiva idempotente + rollback documentado em `docs/gmos/`. Nada de exclusão física; descontinuação por status.

- Fase A — Estrutura do Grupo: cadastrar XRM Construtora, Blue House e Toca Hub com unidade e escopo; validar ausência de Elite; nenhuma tabela nova.
- Fase B — Configuração e maturidade: perfil da empresa, catálogo de módulos, ativações, flags; tela Configurar.
- Fase C — Flexibilização de escopo: tornar o vínculo de unidade opcional nas tabelas de ciclo/objetivo/indicador/ação, mantendo empresa obrigatória; RLS ajustada por escopo efetivo.
- Fase D — Fechar a cadeia: identidade estratégica, diagnóstico tipado, metas, iniciativas.
- Fase E — Governança: reuniões, decisões, revisões, evidências.
- Fase F — Economia: orçamento e rateio de custos compartilhados.
- Fase G — Navegação pelas cinco etapas e assistente de início rápido; painéis por nível.
- Fase H — Desacoplar demonstração: dados demo viram conteúdo opcional, banners condicionais.

## 8. Riscos

Técnicos: mudar obrigatoriedade de unidade exige revisar RLS de 9 tabelas (risco de vazamento entre empresas se feito às pressas); JSONB de campos setoriais sem validação vira lixo de dados; muitas flags aumentam caminhos de UI a testar; `routeTree`/rotas renomeadas quebram links da apresentação.
Produto: excesso de domínios reintroduz burocracia; níveis de maturidade mal definidos fazem todos ligarem tudo; a apresentação executiva pode regredir durante a fase G; replicação em consultoria exige um modelo de provisionamento de novo grupo que ainda não existe.

## 9. Critérios de aceite por fase

- A: seis empresas ativas com unidade e escopo; zero referência a Elite em código, banco e docs; telas existentes continuam funcionando.
- B: nível de maturidade e módulos alteráveis por empresa; recurso desligado não aparece; flag não altera permissão.
- C: ciclo criado em nível de empresa e de área; teste cross-company confirma isolamento; nenhum dado existente perdido.
- D: cadeia Empresa→Ciclo→Diagnóstico→Objetivo→Indicador→Meta→Iniciativa→Ação navegável ponta a ponta; 3 a 7 objetivos e 1 a 3 indicadores validados na UI.
- E: reunião gera decisões vinculadas a objetivo/ação; revisão estratégica registra período e conclusões; evidências anexáveis.
- F: orçamento por ciclo/iniciativa com previsto vs realizado; rateio Toca Hub visível na empresa cliente.
- G: navegação em cinco etapas; assistente cria ciclo mínimo em uma sessão; apresentação preservada.
- H: sistema utilizável em empresa sem nenhum dado demo, sem telas vazias sem orientação.

## 10. Arquivos e tabelas provavelmente afetados

Manter: `organizations`, `companies`, `business_units`, `departments`, `scopes`, `scope_types`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `users`, `audit_events` e funções de segurança.
Adaptar: `strategic_plans`, `strategic_pillars`, `strategic_objectives`, `kpis`, `kpi_measurements`, `action_plans`, `strategic_risks`, `routine_templates`, `routine_executions` (escopo flexível, categoria/tipo, vínculo a iniciativa/meta).
Criar: configuração/maturidade da empresa, módulos e ativações, flags, identidade estratégica, diagnóstico, metas, iniciativas, reuniões, decisões, revisões, evidências, orçamento e rateio.
Descontinuar por status/flag: dependência rígida do lote DEMO-RM-2026-V1 e pilares como única forma de agrupar objetivos.

Frontend: `src/components/gmos/app-shell.tsx`, `workspace-context.tsx`, `presentation-flow.tsx`, `presentation-context.tsx`, `demo-banner.tsx`, `executive-demo-panel.tsx`; `src/lib/gmos/{structure,f2,f3,demo}.ts` (mais novos módulos por domínio); rotas `_authenticated/{index,estrutura,planejamento,planos-de-acao,rotinas,acessos,apresentacao}.tsx` e novas rotas das cinco etapas; `src/integrations/supabase/types.ts` (regenerado); docs em `docs/gmos/`.

## Observações

- A base atual é adequada: recomendo evolução aditiva, não reconstrução.
- Cada fase é pequena, com rollback próprio, e nenhuma altera dados reais sem autorização explícita.
