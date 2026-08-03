# F8.5-A — Fundação do Organograma Funcional (v1.0)

## Escopo
Fundação segura de dados, segurança e regras puras para validar funções e
responsabilidades reais. **Nenhuma pessoa, cargo, chefia, departamento ou
atribuição foi criada.** As três tabelas permanecem com zero registros.

## Quatro conceitos distintos
| Conceito | Onde vive | Significado |
| --- | --- | --- |
| Pessoa | `org_people` | Indivíduo real do Grupo. Pode existir sem acesso ao sistema (`user_id` nulo). |
| Posição organizacional | `organizational_positions` | Cargo/função com propósito, responsabilidades, autoridade de decisão, entregas e headcount esperado. Existe mesmo vaga. |
| Papel de acesso | `roles` / `user_role_assignments` (F0/F7) | Autorização técnica no escopo. Não define cargo nem chefia. |
| Responsabilidade operacional | `owner_user_id` em `strategic_objectives`, `kpis`, `action_plans`, `routine_templates` | O que a pessoa efetivamente responde no GMOS. Só é inferida quando existe `user_id`. |

## Banco (migration `20260803194524_d7f6308d-5406-49d6-8e2e-cae0d16df7d0.sql`)
- `org_people`: `home_scope_id`, `user_id` nullable com unique parcial por organização, `status active|inactive`, auditoria, unique `(id, organization_id)`.
- `organizational_positions`: `scope_id`, `parent_position_id` com FK composta na mesma organização, textos de definição, `expected_headcount > 0`, `sort_order`, auditoria, unique `(id, organization_id)`.
- `position_assignments`: `assignment_type primary|acting|support`, `start_date`/`end_date` com `end_date >= start_date`, `status active|ended`, FKs compostas, auditoria.
- Guards `SECURITY DEFINER` com `search_path` vazio: `f85_position_cycle_guard` (auto-chefia, ciclos e escopo da chefia ancestral ou igual) e `f85_headcount_guard` (uma primary ativa por pessoa; primaries ativas ≤ `expected_headcount`; `acting`/`support` não consomem headcount).
- Autorização por `f85_can` sobre `structure.read` (SELECT) e `structure.manage` (INSERT/UPDATE), respeitando a herança real de `scopes`. Sem permissão ou papel novo, sem policy ampla por `authenticated`, sem DELETE, RLS ativa nas três tabelas, `PUBLIC` revogado nas funções.
- Triggers de `updated_at` e auditoria no padrão vigente.

## Biblioteca `src/lib/gmos/org-chart.ts`
Tipos, leituras e escritas sob RLS de pessoas, posições e atribuições; carga das
responsabilidades reais por `owner_user_id`. Funções puras: `buildOrgTree`
(múltiplas raízes, filhos por `sortOrder` e depois `title`),
`positionDefinitionCompleteness` (0–100 por propósito, responsabilidades,
autoridade e entregas), `validateOrgChart` (códigos e mensagens estáveis em
pt-BR), `responsibilitySummary` (zero e "sem vínculo" quando `userId` é nulo),
`filterOrgChart` / `matchesFilters` (busca e situação ocupado/vago/incompleto) e
`orgChartActions(canRead, canManage)`. Ausência de itens GMOS não é erro do cargo.

## Validações executadas
- `org_people`, `organizational_positions`, `position_assignments`: 0 registros.
- RLS ativa nas três tabelas; 9 policies (SELECT/INSERT/UPDATE), nenhuma ampla, nenhum DELETE.
- Guards presentes e `SECURITY DEFINER`: ciclo de chefia, segunda primary ativa e headcount excedido são rejeitados no banco.
- Contagens preservadas: 1 plano, 4 pilares, 4 objetivos, 9 KPIs, 54 medições, 6 ações, 5 templates, 16 execuções, 4 riscos.
- Prettier nos arquivos tocados, `tsgo --noEmit`, `vitest run` (112 testes) e `bun run build`.

## Pendências reais
Rejeições dos guards não foram reexecutadas com sessão de usuário real nesta
sessão (sem login ativo no preview); a verificação foi estrutural no banco.
