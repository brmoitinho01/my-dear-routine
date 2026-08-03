# F9 — Rollback (v1.0)

Rollback lógico, sem exclusão de dados do planejamento existente.

## 1. Frontend
Reverter os arquivos:
- `src/components/gmos/initiatives-section.tsx` (remover)
- `src/lib/gmos/initiatives.ts` e `src/lib/gmos/initiatives.test.ts` (remover)
- `src/routes/_authenticated/planejamento.tsx` (remover import, seção e indicadores F9)
- `src/routes/_authenticated/planos-de-acao.tsx` (remover origem, filtro e trilha)
- `src/lib/gmos/f2.ts` (remover `initiativeId`, `originType`, `originNote` do select e do tipo)

## 2. Banco — desativar sem destruir (preferencial)
```sql
REVOKE INSERT, UPDATE ON TABLE public.strategic_initiatives FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.f9_derive_action_plan(uuid, date) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.f9_submit_initiative_for_review(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.f9_approve_initiative(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.f9_activate_initiative(uuid) FROM authenticated;
```
Os planos derivados permanecem válidos; apenas novas iniciativas/derivações ficam bloqueadas.

## 3. Banco — reversão estrutural (somente se nenhuma iniciativa foi usada)
```sql
-- confirmar antes: deve retornar 0
SELECT count(*) FROM public.strategic_initiatives;

ALTER TABLE public.action_plans DROP COLUMN IF EXISTS initiative_id;
ALTER TABLE public.action_plans DROP COLUMN IF EXISTS origin_type;
ALTER TABLE public.action_plans DROP COLUMN IF EXISTS origin_note;
DROP FUNCTION IF EXISTS public.f9_derive_action_plan(uuid, date);
DROP FUNCTION IF EXISTS public.f9_activate_initiative(uuid);
DROP FUNCTION IF EXISTS public.f9_approve_initiative(uuid, text);
DROP FUNCTION IF EXISTS public.f9_submit_initiative_for_review(uuid);
DROP FUNCTION IF EXISTS public.f9_initiative_readiness(uuid);
DROP TABLE IF EXISTS public.strategic_initiatives;
```
Nunca executar o passo 3 se existirem iniciativas registradas ou planos com `initiative_id`.
