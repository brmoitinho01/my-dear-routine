// FASE F7 — camada real de autorização.
// A fonte de verdade é o banco (RLS + public.has_permission + public.gmos_my_authorization).
// Nada aqui concede acesso: apenas reflete o que o servidor já autorizou.
import { supabase } from "@/integrations/supabase/client";
import { SessionExpiredError, translateError } from "./structure";

export type ScopeNode = {
  id: string;
  parent_scope_id: string | null;
  scope_type: string;
  label: string;
  organization_id: string;
  target_table: string | null;
  target_id: string | null;
  status: string;
};

export type RoleAssignment = {
  assignment_id: string;
  role_code: string;
  role_name: string;
  status: string;
  effective_from: string;
  effective_to: string | null;
  scope_id: string;
  scope_type: string;
  scope_label: string;
  organization_id: string;
  permissions: string[];
};

export type AuthorizationPayload = {
  userId: string | null;
  userStatus: string | null;
  organizationId: string | null;
  assignments: RoleAssignment[];
  scopes: ScopeNode[];
};

export const EMPTY_AUTHORIZATION: AuthorizationPayload = {
  userId: null,
  userStatus: null,
  organizationId: null,
  assignments: [],
  scopes: [],
};

export const ROLE_LABEL: Record<string, string> = {
  group_owner: "Proprietário do Grupo",
  group_admin: "Administrador do Grupo",
  manager: "Gestor",
  collaborator: "Colaborador",
};

const ROLE_RANK: Record<string, number> = {
  group_owner: 0,
  group_admin: 1,
  manager: 2,
  collaborator: 3,
};

/** Papel principal = o de maior alcance entre os papéis ativos. Determinístico. */
export function primaryRoleCode(codes: string[]): string | null {
  const known = codes.filter((c) => c in ROLE_RANK);
  if (known.length === 0) return codes.length ? [...codes].sort()[0]! : null;
  return known.sort((a, b) => ROLE_RANK[a]! - ROLE_RANK[b]!)[0]!;
}

export function roleLabel(code: string | null): string {
  if (!code) return "Sem papel atribuído";
  return ROLE_LABEL[code] ?? code;
}

export type Authorization = {
  payload: AuthorizationPayload;
  userId: string | null;
  roles: string[];
  primaryRole: string | null;
  primaryRoleLabel: string;
  isGroupOwner: boolean;
  isGroupAdmin: boolean;
  isGroupPrivileged: boolean;
  isManager: boolean;
  isCollaborator: boolean;
  hasAnyAssignment: boolean;
  permissions: string[];
  can: (permission: string, scopeId?: string | null) => boolean;
  scopesWithPermission: (permission: string) => ScopeNode[];
  scopeById: (scopeId: string) => ScopeNode | undefined;
};

/** Função pura e testável: monta a autorização a partir da resposta do banco. */
export function buildAuthorization(payload: AuthorizationPayload): Authorization {
  const assignments = payload.assignments ?? [];
  const scopes = payload.scopes ?? [];
  const byId = new Map(scopes.map((s) => [s.id, s]));
  const roles = Array.from(new Set(assignments.map((a) => a.role_code)));
  const primary = primaryRoleCode(roles);
  const permissions = Array.from(new Set(assignments.flatMap((a) => a.permissions ?? []))).sort();

  const ancestorsOf = (scopeId: string): Set<string> => {
    const out = new Set<string>();
    let cur: string | null | undefined = scopeId;
    let guard = 0;
    while (cur && guard < 32) {
      out.add(cur);
      cur = byId.get(cur)?.parent_scope_id ?? null;
      guard += 1;
    }
    return out;
  };

  const can = (permission: string, scopeId?: string | null) => {
    const granting = assignments.filter((a) => (a.permissions ?? []).includes(permission));
    if (granting.length === 0) return false;
    if (!scopeId) return true;
    const chain = ancestorsOf(scopeId);
    return granting.some((a) => chain.has(a.scope_id));
  };

  const isGroupOwner = assignments.some(
    (a) => a.role_code === "group_owner" && a.scope_type === "organization",
  );
  const isGroupAdmin = assignments.some(
    (a) => a.role_code === "group_admin" && a.scope_type === "organization",
  );

  return {
    payload,
    userId: payload.userId ?? null,
    roles,
    primaryRole: primary,
    primaryRoleLabel: roleLabel(primary),
    isGroupOwner,
    isGroupAdmin,
    isGroupPrivileged: isGroupOwner || isGroupAdmin,
    isManager: roles.includes("manager"),
    isCollaborator: roles.includes("collaborator"),
    hasAnyAssignment: assignments.length > 0,
    permissions,
    can,
    scopesWithPermission: (permission) => {
      const granted = assignments
        .filter((a) => (a.permissions ?? []).includes(permission))
        .map((a) => a.scope_id);
      const set = new Set(granted);
      // inclui descendentes dos escopos concedidos (mesma regra de has_permission)
      let changed = true;
      let guard = 0;
      while (changed && guard < 32) {
        changed = false;
        guard += 1;
        for (const s of scopes) {
          if (!set.has(s.id) && s.parent_scope_id && set.has(s.parent_scope_id)) {
            set.add(s.id);
            changed = true;
          }
        }
      }
      return scopes.filter((s) => set.has(s.id));
    },
    scopeById: (scopeId) => byId.get(scopeId),
  };
}

export async function fetchAuthorization(): Promise<AuthorizationPayload> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new SessionExpiredError();
  const { data, error } = await supabase.rpc("gmos_my_authorization");
  if (error) translateError(error);
  const payload = (data ?? null) as AuthorizationPayload | null;
  if (!payload) return EMPTY_AUTHORIZATION;
  return {
    userId: payload.userId ?? null,
    userStatus: payload.userStatus ?? null,
    organizationId: payload.organizationId ?? null,
    assignments: payload.assignments ?? [],
    scopes: payload.scopes ?? [],
  };
}