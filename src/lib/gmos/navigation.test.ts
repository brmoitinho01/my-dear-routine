import { describe, expect, it } from "vitest";
import { NAV_ITEMS, filterNav } from "./navigation";
import { buildAuthorization, type RoleAssignment } from "./rbac";
import { homeSecondaryCtas, selectHomeFocus } from "./home-focus";

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

describe("ordem por perfil (F7-E)", () => {
  const perms = [
    "dashboard.personal",
    "dashboard.team",
    "dashboard.group",
    "routine.read",
    "strategy.read",
    "action.read",
    "structure.read",
  ];

  it("group_owner: Painel do Grupo é o primeiro item", () => {
    const keys = filterNav(NAV_ITEMS, build("group_owner", perms)).map((i) => i.key);
    expect(keys[0]).toBe("painel-grupo");
    expect(keys).toContain("metodo");
    expect(keys).toContain("apresentacao");
  });

  it("group_admin: painel atual primeiro, depois Painel do Grupo", () => {
    const keys = filterNav(NAV_ITEMS, build("group_admin", perms)).map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["inicio", "painel-grupo"]);
    expect(keys).toContain("estrutura");
  });

  it("manager: Painel da equipe antes de Meu trabalho", () => {
    const keys = filterNav(
      NAV_ITEMS,
      build("manager", ["dashboard.team", "dashboard.personal", "routine.read", "strategy.read"]),
    ).map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["painel-equipe", "meu-trabalho"]);
    expect(keys).toContain("apresentacao");
  });

  it("collaborator: Meu trabalho antes de Rotinas", () => {
    const keys = filterNav(
      NAV_ITEMS,
      build("collaborator", ["dashboard.personal", "routine.read"]),
    ).map((i) => i.key);
    expect(keys.slice(0, 2)).toEqual(["meu-trabalho", "rotinas"]);
    expect(keys).toContain("metodo");
  });
});

describe("destaque da home por perfil", () => {
  const base = {
    canGroup: false,
    canTeam: false,
    canPersonal: false,
    isGroupOwner: false,
    isGroupAdmin: false,
    primaryRole: null as string | null,
  };

  it("collaborator destaca Meu trabalho", () => {
    expect(selectHomeFocus({ ...base, primaryRole: "collaborator", canPersonal: true })).toBe(
      "personal",
    );
  });
  it("manager destaca Painel da equipe", () => {
    expect(
      selectHomeFocus({ ...base, primaryRole: "manager", canTeam: true, canPersonal: true }),
    ).toBe("team");
  });
  it("group_owner destaca Painel do Grupo", () => {
    expect(
      selectHomeFocus({
        ...base,
        primaryRole: "group_owner",
        isGroupOwner: true,
        canGroup: true,
        canTeam: true,
        canPersonal: true,
      }),
    ).toBe("group");
  });
  it("group_admin destaca Painel do Grupo e oferece os demais atalhos", () => {
    const input = {
      ...base,
      primaryRole: "group_admin",
      isGroupAdmin: true,
      canGroup: true,
      canTeam: true,
      canPersonal: true,
    };
    expect(selectHomeFocus(input)).toBe("group");
    expect(homeSecondaryCtas(input).map((c) => c.to)).toEqual(["/painel-equipe", "/meu-trabalho"]);
  });
  it("sem permissão de painel não há destaque", () => {
    expect(selectHomeFocus(base)).toBeNull();
  });
});
