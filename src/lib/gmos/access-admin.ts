// FASE F7 — administração de acessos (somente proprietário/administrador do Grupo).
// Toda concessão passa pelas RPCs validadas no banco: nada é decidido no cliente.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

export type DirectoryAssignment = {
  id: string;
  roleCode: string;
  roleName: string;
  status: string;
  scopeId: string;
  scopeLabel: string;
  scopeType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type DirectoryUser = {
  id: string;
  status: string;
  organizationId: string | null;
  assignments: DirectoryAssignment[];
};

export type RoleOption = { id: string; code: string; name: string };

export async function fetchRoleOptions(): Promise<RoleOption[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, code, name, status")
    .eq("status", "active")
    .order("name");
  if (error) translateError(error);
  return (data ?? []).map((r) => ({ id: r.id, code: String(r.code), name: r.name }));
}

/** Diretório restrito: a RLS devolve apenas os usuários que o perfil pode ver. */
export async function fetchDirectory(): Promise<DirectoryUser[]> {
  const [usersRes, uraRes] = await Promise.all([
    supabase.from("users").select("id, status, organization_id").order("created_at"),
    supabase
      .from("user_role_assignments")
      .select(
        "id, user_id, status, effective_from, effective_to, roles(code, name), scopes(id, label, scope_type)",
      )
      .order("created_at", { ascending: false }),
  ]);
  for (const r of [usersRes, uraRes]) if (r.error) translateError(r.error);

  const byUser = new Map<string, DirectoryAssignment[]>();
  for (const row of uraRes.data ?? []) {
    const role = row.roles as { code?: string; name?: string } | null;
    const scope = row.scopes as { id?: string; label?: string; scope_type?: string } | null;
    const list = byUser.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      roleCode: String(role?.code ?? "—"),
      roleName: role?.name ?? "—",
      status: row.status,
      scopeId: String(scope?.id ?? ""),
      scopeLabel: scope?.label ?? "—",
      scopeType: scope?.scope_type ?? "—",
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
    });
    byUser.set(row.user_id, list);
  }

  return (usersRes.data ?? []).map((u) => ({
    id: u.id,
    status: u.status,
    organizationId: u.organization_id,
    assignments: byUser.get(u.id) ?? [],
  }));
}

export async function assignRole(input: {
  userId: string;
  roleCode: string;
  scopeId: string;
  justification: string;
}): Promise<void> {
  const { error } = await supabase.rpc("gmos_assign_role", {
    p_user_id: input.userId,
    p_role_code: input.roleCode,
    p_scope_id: input.scopeId,
    p_justification: input.justification,
  });
  if (error) translateError(error);
}

export async function revokeRole(assignmentId: string, justification: string): Promise<void> {
  const { error } = await supabase.rpc("gmos_revoke_role", {
    p_assignment_id: assignmentId,
    p_justification: justification,
  });
  if (error) translateError(error);
}