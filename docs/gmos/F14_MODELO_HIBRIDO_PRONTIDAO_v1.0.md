# F14 — Modelo híbrido (Grupo + clientes externos) — Análise de prontidão e plano

Status: **proposta para validação**. Nenhuma migration, dado, usuário ou publicação executados.
Depende de: F13.1 (estabilização, em teste no ambiente isolado).

## 1. Decisão de arquitetura proposta

**Cada cliente externo = uma organização própria** (`organizations`), com sua árvore de escopos (empresa → filial).

Por quê: o motor de permissões (M0) já isola por organização e escopo. `has_permission` sobe a árvore de escopos; atribuições exigem papel, escopo e atribuição na mesma organização (`ura_guard_insert`). Um cliente em organização separada **não entra** na consolidação do Grupo, porque o papel `group_owner/group_admin` está no escopo raiz do Grupo Moitinho e não alcança outra organização.

Consultores continuam cadastrados no Grupo Moitinho e recebem **atribuições com vigência** na organização de cada cliente vinculado — o motor já permite (a atribuição não depende da organização "de origem" do usuário) e já suporta `effective_from/effective_to` e revogação auditada.

## 2. Reutilizável hoje

| Recurso | Uso no modelo híbrido |
|---|---|
| Organizações, escopos, `has_permission`, RLS por filial | Isolamento por cliente sem novas policies |
| Atribuições com vigência, revogação e auditoria (`gmos_assign_role`/`gmos_revoke_role`) | Vínculo consultor ↔ cliente por período |
| Papéis `group_admin`, `manager`, `collaborator` | Administrador, Gestor do cliente, Colaborador |
| Ciclos, objetivos, KPIs, medições e validação (`kpi.validate`) | Núcleo do planejamento |
| Submissão/aprovação do ciclo (`f8_submit_plan_for_review`, `f8_approve_plan`, `strategy.approve`) | Envio para revisão e validação |
| Assistente de direcionamento, Retrato do negócio, questionário de maturidade, biblioteca setorial (F8.1/F12) | Etapas da jornada guiada |
| Aba Diagnóstico + 7 ferramentas (F13) | Ferramentas complementares da planilha |
| Plano de ação 5W2H e rotinas | Execução |
| Painel executivo de KPIs | Visão consolidada (com correção abaixo) |

## 3. Perfis — mapeamento sem duplicar

| Perfil pedido | Papel | Situação |
|---|---|---|
| Administrador | `group_admin` (Grupo) / `group_admin` na org do cliente | Existe |
| Gestor do cliente | `manager` | Existe (strategy.manage, action.manage, kpi.validate) |
| Colaborador | `collaborator` | Existe, mas **não lê o planejamento** (sem strategy.read) — decidir se deve ler |
| Consultor | — | **Lacuna**: precisa de leitura ampla + revisar/comentar/recomendar, sem administrar acessos e sem ver o consolidado do Grupo |
| Visualizador | — | **Lacuna**: somente leitura (strategy.read, action.read, routine.read, dashboard.personal) |

Como os papéis pertencem a uma organização (`roles.organization_id`), cada organização-cliente recebe seu conjunto padrão de papéis no momento do cadastro (por RPC de provisionamento, não manualmente).

Novas permissões necessárias: `strategy.review` (revisar etapas) e `strategy.comment` (comentar/recomendar).

## 4. Lacunas para o modelo híbrido

1. **Papéis Consultor e Visualizador** + permissões `strategy.review` e `strategy.comment`.
2. **Provisionamento de cliente**: RPC que cria organização, escopo raiz, empresa, filial e papéis padrão, com auditoria. Restrita a `group_admin` do Grupo.
3. **Vínculo consultor ↔ cliente**: tela para atribuir/revogar com vigência (reutiliza `gmos_assign_role`).
4. **Revisão por etapa e comentários**: hoje só o ciclo inteiro é submetido. Falta: situação por etapa (rascunho → em revisão → ajustes solicitados → validada) e uma tabela de comentários/recomendações por etapa, com autor, data e resolução.
5. **Consolidação do Grupo**: o painel executivo soma tudo o que a RLS permite. Um usuário com papel no Grupo **e** em um cliente veria KPIs do cliente no consolidado. **Correção obrigatória**: filtrar o painel pela organização do Grupo (e só empresas internas marcadas para consolidação).
6. **Seletor de organização**: o seletor atual é de empresa/filial; consultores precisam escolher o cliente primeiro. O contexto de autorização (`gmos_my_authorization`) devolve uma única `organizationId` e precisa listar todas as organizações acessíveis.
7. **Escolha de ciclo**: a tela mostra só o ciclo mais recente.
8. **Jornada guiada com progresso** (detalhada na proposta anterior).
9. **Cadastro de usuários do cliente**: hoje é manual pela equipe; para piloto é aceitável (convite pela equipe), sem cadastro público.

## 5. Correções indispensáveis antes do piloto

| # | Correção | Interno | Cliente externo |
|---|---|---|---|
| 1 | F13.1 estabilização | Sim | Sim |
| 2 | Escolha de ciclo | Sim | Sim |
| 3 | Jornada guiada com progresso | Sim | Sim |
| 4 | Painel do Grupo filtrado por organização | Recomendado | **Sim** |
| 5 | Papéis Consultor e Visualizador | — | **Sim** |
| 6 | Provisionamento de cliente + vínculo de consultor | — | **Sim** |
| 7 | Seletor de organização | — | **Sim** |
| 8 | Revisão por etapa + comentários | Desejável | **Sim** |

Os pilotos internos podem começar após 1–3; os externos exigem 1–8.

## 6. Melhorias para depois

SWOT sugerida pelas análises; tamanho de mercado; diagnóstico de áreas; BSC; módulo financeiro (DRE, sazonalidade); importação da planilha; notificações por e-mail de revisão; relatório PDF do plano; autoatendimento de convites pelo gestor do cliente.

## 7. Fluxo de acesso e aprovação

```text
Grupo (group_admin)
  └─ provisiona cliente  → organização + empresa + filial + papéis padrão  [auditado]
  └─ vincula consultor   → atribuição "consultant" com vigência             [auditado]
  └─ convida gestor do cliente → atribuição "manager" na filial do cliente

Gestor do cliente: inicia ciclo → preenche etapa → "Enviar para revisão"
Consultor: revisa → comenta / recomenda → "Solicitar ajustes" ou "Validar etapa"
Gestor: ajusta → reenvia → ... → todas as etapas validadas
Aprovação final do ciclo: strategy.approve
  (proposta: gestor do cliente aprova; consultor valida tecnicamente antes)
Ciclo aprovado: bloqueado; reabertura com motivo e auditoria (F13.1)
Fim do contrato: vigência da atribuição do consultor expira → acesso encerrado automaticamente
```

Decisões pendentes para você:
- Quem dá a aprovação final no cliente: o gestor do cliente, o consultor ou ambos?
- Colaborador deve ler o planejamento?
- Clientes podem ter mais de uma empresa/filial no piloto?

## 8. Plano de testes de isolamento

Executados apenas em ambiente isolado com dados fictícios: Grupo + Cliente A + Cliente B.

| # | Cenário | Esperado |
|---|---|---|
| 1 | Gestor do Cliente A lê ciclos/KPIs/ações/análises do Cliente B | 0 linhas |
| 2 | Gestor do Cliente A grava em filial do Cliente B (insert/update direto) | Recusado |
| 3 | Consultor vinculado só ao A acessa B | 0 linhas |
| 4 | Consultor após fim da vigência | 0 linhas |
| 5 | Consultor tenta administrar acessos ou ver painel do Grupo | Recusado / oculto |
| 6 | Proprietário do Grupo no painel consolidado | Só empresas internas; nenhum KPI de cliente |
| 7 | Usuário com papel no Grupo e no Cliente A | Consolidado sem o A; A acessível só pelo seletor |
| 8 | Visualizador tenta salvar qualquer registro | Recusado |
| 9 | Colaborador do cliente | Só o que seu papel permite |
| 10 | RPCs chamadas com ids de outro cliente | Recusado sem vazar dados |
| 11 | Comentário do consultor visível ao gestor do mesmo cliente e invisível a outros | OK |
| 12 | Auditoria registra provisionamento, vínculos, revisões e reaberturas | OK |

Mais testes automatizados para mapeamento de papéis, filtro do consolidado e estados de revisão por etapa.

## 9. Sequência recomendada

| Fase | Entrega | Libera |
|---|---|---|
| A | F13.1 estabilização (em teste) | — |
| B | Escolha de ciclo + jornada guiada | **Pilotos internos** (Meu Querido → RM → XRM) |
| C | Painel do Grupo por organização + papéis Consultor/Visualizador | — |
| D | Provisionamento de cliente + vínculo de consultor + seletor de organização | — |
| E | Revisão por etapa + comentários | **Piloto externo** |
| F | Testes de isolamento completos (seção 8) em ambiente isolado | Aprovação para produção |
| G | Ferramentas complementares e financeiro | Segunda fase |

Cada fase segue: especificação → revisão de dados/segurança → implementação em ambiente isolado → QA → sua aprovação → aplicação controlada.
