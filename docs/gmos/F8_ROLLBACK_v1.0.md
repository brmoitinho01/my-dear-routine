# F8 — Rollback (v1.0)

O rollback é reversível e não toca dados de F1 a F7. Executar na ordem abaixo.
Preferir sempre a reversão parcial (apenas RPCs) antes da reversão estrutural.

## 1. Reversão de comportamento (recomendada primeiro)

```sql
DROP FUNCTION IF EXISTS public.f8_activate_plan(uuid);
DROP FUNCTION IF EXISTS public.f8_approve_plan(uuid, text);
DROP FUNCTION IF EXISTS public.f8_submit_plan_for_review(uuid);
DROP FUNCTION IF EXISTS public.f8_plan_completeness(uuid);
```

Sem as RPCs, o assistente perde as transições e a completude, mas nenhum dado é perdido:
os campos continuam legíveis e editáveis por `strategy.manage`.

## 2. Reversão da permissão de aprovação

```sql
DELETE FROM public.role_permissions rp
 USING public.permissions p
 WHERE rp.permission_id = p.id AND p.code = 'strategy.approve';

DELETE FROM public.permissions WHERE code = 'strategy.approve';
```

## 3. Reversão do diagnóstico

```sql
DROP TABLE IF EXISTS public.plan_diagnostics;
```

Atenção: isso descarta os diagnósticos registrados. Exportar antes:

```sql
SELECT * FROM public.plan_diagnostics;
```

## 4. Reversão da identidade estratégica

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

Exportar antes:

```sql
SELECT id, mission, vision, values_text, strategic_north, version, review_status,
       submitted_at, approved_at, approval_notes
  FROM public.strategic_plans;
```

## 5. Frontend

- Remover `src/lib/gmos/strategy.ts`, `src/lib/gmos/strategy.test.ts` e
  `src/components/gmos/strategy-assistant.tsx`.
- Reverter `src/routes/_authenticated/planejamento.tsx` para as abas
  Objetivos / KPIs / Medições / Riscos.

Nada em F1–F7 (RBAC, RLS, painéis, planos de ação, rotinas) depende de F8.
Os eventos já gravados em `audit_events` são imutáveis e permanecem como histórico.
