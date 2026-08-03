import { describe, expect, it } from "vitest";
import {
  buildAuthorization,
  primaryRoleCode,
  type AuthorizationPayload,
  type RoleAssignment,
  type ScopeNode,
} from "./rbac";

const scope = (id: string, type: string, parent: string | null = null): ScopeNode => ({
  id,
  parent_scope_id: parent,
  scope_type: type,
  label: id,
  organization_id: "org",
  target_table: null,
  target_id: null,
  status: "active",
});

const assignment = (
  role: string,
  scopeId: string,
  scopeType: string,
  permissions: string[],
): RoleAssignment => ({
  assignment_id: `${role}-${scopeId}`,
  role_code: role,
  role_name: role,
  status: "active",
  effective_from: "2026-01-01",
  effective_to: null,
  scope_id: scopeId,
  scope_type: scopeType,
  scope_label: scopeId,
  organization_id: "org",
  permissions,
});

const scopes = [
  scope("org-root", "organization"),
  scope("comp-a", "company", "org-root"),
  scope("unit-a", "business_unit", "comp-a"),
  scope("comp-b", "company", "org-root"),
  scope("unit-b", "business_unit", "comp-b"),
];

const payload = (assignments: RoleAssignment[]): AuthorizationPayload => ({
  userId: "u1",
  userStatus: "active",
  organizationId: "org",
  assignments,
  scopes,
});

describe("primaryRoleCode", () => {
  it("prioriza o papel de maior alcance", () => {
    expect(primaryRoleCode(["collaborator", "group_owner", "manager"])).toBe("group_owner");
    expect(primaryRoleCode(["collaborator", "manager"])).toBe("manager");
    expect(primaryRoleCode([])).toBeNull();
  });
});

describe("buildAuthorization", () => {
  it("proprietário do Grupo alcança todos os escopos", () => {
    const authz = buildAuthorization(
      payload([
        assignment("group_owner", "org-root", "organization", ["dashboard.group", "strategy.read"]),
      ]),
    );
    expect(authz.isGroupOwner).toBe(true);
    expect(authz.isGroupPrivileged).toBe(true);
    expect(authz.can("dashboard.group")).toBe(true);
    expect(authz.can("strategy.read", "unit-b")).toBe(true);
    expect(authz.primaryRoleLabel).toBe("Proprietário do Grupo");
  });

  it("gestor alcança apenas descendentes do próprio escopo", () => {
    const authz = buildAuthorization(
      payload([assignment("manager", "comp-a", "company", ["dashboard.team", "action.manage"])]),
    );
    expect(authz.isGroupPrivileged).toBe(false);
    expect(authz.can("dashboard.team", "unit-a")).toBe(true);
    expect(authz.can("dashboard.team", "unit-b")).toBe(false);
    expect(authz.can("dashboard.group")).toBe(false);
    expect(authz.scopesWithPermission("action.manage").map((s) => s.id)).toEqual([
      "comp-a",
      "unit-a",
    ]);
  });

  it("colaborador sem permissão de painel de equipe", () => {
    const authz = buildAuthorization(
      payload([
        assignment("collaborator", "unit-a", "business_unit", [
          "dashboard.personal",
          "routine.execute_own",
        ]),
      ]),
    );
    expect(authz.can("dashboard.personal")).toBe(true);
    expect(authz.can("dashboard.team")).toBe(false);
    expect(authz.can("routine.execute_own", "unit-a")).toBe(true);
    expect(authz.can("routine.execute_own", "unit-b")).toBe(false);
  });

  it("usuário sem atribuição não recebe nada", () => {
    const authz = buildAuthorization(payload([]));
    expect(authz.hasAnyAssignment).toBe(false);
    expect(authz.can("dashboard.personal")).toBe(false);
    expect(authz.primaryRoleLabel).toBe("Sem papel atribuído");
  });

  it("group_owner tem precedência sobre papéis acumulados", () => {
    const authz = buildAuthorization(
      payload([
        assignment("collaborator", "unit-a", "business_unit", ["dashboard.personal"]),
        assignment("group_admin", "org-root", "organization", ["role.read"]),
        assignment("group_owner", "org-root", "organization", ["dashboard.group", "role.assign"]),
      ]),
    );
    expect(authz.primaryRole).toBe("group_owner");
    expect(authz.isGroupOwner).toBe(true);
    expect(authz.isGroupAdmin).toBe(true);
    expect(authz.isCollaborator).toBe(true);
    // permissões são a união dos papéis ativos, sem perder o alcance do proprietário
    expect(authz.permissions).toEqual([
      "dashboard.group",
      "dashboard.personal",
      "role.assign",
      "role.read",
    ]);
    expect(authz.can("role.assign", "unit-b")).toBe(true);
  });
});