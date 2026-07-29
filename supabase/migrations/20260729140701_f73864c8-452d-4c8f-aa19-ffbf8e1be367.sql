
DO $$
DECLARE
  v_auth_uid uuid := '1d5bc9bc-7327-4724-bab0-441baefc8a6a';
  v_org uuid := '876dc106-040d-47b2-a9bc-f8adf8c48a85';
  v_scope uuid := 'c4632b01-6b6d-4dc6-bd2e-a18467bc5364';
  v_role uuid := '60437358-2581-4ef5-a804-3d25442c63c9';
  v_user uuid;
  v_assign uuid;
  v_actor uuid;
BEGIN
  SELECT id INTO v_actor FROM public.users
   WHERE auth_user_id = 'd70f1845-d2c2-42be-89a1-88e12efe81bb' LIMIT 1;

  UPDATE public.users
     SET organization_id = v_org,
         status = 'active',
         updated_at = now()
   WHERE auth_user_id = v_auth_uid
  RETURNING id INTO v_user;

  SELECT id INTO v_assign
    FROM public.user_role_assignments
   WHERE user_id = v_user AND role_id = v_role AND scope_id = v_scope
   LIMIT 1;

  IF v_assign IS NULL THEN
    INSERT INTO public.user_role_assignments
      (user_id, role_id, scope_id, organization_id, status, effective_from, justification, assigned_by)
    VALUES
      (v_user, v_role, v_scope, v_org, 'active', now(),
       'Provisionamento manual inicial via console operacional', v_actor)
    RETURNING id INTO v_assign;
  ELSE
    UPDATE public.user_role_assignments
       SET status = 'active', effective_to = NULL, updated_at = now()
     WHERE id = v_assign;
  END IF;

  INSERT INTO public.audit_events
    (organization_id, actor_user_id, event_type, entity_type, entity_id, action, source, metadata)
  VALUES
    (v_org, NULL, 'user.activated', 'public.users', v_user, 'update', 'migration',
     jsonb_build_object('auth_user_id', v_auth_uid, 'email', 'joaovitor20062006@gmail.com')),
    (v_org, NULL, 'role.assigned', 'public.user_role_assignments', v_assign, 'grant', 'migration',
     jsonb_build_object('role_code', 'group_admin', 'scope_type', 'organization'));
END $$;
