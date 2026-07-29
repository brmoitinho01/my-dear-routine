DELETE FROM public.scopes
 WHERE label = 'Probe'
   AND scope_type = 'company'
   AND parent_scope_id IS NOT NULL;

DO $chk$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM public.scopes;
  IF v <> 1 THEN RAISE EXCEPTION 'esperado 1 escopo (raiz), obtido %', v; END IF;
END
$chk$;