# F8-A — Rollback (v1.0)

Reversível e sem impacto em F1–F7. Executar na ordem abaixo e preferir sempre a
reversão parcial (apenas comportamento) antes da estrutural.

## 1. Reversão de comportamento (recomendada primeiro)

```sql
DROP FUNCTION IF EXISTS public.f8_activate_plan(uuid);
DROP FUNCTION IF EXISTS public.f8_approve_plan(uuid, text);
DROP FUNCTION IF EXISTS public.f8_submit_plan_for_review(uuid);
DROP FUNCTION IF EXISTS public.f8_plan_completeness(uuid);
```

Sem as RPCs o fluxo perde transições e completude, mas nenhum dado é perdido.

## 2. Reversão dos guards de transição

```sql
DROP TRIGGER IF EXISTS f8_plan_review_guard ON public.strategic_plans;
DROP TRIGGER IF EXISTS f8_diagnostic_review_guard ON public.plan_diagnostics;
DROP FUNCTION IF EXISTS public.f8_plan_review_guard();
DROP FUNCTION IF EXISTS public.f8_diagnostic_review_guard();
```

## 3. Reversão da permissão de aprovação

```sql
DELETE FROM public.role_permissions rp
 USING public.permissions p
 WHERE rp.permission_id = p.id AND p.code = 'strategy.approve';

DELETE FROM public.permissions WHERE code = 'strategy.approve';
```

## 4. Reversão do diagnóstico

Exportar antes: `SELECT * FROM public.plan_diagnostics;`

```sql
DROP TABLE IF EXISTS public.plan_diagnostics;
```

## 5. Reversão da identidade estratégica

Exportar antes:

```sql
SELECT id, mission, vision, values_text, strategic_north, version, review_status,
       submitted_at, approved_at, approval_notes
  FROM public.strategic_plans;
```

```sql
ALTER TABLE public.strategic_plans
  DROP COLUMN IF EXISTS approval_notes,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS submitted_by,
  DROP COLUMN IF EXISTS submitted_at,
  DROP COLUMN IF EXISTS review_status,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS strategic_north,
  DROP COLUMN IF EXISTS values_text,
  DROP COLUMN IF EXISTS vision,
  DROP COLUMN IF EXISTS mission;
```

## 6. Frontend

Remover `src/lib/gmos/strategy.ts` e `src/lib/gmos/strategy.test.ts`.
Nenhum módulo de F1–F7 (RBAC, RLS, painéis, planos de ação, rotinas) depende
deles. Eventos já gravados em `audit_events` são imutáveis e permanecem como
histórico.
