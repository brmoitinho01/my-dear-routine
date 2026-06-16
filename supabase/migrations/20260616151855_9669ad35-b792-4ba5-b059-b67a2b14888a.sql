
-- 1. Frequency config on checklists
DO $$ BEGIN
  CREATE TYPE public.frequency_kind AS ENUM ('diaria','semanal','mensal','sob_demanda');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS frequency public.frequency_kind NOT NULL DEFAULT 'diaria',
  ADD COLUMN IF NOT EXISTS weekday smallint,         -- 0=domingo..6=sábado (para semanal)
  ADD COLUMN IF NOT EXISTS month_day smallint,       -- 1..31 (para mensal)
  ADD COLUMN IF NOT EXISTS due_time time;            -- horário limite do dia

-- 2. Item weight
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS weight numeric(5,2) NOT NULL DEFAULT 1;

-- 3. Extended execution status
DO $$ BEGIN
  ALTER TYPE public.execution_status ADD VALUE IF NOT EXISTS 'pendente';
EXCEPTION WHEN undefined_object THEN
  -- enum não existe ainda; recriar usando texto
  NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.execution_status ADD VALUE IF NOT EXISTS 'atrasada';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.execution_status ADD VALUE IF NOT EXISTS 'com_ressalva';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- 4. Notifications in-app
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,                          -- 'nc_aberta' | 'execucao_atrasada' | 'plano_vencendo' | etc
  title text NOT NULL,
  body text,
  link text,                                   -- rota interna p/ abrir
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at) WHERE read_at IS NULL;

-- 5. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  entity text NOT NULL,        -- 'checklist','execution','nc','plan','user','role'
  entity_id uuid,
  action text NOT NULL,        -- 'create','update','delete','finalize','assign'
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit" ON public.audit_log;
CREATE POLICY "Admins read audit" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin_or_manager(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;
CREATE POLICY "Authenticated insert audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log (entity, entity_id, created_at DESC);

-- 6. Function: schedule today's executions based on frequency
CREATE OR REPLACE FUNCTION public.schedule_executions_for(_date date)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int := 0;
  _c record;
  _dow smallint := EXTRACT(DOW FROM _date)::smallint;
  _dom smallint := EXTRACT(DAY FROM _date)::smallint;
BEGIN
  FOR _c IN
    SELECT * FROM public.checklists
    WHERE active = true AND frequency <> 'sob_demanda'
  LOOP
    IF _c.frequency = 'semanal' AND _c.weekday IS NOT NULL AND _c.weekday <> _dow THEN
      CONTINUE;
    END IF;
    IF _c.frequency = 'mensal' AND _c.month_day IS NOT NULL AND _c.month_day <> _dom THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.checklist_executions
      WHERE checklist_id = _c.id AND scheduled_date = _date
    ) THEN
      INSERT INTO public.checklist_executions (checklist_id, sector_id, scheduled_date, status)
      VALUES (_c.id, _c.sector_id, _date, 'pendente');
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END $$;

-- 7. Function: mark overdue executions
CREATE OR REPLACE FUNCTION public.mark_overdue_executions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _updated int;
BEGIN
  WITH upd AS (
    UPDATE public.checklist_executions e
    SET status = 'atrasada'
    FROM public.checklists c
    WHERE e.checklist_id = c.id
      AND e.status IN ('pendente','em_andamento')
      AND c.due_time IS NOT NULL
      AND (e.scheduled_date + c.due_time) < now()
    RETURNING 1
  )
  SELECT count(*) INTO _updated FROM upd;
  RETURN COALESCE(_updated, 0);
END $$;

-- 8. ICO view: percent conformidade ponderado por execução
CREATE OR REPLACE VIEW public.v_execution_ico AS
SELECT
  e.id AS execution_id,
  e.checklist_id,
  e.sector_id,
  e.scheduled_date,
  COALESCE(SUM(CASE WHEN r.response = 'conforme' THEN i.weight ELSE 0 END), 0) AS weight_ok,
  COALESCE(SUM(CASE WHEN r.response IN ('conforme','nao_conforme') THEN i.weight ELSE 0 END), 0) AS weight_total,
  CASE
    WHEN COALESCE(SUM(CASE WHEN r.response IN ('conforme','nao_conforme') THEN i.weight ELSE 0 END), 0) = 0 THEN NULL
    ELSE ROUND(
      100.0 * SUM(CASE WHEN r.response = 'conforme' THEN i.weight ELSE 0 END)
      / NULLIF(SUM(CASE WHEN r.response IN ('conforme','nao_conforme') THEN i.weight ELSE 0 END), 0)
    , 1)
  END AS ico_pct
FROM public.checklist_executions e
LEFT JOIN public.checklist_item_responses r ON r.execution_id = e.id
LEFT JOIN public.checklist_items i ON i.id = r.item_id
GROUP BY e.id;

GRANT SELECT ON public.v_execution_ico TO authenticated, service_role;
