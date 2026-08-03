# F7-E — Validação e correções

Base: HEAD `48e675b9e289d3742a622801e2a2b03cf1fdbc21`.
Escopo: somente frontend, funções puras, testes e documentação.
**Nenhuma migração executada. Nenhum usuário, papel, atribuição ou dado
operacional alterado. Nada publicado.**

## Achados e correções

| # | Achado | Correção |
|---|--------|----------|
| 1 | `upcoming` incluía qualquer prazo futuro e itens sem prazo; "concluídas recentemente" incluía conclusões antigas; a data base vinha implicitamente de `new Date()` | `bucketByDue` agora recebe a data base, separa `late/today/upcoming/later/doneRecent/doneOlder` e usa `completed_at` (rotina) / `updated_at` (ação) com `due_date` como fallback |
| 2 | `pendingMeasurements` usava `status !== 'validated'`, contando `rejected` como pendência | filtro passa a ser `status === 'pending'`, conforme o enum real `('pending','validated','rejected')` |
| 3 | `/rotinas` decidia a UI por `w.canRoutine`, e qualquer perfil com escrita podia operar execução de terceiros | UI decide por `can('routine.manage' \| 'routine.execute_own', scopeId)`; operação de execução passa por `canOperateExecution` |
| 4 | Owner do modelo substituía o owner da execução | `effectiveOwnerId`: herança só quando `routine_executions.owner_user_id` é nulo (legado), documentada e testada |
| 5 | Home tratava todos os perfis igual | bloco de destaque por perfil com contagens reais + CTAs secundários, sem redirecionamento automático |
| 6 | Ordem do menu era só a ordem base | `orderNavForRole` promove o painel do papel principal, sem esconder Método/Apresentação |

## Consultas e tipos ajustados

- `routine_executions`: `completed_at` já era selecionado; agora é usado na
  classificação temporal.
- `action_plans`: `updated_at` incluído na consulta pessoal e no tipo `MyAction`.

## Testes (46 no total, todos passando)

- Janelas temporais com data base fixa `2026-02-01`: amanhã e +7 em `upcoming`;
  +8 e sem prazo em `later`; conclusão há 14 dias em `doneRecent`, há 15 em
  `doneOlder`; conclusão sem referência temporal nunca é recente.
- `onlyMine`: item sem responsável nunca pertence ao usuário.
- `pendingMeasurements`: apenas `pending`.
- `canOperateExecution`: responsável com `execute_own` (true), responsável sem
  permissão (false), não responsável com `manage` (true), não responsável sem
  `manage` (false), execução sem responsável (exige `manage`), fallback legado.
- Ordem de menu dos quatro perfis e destaque da home por perfil.

## Segurança verificada

- Nenhuma autorização por e-mail, papel fixo ou flag de cliente.
- Nenhuma chave de serviço e nenhum caminho que ignore RLS.
- Botões apenas refletem `has_permission`/RLS; a recusa final é do banco.

## Pendências explícitas

a) atribuir responsáveis reais às ações e rotinas;
b) criar usuários reais `manager` e `collaborator` e testar sessões isoladas;
c) upload real de evidências (hoje só texto/URL);
d) áreas/departamentos e escopos reais por departamento;
e) concluir a administração transacional de papéis em `/acessos`
   (atribuir/revogar com justificativa já existem; falta revisão periódica e
   trilha de revisão de acessos na interface).
