ALTER TABLE public.company_strategy_profiles
  ADD COLUMN IF NOT EXISTS diagnosis_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS diagnosis_reviewed_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.company_strategy_profiles.diagnosis_reviewed_at IS
  'F12.1-C2A: confirmacao explicita de revisao do diagnostico guiado. Pode existir com zero sinais selecionados.';

CREATE OR REPLACE FUNCTION public.f12_invalidate_diagnosis_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bu uuid;
  v_org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_bu := OLD.business_unit_id;
    v_org := OLD.organization_id;
  ELSE
    v_bu := NEW.business_unit_id;
    v_org := NEW.organization_id;
  END IF;

  UPDATE public.company_strategy_profiles
     SET diagnosis_reviewed_at = NULL,
         diagnosis_reviewed_by = NULL
   WHERE business_unit_id = v_bu
     AND organization_id = v_org
     AND diagnosis_reviewed_at IS NOT NULL;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.f12_invalidate_diagnosis_review() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_f12_invalidate_diagnosis_review ON public.strategy_diagnosis_selections;
CREATE TRIGGER trg_f12_invalidate_diagnosis_review
AFTER INSERT OR UPDATE OR DELETE ON public.strategy_diagnosis_selections
FOR EACH ROW EXECUTE FUNCTION public.f12_invalidate_diagnosis_review();