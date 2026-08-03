// FASE F7 — leitura e operações de IAM.
// Toda leitura passa pela RLS; toda escrita passa por RPC transacional validada no banco.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";

export type IamAssignment = {
  id: string;
  userId: string;
  roleCode: string;
  roleName: string;
  scopeId: string;
  scopeType: string;
  scopeLabel: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  justification: string;
};

export type IamDirectoryUser = {
  userId: string;
  status: string;
  assignments: IamAssignment[];
};

export type IamScope = {
  id: string;
  scopeType: string;
  label: string;
  parentScopeId: string | null;
};

export type IamDirectory = {
  users: IamDirectoryUser[];
  scopes: IamScope[];
  assignableRoles: Array<{ code: string; name: string }>;
};

/** Diretório visível ao usuário atual. A RLS define quem aparece. */
export async function fetchIamDirectory(): Promise<IamDirectory> {
  const [assignmentsRes, usersRes, scopesRes, rolesRes] = await Promise.all([
    supabase
      .from("user_role_assignments")
      .select(
        "id, user_id, status, effective_from, effective_to, justification, role_id, scope_id, roles(code, name), scopes(id, scope_type, label)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, status").order("created_at"),
    supabase
      .from("scopes")
      .select("id, scope_type, label, parent_scope_id, status")
      .eq("status", "active")
      .order("scope_type"),
    supabase.from("roles").select("code, name, status").eq("status", "active").order("name"),
  ]);

  for (const res of [assignmentsRes, usersRes, scopesRes, rolesRes]) {
    if (res.error) translateError(res.error);
  }

  const assignments: IamAssignment[] = (assignmentsRes.data ?? []).map((row) => {
    const role = row.roles as { code: string; name: string } | null;
    const scope = row.scopes as { scope_type: string; label: string } | null;
    return {
      id: row.id,
      userId: row.user_id,
      roleCode: String(role?.code ?? ""),
      roleName: role?.name ?? String(role?.code ?? ""),
      scopeId: row.scope_id,
      scopeType: scope?.scope_type ?? "",
      scopeLabel: scope?.label ?? "",
      status: row.status,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      justification: row.justification,
    };
  });

  const users: IamDirectoryUser[] = (usersRes.data ?? []).map((u) => ({
    userId: u.id,
    status: u.status,
    assignments: assignments.filter((a) => a.userId === u.id),
  }));

  // usuários visíveis apenas via atribuição (sem linha legível em users)
  for (const a of assignments) {
    if (!users.some((u) => u.userId === a.userId)) {
      users.push({
        userId: a.userId,
        status: "desconhecido",
        assignments: assignments.filter((x) => x.userId === a.userId),
      });
    }
  }

  return {
    users,
    scopes: (scopesRes.data ?? []).map((s) => ({
      id: s.id,
      scopeType: s.scope_type,
      label: s.label,
      parentScopeId: s.parent_scope_id,
    })),
    assignableRoles: (rolesRes.data ?? []).map((r) => ({
      code: String(r.code),
      name: r.name,
    })),
  };
}

export async function assignRole(input: {
  userId: string;
  roleCode: string;
  scopeId: string;
  justification: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("gmos_assign_role", {
    p_user_id: input.userId,
    p_role_code: input.roleCode,
    p_scope_id: input.scopeId,
    p_justification: input.justification,
  });
  if (error) translateError(error);
  return data as unknown as string;
}

export async function revokeRole(input: {
  assignmentId: string;
  justification: string;
}): Promise<void> {
  const { error } = await supabase.rpc("gmos_revoke_role", {
    p_assignment_id: input.assignmentId,
    p_justification: input.justification,
  });
  if (error) translateError(error);
}