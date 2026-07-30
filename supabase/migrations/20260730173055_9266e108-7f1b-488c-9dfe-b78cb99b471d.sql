-- FASE 3 (F3) — criação aditiva e idempotente das filiais ausentes.
DO $$
DECLARE
  r RECORD;
  v_org uuid;
  v_company uuid;
  v_bu uuid;
  v_scope uuid;
  v_parent uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('meu-querido',      'filial-meu-querido',      'Filial Meu Querido'),
      ('xrm-pre-moldados', 'filial-xrm-pre-moldados', 'Filial XRM Pré-Moldados')
    ) AS t(company_slug, bu_slug, bu_name)
  LOOP
    SELECT c.id, c.organization_id INTO v_company, v_org
      FROM public.companies c
     WHERE c.slug = r.company_slug::public.citext
     LIMIT 1;

    IF v_company IS NULL THEN
      RAISE EXCEPTION 'empresa % nao encontrada; migracao abortada', r.company_slug;
    END IF;

    SELECT bu.id INTO v_bu
      FROM public.business_units bu
     WHERE bu.company_id = v_company
       AND bu.slug = r.bu_slug::public.citext
     LIMIT 1;

    IF v_bu IS NULL THEN
      INSERT INTO public.business_units (organization_id, company_id, slug, name, status)
      VALUES (v_org, v_company, r.bu_slug::public.citext, r.bu_name, 'active')
      RETURNING id INTO v_bu;

      INSERT INTO public.audit_events
        (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
      VALUES
        (v_org, NULL, 'f3.business_units.create', 'public.business_units', v_bu, 'create', 'migration',
         jsonb_build_object('slug', r.bu_slug, 'name', r.bu_name, 'company_slug', r.company_slug));
    END IF;

    -- rede de seguranca: garante o scope business_unit mesmo se o trigger de sync estiver ausente
    SELECT s.id INTO v_scope
      FROM public.scopes s
     WHERE s.target_table = 'public.business_units' AND s.target_id = v_bu
     LIMIT 1;

    IF v_scope IS NULL THEN
      SELECT s.id INTO v_parent
        FROM public.scopes s
       WHERE s.target_table = 'public.companies' AND s.target_id = v_company
       LIMIT 1;

      IF v_parent IS NULL THEN
        RAISE EXCEPTION 'escopo da empresa % nao encontrado; migracao abortada', r.company_slug;
      END IF;

      INSERT INTO public.scopes
        (organization_id, scope_type, parent_scope_id, target_table, target_id, label, status)
      VALUES
        (v_org, 'business_unit', v_parent, 'public.business_units', v_bu, r.bu_name, 'active')
      RETURNING id INTO v_scope;

      INSERT INTO public.audit_events
        (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
      VALUES
        (v_org, NULL, 'f3.scopes.create', 'public.scopes', v_scope, 'create', 'migration',
         jsonb_build_object('scope_type', 'business_unit', 'target_id', v_bu));
    END IF;

    v_bu := NULL; v_scope := NULL; v_parent := NULL; v_company := NULL; v_org := NULL;
  END LOOP;
END $$;
