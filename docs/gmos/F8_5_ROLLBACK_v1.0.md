# F8.5 — Rollback (v1.0)

A F8.5 é puramente aditiva: nenhuma tabela, coluna, policy ou função anterior foi
alterada ou removida. O rollback não afeta F1–F8, RBAC, RLS, planejamento, painéis,
ações ou rotinas.

## Frontend

1. Remover a rota `src/routes/_authenticated/organograma.tsx`.
2. Remover `src/lib/gmos/org-chart.ts` e `src/lib/gmos/org-chart.test.ts`.
3. Em `src/lib/gmos/navigation.ts`: remover a chave `organograma` do tipo `NavKey` e o item
   correspondente de `NAV_ITEMS`.
4. Em `src/components/gmos/app-shell.tsx`: remover a entrada `organograma` de `NAV_TARGET`.
5. Em `src/routes/_authenticated/estrutura.tsx`: remover o botão "Abrir organograma funcional"
   (e o import de `Button`/`Link` se ficarem sem uso).

## Banco (executar em ordem, tudo idempotente)

```sql
BEGIN;

DROP TABLE IF EXISTS public.position_assignments;
DROP TABLE IF EXISTS public.organizational_positions;
DROP TABLE IF EXISTS public.org_people;

DROP FUNCTION IF EXISTS public.f85_headcount_guard();
DROP FUNCTION IF EXISTS public.f85_position_cycle_guard();
DROP FUNCTION IF EXISTS public.f85_can(citext, uuid);

-- Opcional: a permissão structure.manage pode permanecer, é inofensiva.
-- Para reverter também o vínculo de papéis:
-- DELETE FROM public.role_permissions rp
--  USING public.permissions p
--  WHERE rp.permission_id = p.id AND p.code = 'structure.manage';
-- DELETE FROM public.permissions WHERE code = 'structure.manage';

COMMIT;
```

## Observações

- Não há dado de negócio a preservar: as tabelas F8.5 foram criadas vazias e só recebem
  registros por ação explícita do gestor.
- Eventos de auditoria já gravados em `audit_events` são imutáveis e permanecem.
