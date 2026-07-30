# GMOS — F1 ROLLBACK v1.0 (Estrutura organizacional)

Reverte **somente** os objetos criados na Fase 1. Não toca em nenhum objeto da M0
(organizations, users, roles, permissions, role_permissions, scopes raiz,
user_role_assignments, audit_events), nem em `auth.users`.

## Pré-condições obrigatórias

Executar antes e abortar se qualquer contagem for maior que zero:

```sql
SELECT
  (SELECT count(*) FROM public.companies)      AS companies,
  (SELECT count(*) FROM public.business_units) AS business_units,
  (SELECT count(*) FROM public.departments)    AS departments,
  (SELECT count(*) FROM public.scopes
     WHERE target_table IN ('public.companies','public.business_units','public.departments')) AS f1_scopes,
  (SELECT count(*) FROM public.user_role_assignments a
     JOIN public.scopes s ON s.id = a.scope_id
    WHERE s.target_table IN ('public.companies','public.business_units','public.departments')) AS f1_assignments;
```

Se houver dados dependentes, o rollback **não** deve ser executado: arquive os
registros (`status = 'archived'`) em vez de remover objetos.

## Script de rollback

```sql
BEGIN;

-- 1. Triggers
DROP TRIGGER IF EXISTS departments_scope_sync    ON public.departments;
DROP TRIGGER IF EXISTS business_units_scope_sync ON public.business_units;
DROP TRIGGER IF EXISTS companies_scope_sync      ON public.companies;
DROP TRIGGER IF EXISTS departments_touch         ON public.departments;
DROP TRIGGER IF EXISTS business_units_touch      ON public.business_units;
DROP TRIGGER IF EXISTS companies_touch           ON public.companies;

-- 2. Tabelas (ordem de dependencia)
DROP TABLE IF EXISTS public.departments;
DROP TABLE IF EXISTS public.business_units;
DROP TABLE IF EXISTS public.companies;

-- 3. Funcoes F1
DROP FUNCTION IF EXISTS public.f1_sync_entity_scope();
DROP FUNCTION IF EXISTS public.f1_touch_updated_at();
DROP FUNCTION IF EXISTS public.f1_entity_scope_id(text, uuid);

-- 4. Permissao F1 (remove somente se nao houver escopos F1 remanescentes)
DELETE FROM public.role_permissions rp
 USING public.permissions p
 WHERE p.id = rp.permission_id AND p.code = 'structure.read'::citext;

DELETE FROM public.permissions WHERE code = 'structure.read'::citext;

-- 5. Registro de auditoria do rollback
INSERT INTO public.audit_events
  (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
SELECT o.id, NULL, 'structure.f1_rolled_back', 'public.companies', NULL, 'delete', 'migration',
       jsonb_build_object('version','F1_ROLLBACK_v1.0')
  FROM public.organizations o
 WHERE o.slug = 'grupo-moitinho'::citext;

COMMIT;
```

Os eventos de auditoria da aplicação da F1 **não** são removidos (a tabela é
imutável por design).

## Validação pós-rollback

```sql
SELECT count(*) = 0 AS tabelas_removidas
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('companies','business_units','departments');

SELECT count(*) = 9 AS m0_intacta
  FROM information_schema.tables WHERE table_schema = 'public';

SELECT count(*) = 1 AS escopo_raiz_preservado
  FROM public.scopes WHERE scope_type = 'organization';
```