
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin','gerente','lider_setor','operador');
CREATE TYPE public.sector_kind AS ENUM ('salao','cozinha','bar');
CREATE TYPE public.moment_kind AS ENUM ('abertura','fechamento');
CREATE TYPE public.response_kind AS ENUM ('conforme','nao_conforme','na');
CREATE TYPE public.severity_kind AS ENUM ('baixa','media','alta','critica');
CREATE TYPE public.nc_status AS ENUM ('aberta','em_tratamento','resolvida','cancelada');
CREATE TYPE public.action_status AS ENUM ('pendente','em_andamento','concluida','atrasada');
CREATE TYPE public.execution_status AS ENUM ('em_andamento','finalizada');

-- =========================
-- updated_at helper
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================
-- TABLES
-- =========================

-- sectors
CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.sector_kind NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- users_profile
CREATE TABLE public.users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  primary_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_profile TO authenticated;
GRANT ALL ON public.users_profile TO service_role;
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_users_profile_updated BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- user_sectors (many-to-many)
CREATE TABLE public.user_sectors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sectors TO authenticated;
GRANT ALL ON public.user_sectors TO service_role;
ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

-- checklists (templates)
CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  moment public.moment_kind NOT NULL,
  title text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists TO authenticated;
GRANT ALL ON public.checklists TO service_role;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_checklists_updated BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- checklist_items
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  question text NOT NULL,
  help_text text,
  is_critical boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- checklist_executions
CREATE TABLE public.checklist_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  status public.execution_status NOT NULL DEFAULT 'em_andamento',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, scheduled_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_executions TO authenticated;
GRANT ALL ON public.checklist_executions TO service_role;
ALTER TABLE public.checklist_executions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_exec_updated BEFORE UPDATE ON public.checklist_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- checklist_item_responses
CREATE TABLE public.checklist_item_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.checklist_executions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  response public.response_kind NOT NULL,
  observation text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execution_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_item_responses TO authenticated;
GRANT ALL ON public.checklist_item_responses TO service_role;
ALTER TABLE public.checklist_item_responses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_resp_updated BEFORE UPDATE ON public.checklist_item_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- non_conformities
CREATE TABLE public.non_conformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES public.checklist_item_responses(id) ON DELETE SET NULL,
  execution_id uuid REFERENCES public.checklist_executions(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.checklist_items(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  severity public.severity_kind NOT NULL DEFAULT 'media',
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date date,
  status public.nc_status NOT NULL DEFAULT 'aberta',
  title text NOT NULL,
  description text,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.non_conformities TO authenticated;
GRANT ALL ON public.non_conformities TO service_role;
ALTER TABLE public.non_conformities ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_nc_updated BEFORE UPDATE ON public.non_conformities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- action_plans
CREATE TABLE public.action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  non_conformity_id uuid NOT NULL REFERENCES public.non_conformities(id) ON DELETE CASCADE,
  what text NOT NULL,
  why text,
  who uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  when_due date,
  how text,
  status public.action_status NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ap_updated BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SECURITY DEFINER HELPERS
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','gerente')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_in_sector(_user_id uuid, _sector_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sectors WHERE user_id = _user_id AND sector_id = _sector_id
  ) OR EXISTS (
    SELECT 1 FROM public.users_profile WHERE id = _user_id AND primary_sector_id = _sector_id
  )
$$;

-- =========================
-- RLS POLICIES
-- =========================

-- sectors: everyone authenticated can read; only admin can write
CREATE POLICY "sectors_read_all_auth" ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors_admin_write" ON public.sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- users_profile
CREATE POLICY "profile_self_read" ON public.users_profile FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "profile_self_update" ON public.users_profile FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profile_admin_insert" ON public.users_profile FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- user_roles: read own + admin manages all
CREATE POLICY "roles_self_or_admin_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_sectors
CREATE POLICY "user_sectors_self_or_mgr_read" ON public.user_sectors FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE POLICY "user_sectors_admin_write" ON public.user_sectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- checklists: read by anyone in sector or admin/manager; write by admin/manager
CREATE POLICY "checklists_read" ON public.checklists FOR SELECT TO authenticated
  USING (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), sector_id));
CREATE POLICY "checklists_write" ON public.checklists FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- checklist_items: tie to checklist sector
CREATE POLICY "items_read" ON public.checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.checklists c WHERE c.id = checklist_id
      AND (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), c.sector_id)))
  );
CREATE POLICY "items_write" ON public.checklist_items FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- checklist_executions
CREATE POLICY "exec_read" ON public.checklist_executions FOR SELECT TO authenticated
  USING (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), sector_id));
CREATE POLICY "exec_insert" ON public.checklist_executions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), sector_id));
CREATE POLICY "exec_update" ON public.checklist_executions FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager(auth.uid()) OR executed_by = auth.uid() OR public.user_in_sector(auth.uid(), sector_id))
  WITH CHECK (public.is_admin_or_manager(auth.uid()) OR executed_by = auth.uid() OR public.user_in_sector(auth.uid(), sector_id));
CREATE POLICY "exec_delete_admin" ON public.checklist_executions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- checklist_item_responses
CREATE POLICY "resp_read" ON public.checklist_item_responses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id
      AND (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), e.sector_id)))
  );
CREATE POLICY "resp_write" ON public.checklist_item_responses FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id
      AND (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), e.sector_id)))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.checklist_executions e WHERE e.id = execution_id
      AND (public.is_admin_or_manager(auth.uid()) OR public.user_in_sector(auth.uid(), e.sector_id)))
  );

-- non_conformities
CREATE POLICY "nc_read" ON public.non_conformities FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager(auth.uid())
    OR responsible_user_id = auth.uid()
    OR created_by = auth.uid()
    OR (sector_id IS NOT NULL AND public.user_in_sector(auth.uid(), sector_id))
  );
CREATE POLICY "nc_insert" ON public.non_conformities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nc_update" ON public.non_conformities FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_manager(auth.uid())
    OR responsible_user_id = auth.uid()
    OR (sector_id IS NOT NULL AND public.user_in_sector(auth.uid(), sector_id))
  )
  WITH CHECK (
    public.is_admin_or_manager(auth.uid())
    OR responsible_user_id = auth.uid()
    OR (sector_id IS NOT NULL AND public.user_in_sector(auth.uid(), sector_id))
  );
CREATE POLICY "nc_delete_admin" ON public.non_conformities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- action_plans
CREATE POLICY "ap_read" ON public.action_plans FOR SELECT TO authenticated
  USING (
    public.is_admin_or_manager(auth.uid())
    OR who = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.non_conformities n WHERE n.id = non_conformity_id
      AND (n.responsible_user_id = auth.uid() OR (n.sector_id IS NOT NULL AND public.user_in_sector(auth.uid(), n.sector_id)))
    )
  );
CREATE POLICY "ap_write" ON public.action_plans FOR ALL TO authenticated
  USING (
    public.is_admin_or_manager(auth.uid())
    OR who = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_admin_or_manager(auth.uid())
    OR who = auth.uid()
    OR created_by = auth.uid()
  );

-- =========================
-- AUTO PROFILE + FIRST USER = ADMIN
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.users_profile (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- AUTO NC ON nao_conforme
-- =========================
CREATE OR REPLACE FUNCTION public.handle_nc_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sector uuid;
  _item public.checklist_items%ROWTYPE;
  _sev public.severity_kind;
BEGIN
  IF NEW.response <> 'nao_conforme' THEN
    -- if previously NC and now changed, mark NC cancelada
    IF TG_OP = 'UPDATE' AND OLD.response = 'nao_conforme' THEN
      UPDATE public.non_conformities SET status = 'cancelada', updated_at = now()
        WHERE response_id = NEW.id AND status = 'aberta';
    END IF;
    RETURN NEW;
  END IF;

  -- avoid duplicates
  IF EXISTS (SELECT 1 FROM public.non_conformities WHERE response_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _item FROM public.checklist_items WHERE id = NEW.item_id;
  SELECT sector_id INTO _sector FROM public.checklist_executions WHERE id = NEW.execution_id;
  _sev := CASE WHEN _item.is_critical THEN 'alta'::public.severity_kind ELSE 'media'::public.severity_kind END;

  INSERT INTO public.non_conformities (
    response_id, execution_id, item_id, sector_id, severity,
    responsible_user_id, due_date, status, title, description, evidence_urls, created_by
  ) VALUES (
    NEW.id, NEW.execution_id, NEW.item_id, _sector, _sev,
    NEW.answered_by, (now() + interval '3 days')::date, 'aberta',
    COALESCE(_item.question, 'Não conformidade'),
    NEW.observation, NEW.photo_urls, NEW.answered_by
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_resp_to_nc
  AFTER INSERT OR UPDATE ON public.checklist_item_responses
  FOR EACH ROW EXECUTE FUNCTION public.handle_nc_response();

-- =========================
-- STORAGE POLICIES (checklist-evidence)
-- =========================
CREATE POLICY "evidence_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checklist-evidence');
CREATE POLICY "evidence_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checklist-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "evidence_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'checklist-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "evidence_delete_own_or_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'checklist-evidence' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

-- =========================
-- SEED DATA
-- =========================
INSERT INTO public.sectors (name, kind) VALUES
  ('Salão','salao'),
  ('Cozinha','cozinha'),
  ('Bar','bar');

DO $seed$
DECLARE
  s_salao uuid; s_cozinha uuid; s_bar uuid;
  c_id uuid;
BEGIN
  SELECT id INTO s_salao FROM public.sectors WHERE kind='salao';
  SELECT id INTO s_cozinha FROM public.sectors WHERE kind='cozinha';
  SELECT id INTO s_bar FROM public.sectors WHERE kind='bar';

  -- SALÃO Abertura
  INSERT INTO public.checklists (sector_id, moment, title, description)
    VALUES (s_salao,'abertura','Abertura do Salão','Checklist diário de abertura do salão') RETURNING id INTO c_id;
  INSERT INTO public.checklist_items (checklist_id, position, question, is_critical, requires_photo) VALUES
    (c_id,1,'Mesas limpas e organizadas?',false,false),
    (c_id,2,'Piso e área de circulação limpos?',false,false),
    (c_id,3,'Cardápios em bom estado e disponíveis?',false,false),
    (c_id,4,'Iluminação e ambientação funcionando?',true,true),
    (c_id,5,'Uniformes da equipe em ordem?',false,false);

  -- SALÃO Fechamento
  INSERT INTO public.checklists (sector_id, moment, title, description)
    VALUES (s_salao,'fechamento','Fechamento do Salão','Checklist diário de fechamento do salão') RETURNING id INTO c_id;
  INSERT INTO public.checklist_items (checklist_id, position, question, is_critical, requires_photo) VALUES
    (c_id,1,'Mesas higienizadas e arrumadas?',false,false),
    (c_id,2,'Lixos retirados?',false,false),
    (c_id,3,'Equipamentos desligados?',true,false),
    (c_id,4,'Caixa conferido?',true,true);

  -- COZINHA Abertura
  INSERT INTO public.checklists (sector_id, moment, title, description)
    VALUES (s_cozinha,'abertura','Abertura da Cozinha','Checklist diário de abertura da cozinha') RETURNING id INTO c_id;
  INSERT INTO public.checklist_items (checklist_id, position, question, is_critical, requires_photo) VALUES
    (c_id,1,'Temperatura das geladeiras conforme padrão?',true,true),
    (c_id,2,'Estoque conferido e organizado?',false,false),
    (c_id,3,'Higienização das bancadas realizada?',true,false),
    (c_id,4,'EPIs disponíveis para a equipe?',true,false),
    (c_id,5,'Validades dos insumos verificadas?',true,true);

  -- COZINHA Fechamento
  INSERT INTO public.checklists (sector_id, moment, title, description)
    VALUES (s_cozinha,'fechamento','Fechamento da Cozinha','Checklist diário de fechamento da cozinha') RETURNING id INTO c_id;
  INSERT INTO public.checklist_items (checklist_id, position, question, is_critical, requires_photo) VALUES
    (c_id,1,'Fogões e fornos desligados?',true,false),
    (c_id,2,'Sobras armazenadas corretamente?',true,true),
    (c_id,3,'Lixo orgânico retirado?',false,false),
    (c_id,4,'Limpeza geral concluída?',false,false);

  -- BAR Abertura
  INSERT INTO public.checklists (sector_id, moment, title, description)
    VALUES (s_bar,'abertura','Abertura do Bar','Checklist diário de abertura do bar') RETURNING id INTO c_id;
  INSERT INTO public.checklist_items (checklist_id, position, question, is_critical, requires_photo) VALUES
    (c_id,1,'Bebidas estocadas e geladas?',false,false),
    (c_id,2,'Taças e copos higienizados?',true,false),
    (c_id,3,'Insumos (frutas, gelo, xaropes) conferidos?',false,false),
    (c_id,4,'Equipamentos (chopeira, blender) funcionando?',true,true);

  -- BAR Fechamento
  INSERT INTO public.checklists (sector_id, moment, title, description)
    VALUES (s_bar,'fechamento','Fechamento do Bar','Checklist diário de fechamento do bar') RETURNING id INTO c_id;
  INSERT INTO public.checklist_items (checklist_id, position, question, is_critical, requires_photo) VALUES
    (c_id,1,'Bebidas guardadas e estoque conferido?',false,false),
    (c_id,2,'Equipamentos desligados e limpos?',true,false),
    (c_id,3,'Bancada higienizada?',false,false),
    (c_id,4,'Caixa do bar conferido?',true,true);
END $seed$;
