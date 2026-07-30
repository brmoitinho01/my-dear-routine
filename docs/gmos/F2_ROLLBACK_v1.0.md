# GMOS — F2 ROLLBACK v1.0

Rollback controlado da Fase 2 (planejamento estratégico, KPIs, planos de ação e rotinas).
Escopo restrito: remove **somente** objetos criados na F2. Não toca em M0 (fundação/RBAC),
M1/F1 (organizações, empresas, unidades, departamentos, escopos) nem em `auth`.

> Este documento é documental. **Não executar** sem autorização humana explícita.

## 1. Objetos F2 cobertos

Tabelas (9):
`strategic_plans`, `strategic_pillars`, `strategic_objectives`, `strategic_risks`,
`kpis`, `kpi_measurements`, `action_plans`, `routine_templates`, `routine_executions`.

Funções (3): `f2_audit()`, `f2_bu_scope_id(uuid)`, `f2_generate_routine_executions(uuid, date)`.

Permissões (6): `strategy.read`, `strategy.manage`, `action.read`, `action.manage`,
`routine.read`, `routine.manage` (+ vínculos em `role_permissions`).

Triggers: `f2_audit` e `f1_touch_updated_at` aplicados às 9 tabelas acima.

## 2. Pré-condições obrigatórias

O rollback só é permitido se **todas** as verificações abaixo retornarem `0`.

```sql
-- 2.1 Nenhum dado nas tabelas F2
SELECT c.relname, (xpath('/row/c/text()',
        query_to_xml(format('SELECT count(*) AS c FROM public.%I', c.relname), false, true, '')))[1]::text::bigint AS linhas
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace
   AND c.relkind = 'r'
   AND c.relname IN ('strategic_plans','strategic_pillars','strategic_objectives','strategic_risks',
                     'kpis','kpi_measurements','action_plans','routine_templates','routine_executions');

-- 2.2 Nenhuma dependência externa apontando para tabelas F2
SELECT conrelid::regclass AS origem, conname, confrelid::regclass AS destino
  FROM pg_constraint
 WHERE contype = 'f'
   AND confrelid::regclass::text LIKE 'public.%'
   AND confrelid IN ('public.strategic_plans'::regclass,'public.strategic_pillars'::regclass,
                     'public.strategic_objectives'::regclass,'public.strategic_risks'::regclass,
                     'public.kpis'::regclass,'public.kpi_measurements'::regclass,
                     'public.action_plans'::regclass,'public.routine_templates'::regclass,
                     'public.routine_executions'::regclass)
   AND conrelid NOT IN ('public.strategic_plans'::regclass,'public.strategic_pillars'::regclass,
                     'public.strategic_objectives'::regclass,'public.strategic_risks'::regclass,
                     'public.kpis'::regclass,'public.kpi_measurements'::regclass,
                     'public.action_plans'::regclass,'public.routine_templates'::regclass,
                     'public.routine_executions'::regclass);

-- 2.3 Nenhuma view/função externa dependente
SELECT DISTINCT dependent_ns.nspname, dependent_view.relname
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class dependent_view ON dependent_view.oid = r.ev_class
  JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
  JOIN pg_class source ON source.oid = d.refobjid
 WHERE source.relname IN ('strategic_plans','strategic_pillars','strategic_objectives','strategic_risks',
                          'kpis','kpi_measurements','action_plans','routine_templates','routine_executions')
   AND dependent_view.relname <> source.relname;
```

Além disso:
- Backup lógico do schema `public` realizado e verificado.
- Frontend F2 (`/planejamento`, `/planos-de-acao`, `/rotinas`) já removido ou desativado.
- Janela de manutenção aprovada; nenhum job/rotina em execução.

## 3. Procedimento de rollback (somente se a seção 2 passar)

Executar como migração versionada, em transação única, **sem `CASCADE`** — a ausência de
`CASCADE` é a rede de segurança: se existir qualquer dependência não mapeada, a transação falha.

```sql
BEGIN;

-- 3.1 Triggers
DROP TRIGGER IF EXISTS f2_audit_strategic_plans      ON public.strategic_plans;
DROP TRIGGER IF EXISTS f2_audit_strategic_pillars    ON public.strategic_pillars;
DROP TRIGGER IF EXISTS f2_audit_strategic_objectives ON public.strategic_objectives;
DROP TRIGGER IF EXISTS f2_audit_strategic_risks      ON public.strategic_risks;
DROP TRIGGER IF EXISTS f2_audit_kpis                 ON public.kpis;
DROP TRIGGER IF EXISTS f2_audit_kpi_measurements     ON public.kpi_measurements;
DROP TRIGGER IF EXISTS f2_audit_action_plans         ON public.action_plans;
DROP TRIGGER IF EXISTS f2_audit_routine_templates    ON public.routine_templates;
DROP TRIGGER IF EXISTS f2_audit_routine_executions   ON public.routine_executions;

-- 3.2 Tabelas (ordem inversa das dependências internas F2)
DROP TABLE IF EXISTS public.routine_executions;
DROP TABLE IF EXISTS public.routine_templates;
DROP TABLE IF EXISTS public.action_plans;
DROP TABLE IF EXISTS public.kpi_measurements;
DROP TABLE IF EXISTS public.kpis;
DROP TABLE IF EXISTS public.strategic_risks;
DROP TABLE IF EXISTS public.strategic_objectives;
DROP TABLE IF EXISTS public.strategic_pillars;
DROP TABLE IF EXISTS public.strategic_plans;

-- 3.3 Funções F2
DROP FUNCTION IF EXISTS public.f2_generate_routine_executions(uuid, date);
DROP FUNCTION IF EXISTS public.f2_bu_scope_id(uuid);
DROP FUNCTION IF EXISTS public.f2_audit();

-- 3.4 Permissões F2 (vínculos primeiro)
DELETE FROM public.role_permissions rp
 USING public.permissions p
 WHERE rp.permission_id = p.id
   AND p.code IN ('strategy.read','strategy.manage','action.read','action.manage',
                  'routine.read','routine.manage');

DELETE FROM public.permissions
 WHERE code IN ('strategy.read','strategy.manage','action.read','action.manage',
                'routine.read','routine.manage');

COMMIT;
```

`public.audit_events` é imutável por design: os eventos `f2.*` **permanecem** e não devem ser apagados.

## 4. Validação pós-rollback

```sql
-- 0 tabelas F2
SELECT count(*) FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('strategic_plans','strategic_pillars','strategic_objectives','strategic_risks',
                      'kpis','kpi_measurements','action_plans','routine_templates','routine_executions');

-- 0 funções F2
SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'f2\_%';

-- 0 permissões F2
SELECT count(*) FROM public.permissions
 WHERE code IN ('strategy.read','strategy.manage','action.read','action.manage','routine.read','routine.manage');

-- M0/F1 intactos: 12 tabelas remanescentes esperadas
SELECT count(*) FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('organizations','users','scopes','scope_types','roles','permissions',
                      'role_permissions','user_role_assignments','audit_events',
                      'companies','business_units','departments');
```

## 5. Reversão do hardening de privilégios (opcional)

O hotfix de privilégios é aditivo e não requer rollback próprio: ao remover as tabelas,
os grants desaparecem junto. Se apenas o hardening precisar ser revertido (mantendo F2),
reaplicar os grants originais é desaconselhado — `anon` e `DELETE` não são necessários ao produto.
