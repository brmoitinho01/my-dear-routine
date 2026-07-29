SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '15s';

DO $abort$
DECLARE
  v_objs   bigint;
  v_resp   bigint;
  v_nc     bigint;
  v_ap     bigint;
  v_audit  bigint;
BEGIN
  SELECT count(*) INTO v_objs FROM storage.objects WHERE bucket_id = 'checklist-evidence';
  IF v_objs <> 0 THEN
    RAISE EXCEPTION 'ABORT SEC-00: bucket checklist-evidence contem % objeto(s); esperado 0.', v_objs;
  END IF;

  SELECT count(*) INTO v_resp  FROM public.checklist_item_responses;
  SELECT count(*) INTO v_nc    FROM public.non_conformities;
  SELECT count(*) INTO v_ap    FROM public.action_plans;
  SELECT count(*) INTO v_audit FROM public.audit_log;
  IF (v_resp + v_nc + v_ap + v_audit) <> 0 THEN
    RAISE EXCEPTION 'ABORT SEC-00: dados operacionais presentes (resp=%, nc=%, ap=%, audit=%); esperado 0.',
      v_resp, v_nc, v_ap, v_audit;
  END IF;

  IF to_regclass('public.identity_bootstrap') IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT SEC-00: public.identity_bootstrap existe; v1.1 nao utiliza tabela temporaria de identidade.';
  END IF;
END
$abort$;

DROP VIEW IF EXISTS public.v_execution_ico;

DROP TRIGGER IF EXISTS trg_resp_to_nc            ON public.checklist_item_responses;
DROP TRIGGER IF EXISTS trg_resp_updated          ON public.checklist_item_responses;
DROP TRIGGER IF EXISTS trg_exec_updated          ON public.checklist_executions;
DROP TRIGGER IF EXISTS trg_checklists_updated    ON public.checklists;
DROP TRIGGER IF EXISTS trg_nc_updated            ON public.non_conformities;
DROP TRIGGER IF EXISTS trg_ap_updated            ON public.action_plans;
DROP TRIGGER IF EXISTS trg_users_profile_updated ON public.users_profile;
DROP TRIGGER IF EXISTS on_auth_user_created      ON auth.users;

DROP POLICY IF EXISTS ap_read  ON public.action_plans;
DROP POLICY IF EXISTS ap_write ON public.action_plans;
DROP POLICY IF EXISTS "Admins read audit"        ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;
DROP POLICY IF EXISTS exec_delete_admin ON public.checklist_executions;
DROP POLICY IF EXISTS exec_insert       ON public.checklist_executions;
DROP POLICY IF EXISTS exec_read         ON public.checklist_executions;
DROP POLICY IF EXISTS exec_update       ON public.checklist_executions;
DROP POLICY IF EXISTS resp_read  ON public.checklist_item_responses;
DROP POLICY IF EXISTS resp_write ON public.checklist_item_responses;
DROP POLICY IF EXISTS items_read  ON public.checklist_items;
DROP POLICY IF EXISTS items_write ON public.checklist_items;
DROP POLICY IF EXISTS checklists_read  ON public.checklists;
DROP POLICY IF EXISTS checklists_write ON public.checklists;
DROP POLICY IF EXISTS nc_delete_admin ON public.non_conformities;
DROP POLICY IF EXISTS nc_insert       ON public.non_conformities;
DROP POLICY IF EXISTS nc_read         ON public.non_conformities;
DROP POLICY IF EXISTS nc_update       ON public.non_conformities;
DROP POLICY IF EXISTS "Users read own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS sectors_admin_write   ON public.sectors;
DROP POLICY IF EXISTS sectors_read_all_auth ON public.sectors;
DROP POLICY IF EXISTS roles_admin_write          ON public.user_roles;
DROP POLICY IF EXISTS roles_self_or_admin_read   ON public.user_roles;
DROP POLICY IF EXISTS user_sectors_admin_write        ON public.user_sectors;
DROP POLICY IF EXISTS user_sectors_self_or_mgr_read   ON public.user_sectors;
DROP POLICY IF EXISTS profile_admin_insert ON public.users_profile;
DROP POLICY IF EXISTS profile_self_read    ON public.users_profile;
DROP POLICY IF EXISTS profile_self_update  ON public.users_profile;

DROP POLICY IF EXISTS evidence_delete_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS evidence_insert_auth         ON storage.objects;
DROP POLICY IF EXISTS evidence_read_auth           ON storage.objects;
DROP POLICY IF EXISTS evidence_update_own          ON storage.objects;

DROP FUNCTION IF EXISTS public.handle_nc_response();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.mark_overdue_executions();
DROP FUNCTION IF EXISTS public.schedule_executions_for(date);
DROP FUNCTION IF EXISTS public.user_in_sector(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_admin_or_manager(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

DROP TABLE IF EXISTS public.action_plans;
DROP TABLE IF EXISTS public.non_conformities;
DROP TABLE IF EXISTS public.checklist_item_responses;
DROP TABLE IF EXISTS public.checklist_executions;
DROP TABLE IF EXISTS public.checklist_items;
DROP TABLE IF EXISTS public.checklists;
DROP TABLE IF EXISTS public.user_sectors;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.users_profile;
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.audit_log;
DROP TABLE IF EXISTS public.sectors;

DROP TYPE IF EXISTS public.action_status;
DROP TYPE IF EXISTS public.execution_status;
DROP TYPE IF EXISTS public.frequency_kind;
DROP TYPE IF EXISTS public.moment_kind;
DROP TYPE IF EXISTS public.nc_status;
DROP TYPE IF EXISTS public.response_kind;
DROP TYPE IF EXISTS public.sector_kind;
DROP TYPE IF EXISTS public.severity_kind;
DROP TYPE IF EXISTS public.app_role;

CREATE OR REPLACE FUNCTION public.handle_new_user_noop()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $noop$
BEGIN
  RETURN NEW;
END
$noop$;

REVOKE ALL ON FUNCTION public.handle_new_user_noop() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_noop() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user_noop() FROM authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_noop();