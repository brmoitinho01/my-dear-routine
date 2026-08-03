-- F7-A · complemento idempotente: helper reutilizável de hierarquia de escopos.
-- Equivalência solicitada: scope_is_same_or_descendant -> public.gmos_scope_is_same_or_descendant.
-- Não altera tabelas, dados, papéis, permissões nem policies existentes.

CREATE OR REPLACE FUNCTION public.gmos_scope_is_same_or_descendant(
  p_candidate_scope_id uuid,
  p_assigned_scope_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH RECURSIVE chain AS (
    SELECT s.id, s.parent_scope_id
      FROM public.scopes s
     WHERE s.id = p_candidate_scope_id
    UNION ALL
    SELECT p.id, p.parent_scope_id
      FROM public.scopes p
      JOIN chain c ON c.parent_scope_id = p.id
  )
  SELECT CASE
    WHEN p_candidate_scope_id IS NULL OR p_assigned_scope_id IS NULL THEN false
    ELSE EXISTS (SELECT 1 FROM chain WHERE chain.id = p_assigned_scope_id)
  END
$$;

REVOKE ALL ON FUNCTION public.gmos_scope_is_same_or_descendant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gmos_scope_is_same_or_descendant(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gmos_scope_is_same_or_descendant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gmos_scope_is_same_or_descendant(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.gmos_scope_is_same_or_descendant(uuid, uuid) IS
  'F7-A: true quando p_candidate_scope_id e o proprio p_assigned_scope_id ou um descendente dele.';