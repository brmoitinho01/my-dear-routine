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
    expect(keys).toContain("meu-trabalho");
    expect(keys).not.toContain("painel-grupo");
    expect(keys).not.toContain("painel-equipe");
    expect(keys).not.toContain("estrutura");
  });

  it("proprietário vê o painel do Grupo em primeiro lugar", () => {
    const keys = filterNav(
      NAV_ITEMS,
      build("group_owner", [
        "dashboard.group",
        "dashboard.team",
        "dashboard.personal",
        "strategy.read",
        "action.read",
        "routine.read",
        "structure.read",
      ]),
    ).map((i) => i.key);
    expect(keys[0]).toBe("painel-grupo");
    expect(keys).toContain("acessos");
  });
});