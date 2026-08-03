# F8.5-A — Rollback (v1.0)

Reversão aditiva e idempotente. Não toca F1–F8, planejamento, ações nem rotinas.

## 1. Frontend
- Remover de `src/lib/gmos/org-chart.ts` as funções `filterOrgChart` e
  `orgChartActions` e os blocos correspondentes em `src/lib/gmos/org-chart.test.ts`.
- Para reverter a fundação inteira, remover `src/lib/gmos/org-chart.ts`,
  `src/lib/gmos/org-chart.test.ts` e as referências ao organograma na navegação.

## 2. Banco (ordem obrigatória)
```sql
DROP TRIGGER IF EXISTS trg_f85_headcount_guard ON public.position_assignments;
DROP TRIGGER IF EXISTS trg_f85_position_cycle_guard ON public.organizational_positions;
DROP TABLE IF EXISTS public.position_assignments;
DROP TABLE IF EXISTS public.organizational_positions;
DROP TABLE IF EXISTS public.org_people;
DROP FUNCTION IF EXISTS public.f85_headcount_guard();
DROP FUNCTION IF EXISTS public.f85_position_cycle_guard();
DROP FUNCTION IF EXISTS public.f85_can(uuid, citext);
```
Nada mais é removido: `structure.read` e `structure.manage` são permissões
pré-existentes de F1 e devem ser preservadas.

## 3. Verificação pós-rollback
- As três tabelas não existem mais e nenhuma outra tabela foi afetada.
- Contagens intactas: 1 plano, 4 pilares, 4 objetivos, 9 KPIs, 54 medições,
  6 ações, 5 templates, 16 execuções, 4 riscos.
- `bunx tsgo --noEmit`, `bunx vitest run` e `bun run build` verdes.
