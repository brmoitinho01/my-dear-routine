
# Arquitetura v2.1.1 Final — Gate Pré-Migration
## Plano de auditoria documental (modo leitura)

---

## 0. Contrato deste plano (substitui redação anterior)

**A aprovação deste plano autoriza exclusivamente auditoria técnica em modo de leitura, análise arquitetural e elaboração documental. Mesmo após a aprovação deste plano, nenhuma alteração técnica estará autorizada. Qualquer migration, geração ou execução de SQL, correção de segurança, alteração de banco, política RLS, função, trigger, código, frontend, backend, commit, deploy ou publicação exigirá uma nova autorização específica e separada.**

### 0.1 Escopo autorizado nesta etapa
A aprovação deste plano permitirá somente:
- inspecionar o código atual;
- consultar o banco exclusivamente em modo de leitura;
- levantar tabelas, views, enums, funções, triggers, políticas RLS, buckets e rotas;
- confirmar o estado atual da versão v1;
- verificar se a reversão foi concluída;
- identificar se algum objeto da v2 ou v2.1 chegou a ser materializado;
- apresentar a contagem de registros das tabelas atuais;
- diagnosticar detalhadamente o item "Security — 1 Issue";
- analisar a arquitetura;
- corrigir inconsistências documentais;
- produzir o documento final "Arquitetura v2.1.1 Final — Gate Pré-Migration".

### 0.2 Ações expressamente proibidas
A aprovação deste plano **não autoriza**:
- gerar migrations;
- gerar SQL de criação ou alteração;
- executar qualquer SQL de escrita;
- criar ou modificar tabelas, colunas, enums, funções, triggers, views ou políticas RLS;
- alterar autenticação ou permissões;
- corrigir automaticamente o Security Issue;
- utilizar "Try to fix all";
- inserir, atualizar ou excluir dados;
- executar seeds;
- criar objetos da arquitetura v2.1.1;
- alterar arquivos do frontend ou do backend;
- modificar rotas ou componentes;
- regenerar tipos do Supabase;
- criar commits;
- publicar ou fazer deploy;
- realizar qualquer mudança no projeto.

**Todas as consultas ao banco nesta etapa serão exclusivamente de leitura (SELECT).**

---

## 1. Entrega esperada após aprovação

Documento "Arquitetura v2.1.1 Final — Gate Pré-Migration" contemplando:

1. Confirmação da reversão da v2/v2.1.
2. Estado atual do código (versão ativa v1, arquivos-chave, rotas ativas).
3. Confirmação de que o frontend usa somente tabelas v1.
4. Confirmação de que nenhum objeto da v2/v2.1 foi criado (enums, tabelas, funções, triggers, views, policies).
5. Contagem atual de registros de todas as tabelas v1.
6. Diagnóstico exato do "Security — 1 Issue": nome do finding, objeto afetado, severidade, causa, impacto, correção recomendada, alterações técnicas necessárias, riscos da correção.
7. Inventário definitivo e corrigido das tabelas: novas na v2.1.1; existentes evoluídas; existentes mantidas sem alteração; legadas temporárias; descontinuadas futuramente; totais por fase.
8. Modelo de escopo com FKs físicas (sem `scope_type/scope_id` polimórfico) em `user_assignments` e `routine_scopes`, com CHECKs de escopo válido e coerência hierárquica.
9. Papéis separados: administrador, diretor, gerente, líder, operador — cada um com definição própria (diretor ≠ administrador).
10. Matriz explícita de permissões (ação × papel × escopo), sem uso de ordem implícita do enum.
11. Agenda e atribuição vinculadas ao `routine_scope_id` (não ao `routine_id` diretamente).
12. Responsável esperado × executor real: `expected_user_id`, `executor_user_id`, `expected_supervisor_id`, `assigned_at`, `assigned_by`, `scheduled_for`, `window_start`, `due_at`, `grace_until`.
13. Motor de geração antecipada das execuções (funções + jobs pg_cron), com timezone por unidade.
14. Regras automáticas de abertura de janela, atraso, não realização, sob demanda e idempotência (UNIQUE anti-duplicidade).
15. Máquina de status e transições permitidas: agendada, pendente, em_andamento, concluída, concluída com ressalva, atrasada, não realizada, cancelada.
16. Regras de substituição e reatribuição (ausência, sem usuário disponível, comparação esperado × real).
17. Versionamento imutável: `is_current` com índice único parcial; triggers bloqueando alteração/deleção em versão publicada; resolução do ciclo `routines ↔ routine_versions`.
18. Operação transacional `finalize_execution`: locks, validações de obrigatórios/fotos/críticos, cálculo de métricas, geração de NC, auditoria, bloqueio de dupla finalização.
19. Fórmulas de preenchimento e conformidade: `fill_pct`, `conformity_pct`, `weighted_score`, tratamento de "não se aplica".
20. Estratégia para NC e planos de ação: evolução de `non_conformities` (sem criar `deviations`); rename apenas na UI para "Desvios e Não Conformidades".
21. Ordem definitiva das migrations: M0 (tipos independentes) → M1 (hierarquia) → M2 (identidade e RLS) → M3 (motor de rotinas) → M4 (execução) → M5 (cutover frontend) → M6 (estabilização).
22. Critérios de aceite por migration.
23. Plano de testes RLS com pelo menos duas empresas fictícias (A e B) sob a mesma org, cobrindo operador, líder, gerente, diretor e administrador; cenários cross-empresa; cenário sem atribuição.
24. Riscos e medidas de mitigação.

Views simples (sem schema `analytics`, sem materialized) para desempenho por usuário, departamento, unidade, empresa e Grupo; atrasadas; não realizadas; NCs abertas; planos atrasados — apresentadas apenas como especificação documental.

---

## 2. Método de auditoria (somente leitura)

- Inspeção de arquivos: `src/lib/auth-context.tsx`, `src/routes/_authenticated/*`, `src/integrations/supabase/*`, `src/router.tsx`, `.lovable/plan.md`, `supabase/migrations/`.
- Consultas SELECT em `information_schema` e `pg_catalog` para listar tabelas, colunas, enums, funções, triggers, views, policies e grants.
- `SELECT count(*)` por tabela v1.
- Leitura do resultado do scanner de segurança já disponível.
- Nenhuma escrita, seed, migration, alteração de RLS/auth, edição de código, commit, deploy ou publicação.

---

## 3. Encerramento obrigatório

Ao finalizar o documento:
- **não gerar** a migration M0;
- **não gerar** SQL;
- **não corrigir** o Security Issue;
- **não alterar** banco ou código;
- **não implementar** nenhum item;
- **aguardar** nova autorização específica.

O próximo passo, após a validação documental da Arquitetura v2.1.1, será solicitado separadamente: geração do SQL da M0 **apenas para revisão**, ainda sem autorização de execução.
