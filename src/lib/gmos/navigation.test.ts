import { describe, expect, it } from "vitest";
import { NAV_ITEMS, filterNav } from "./navigation";
import { buildAuthorization, type RoleAssignment } from "./rbac";

const build = (role: string, permissions: string[]) => {
  const assignment: RoleAssignment = {
    assignment_id: "a1",
    role_code: role,
    role_name: role,
    status: "active",
    effective_from: "2026-01-01",
    effective_to: null,
    scope_id: "s1",
    scope_type: role === "group_owner" ? "organization" : "business_unit",
    scope_label: "s1",
    organization_id: "org",
    permissions,
  };
  return buildAuthorization({
    userId: "u1",
    userStatus: "active",
    organizationId: "org",
    assignments: [assignment],
    scopes: [
      {
        id: "s1",
        parent_scope_id: null,
        scope_type: assignment.scope_type,
        label: "s1",
        organization_id: "org",
        target_table: null,
        target_id: null,
        status: "active",
      },
    ],
  });
};

describe("filterNav", () => {
  it("sem autorização não mostra nenhum item", () => {
    expect(filterNav(NAV_ITEMS, null)).toEqual([]);
  });

  it("colaborador vê apenas o essencial", () => {
    const keys = filterNav(
      NAV_ITEMS,
      build("collaborator", ["dashboard.personal", "routine.read"]),
    ).map((i) => i.key);
    expect(keys).toContain("rotinas");
    expect(keys).toContain("inicio");
    expect(keys).not.toContain("estrutura");
    expect(keys).not.toContain("planejamento");
  });

  it("usuário sem atribuição ativa não vê itens protegidos", () => {
    const authz = buildAuthorization({
      userId: "u1",
      userStatus: "active",
      organizationId: "org",
      assignments: [],
      scopes: [],
    });
    const keys = filterNav(NAV_ITEMS, authz).map((i) => i.key);
    expect(authz.hasAnyAssignment).toBe(false);
    expect(keys).not.toContain("estrutura");
    expect(keys).not.toContain("rotinas");
    expect(keys).not.toContain("acessos");
  });

  it("proprietário do Grupo vê estrutura e acessos", () => {
    const keys = filterNav(
      NAV_ITEMS,
      build("group_owner", ["strategy.read", "action.read", "routine.read", "structure.read"]),
    ).map((i) => i.key);
    expect(keys).toContain("estrutura");
    expect(keys).toContain("acessos");
    expect(keys[0]).toBe("inicio");
  });
});
