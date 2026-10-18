# Etapa B — Seleção de ciclos e jornada guiada — Especificação v1.0

Status: **proposta para validação**. Nada executado no banco, nada publicado.

## 0. Situação da Etapa 1 (F13.1) e dependências

| Item | Situação |
|---|---|
| Código (tela Diagnóstico, justificativas, aviso de não salvo, bloqueio de ciclo aprovado) | Pronto no rascunho "Etapa 1 — Estabilização" |
| Testes automáticos | 282 passando (12 novos) |
| Regras novas do banco | **Não aplicadas** (ficam guardadas no rascunho) |
| 8 testes funcionais | **Não executados**: o rascunho usa o mesmo banco da produção |

Dependências da Etapa 1 que afetam a Etapa B:
1. **Bloqueio de ciclo aprovado e "Reabrir revisão"**: a jornada mostra o estado do ciclo e usa esse bloqueio. Sem ele, a etapa "Direcionamento" poderia devolver um ciclo aprovado para Rascunho.
2. **Gravação do Diagnóstico pelas regras novas**: a jornada mede o progresso das análises.
3. O rascunho está **atrás do projeto principal** e precisa ser atualizado antes de seguir.

Conclusão: a Etapa B pode ser **especificada e implementada em rascunho** agora, mas só pode ir para produção **depois** da Etapa 1 validada no ambiente isolado. A parte de escolha de ciclo não depende da Etapa 1.

## 1. Ambiente de homologação isolado

Verificado: **o projeto não tem hoje um ambiente com banco próprio.** O rascunho existente compartilha o banco de produção.

| Alternativa | Como funciona | Custo | Riscos |
|---|---|---|---|
| **A. Projeto de homologação separado (recomendada)** | Cópia do projeto em um novo projeto, com o próprio Lovable Cloud e banco vazio. Aplicam-se todas as migrations do repositório em ordem e um lote de dados fictícios. | Uso de Cloud de um segundo projeto (cobrança por uso, baixo com pouco tráfego) e créditos para configurar. | As migrations precisam rodar do zero; qualquer diferença aparece aqui, o que é desejável. Manter o código sincronizado com o principal. |
| B. Rascunho com banco isolado | Só disponível quando o rascunho já nasce com banco próprio. Hoje não está disponível para este projeto. | — | Não depende de nós. |
| C. Banco externo próprio | Conectar um banco fora do Lovable Cloud. | Assinatura externa. | Mais configuração, credenciais externas e fora do padrão do projeto. Não recomendada. |

Procedimento da alternativa A:
1. Você cria (ou autoriza criar) a cópia do projeto com o nome "GMOS — Homologação".
2. Ativar Lovable Cloud na cópia.
3. Aplicar as migrations do repositório em ordem e, depois, as da Etapa 1.
4. Inserir dados fictícios: Organização Teste, Empresa A e Empresa B, uma filial cada, usuários fictícios (admin, gestor A, gestor B, colaborador), um ciclo em rascunho e um aprovado.
5. Rodar os 8 testes funcionais e entregar o relatório.
6. Nada volta para a produção sem a sua aprovação.

Nenhum dado real é copiado.

## 2. Objetivo da Etapa B

Permitir escolher o ciclo do planejamento e seguir uma jornada guiada com progresso visível, **reaproveitando** as telas que já existem.

## 3. Escopo

### 3.1 Seleção de ciclo
- Seletor de ciclo no topo de Planejamento Estratégico: lista os ciclos da filial (título, período, situação), do mais recente ao mais antigo.
- Ciclo escolhido fica no endereço da página (`?ciclo=`), para recarregar e compartilhar o link. Sem escolha, abre o ciclo ativo ou, na falta dele, o mais recente.
- Botão "Novo ciclo" com o formulário simples que já existe.
- Ciclos encerrados ou aprovados abrem só para leitura (regra da Etapa 1).
- A seleção é só contexto de tela; quem vê o quê continua sendo decidido pelo banco.

### 3.2 Jornada guiada
Uma faixa de progresso no topo do ciclo, com 6 passos. Cada passo **abre a tela que já existe**:

| # | Passo | Tela reaproveitada | Concluído quando |
|---|---|---|---|
| 1 | Retrato do negócio | Retrato do negócio (F8.1-B1) | Retrato revisado |
| 2 | Diagnóstico | Aba Diagnóstico + questionário de maturidade | Diagnóstico revisado e ao menos 1 análise salva |
| 3 | Direcionamento | Assistente de missão, visão e valores (F8.1-A) | Direcionamento confirmado |
| 4 | SWOT | Bloco SWOT da aba Diagnóstico | Os 4 quadrantes preenchidos |
| 5 | Objetivos e KPIs | Abas Objetivos, KPIs e Medições | 3 a 7 objetivos, cada um com ao menos 1 KPI completo |
| 6 | Planos de ação | Plano de Ação | Cada objetivo com ao menos 1 plano de ação |

- Cada passo mostra: situação (não iniciado, em andamento, concluído), uma frase de orientação e o botão "Continuar".
- Percentual geral e "próximo passo recomendado".
- Os critérios de conclusão vêm da regra oficial de completude que já existe no banco (`f8_plan_completeness`) e dos estados já calculados em `deriveJourneyStatus`. **Nenhuma regra nova é duplicada na tela.**
- A rota antiga `/jornada-estrategica` não é apagada; a jornada passa a ser a porta de entrada dentro de Planejamento.
- Visão Geral ganha um cartão discreto com o progresso de cada filial visível (só leitura), útil para acompanhar os planejamentos das empresas do grupo.

### 3.3 Fora do escopo
Revisão por etapa com comentários do consultor, perfis Consultor/Visualizador, clientes externos, permissões por item para colaboradores (Etapas C a E).

## 4. Banco de dados
**Nenhuma migration prevista.** Tudo usa tabelas e funções existentes. Se surgir necessidade, ela será apresentada antes e testada só no ambiente isolado.

## 5. Arquivos previstos
- `src/lib/gmos/planning-cycles.ts` (novo): listar ciclos, escolher o padrão.
- `src/lib/gmos/guided-journey.ts` (novo): calcular os 6 passos a partir dos dados já existentes.
- `src/components/gmos/cycle-selector.tsx` e `guided-journey-bar.tsx` (novos).
- `src/routes/_authenticated/planejamento.tsx`: seletor, faixa de jornada e parâmetro `ciclo`.
- `src/routes/_authenticated/index.tsx`: cartão de progresso por filial.
- Testes novos ao lado de cada arquivo de regras.

## 6. Critérios de aceite
1. Com 2+ ciclos, o usuário escolhe qualquer um e todas as abas passam a mostrar os dados desse ciclo.
2. Recarregar a página mantém o ciclo escolhido.
3. Sem ciclo, aparece só a criação de ciclo.
4. Ciclo aprovado abre só para leitura.
5. A jornada mostra 6 passos com situação correta, percentual e próximo passo.
6. Cada "Continuar" abre a tela existente, sem formulários duplicados.
7. O progresso concorda com a completude oficial do banco.
8. Usuário sem permissão de edição vê a jornada só para leitura.
9. Um usuário não vê ciclos nem progresso de filiais fora do seu acesso.
10. Os 282 testes atuais continuam passando, com testes novos para seleção de ciclo e cálculo dos passos.
11. Nenhuma migration, nenhum dado real alterado, nada publicado.

## 7. Testes
- Automáticos: escolha do ciclo padrão, ciclo inválido no endereço, cálculo de cada passo, percentual, próximo passo, somente leitura.
- Funcionais (no ambiente isolado): troca de ciclo, recarga, jornada completa com dados fictícios, ciclo aprovado, usuário de outra empresa.

## 8. Sequência
1. Ambiente isolado criado e Etapa 1 validada (8 testes, relatório).
2. Etapa B implementada em rascunho, sobre a Etapa 1.
3. Testes funcionais da Etapa B no ambiente isolado.
4. Sua aprovação e, então, aplicação controlada.
