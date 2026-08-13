import { describe, expect, it } from "vitest";
import { NAV_ITEMS, filterNav } from "./navigation";
import { actionModuleTabs, planningTabs } from "./module-tabs";
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

describe("menu simplificado com 3 módulos", () => {
  const perms = [
    "dashboard.personal",
    "dashboard.team",
    "dashboard.group",
    "routine.read",
    "strategy.read",
    "action.read",
    "structure.read",
  ];

  it("sem autorização não mostra nenhum item", () => {
    expect(filterNav(NAV_ITEMS, null)).toEqual([]);
  });

  it("catálogo tem exatamente os três módulos visíveis", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["inicio", "planejamento", "planos-de-acao"]);
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Visão Geral",
      "Planejamento Estratégico",
      "Plano de Ação",
    ]);
    expect(NAV_ITEMS.map((i) => i.to)).toEqual(["/", "/planejamento", "/planos-de-acao"]);
  });

  it("perfil com todas as permissões vê os 3 módulos, com Visão Geral primeiro", () => {
    for (const role of ["group_owner", "group_admin", "manager", "collaborator"]) {
      const keys = filterNav(NAV_ITEMS, build(role, perms)).map((i) => i.key);
      expect(keys).toEqual(["inicio", "planejamento", "planos-de-acao"]);
    }
  });

  it("itens antigos nunca aparecem no menu", () => {
    const keys = filterNav(NAV_ITEMS, build("group_owner", perms)).map((i) => i.key);
    for (const hidden of [
      "meu-trabalho",
      "painel-equipe",
      "painel-grupo",
      "metodo",
      "jornada-estrategica",
      "rotinas",
      "apresentacao",
      "estrutura",
      "organograma",
      "acessos",
    ]) {
      expect(keys).not.toContain(hidden);
    }
  });

  it("colaborador sem strategy.read/action.read vê apenas Visão Geral", () => {
    const keys = filterNav(NAV_ITEMS, build("collaborator", ["routine.read"])).map((i) => i.key);
    expect(keys).toEqual(["inicio"]);
  });

  it("usuário sem atribuição ativa vê apenas Visão Geral", () => {
    const authz = buildAuthorization({
      userId: "u1",
      userStatus: "active",
      organizationId: "org",
      assignments: [],
      scopes: [],
    });
    expect(authz.hasAnyAssignment).toBe(false);
    expect(filterNav(NAV_ITEMS, authz).map((i) => i.key)).toEqual(["inicio"]);
  });
});

describe("abas dos módulos por permissão", () => {
  it("Planejamento Estratégico tem sempre Objetivos, KPIs e Medições", () => {
    expect(planningTabs().map((t) => t.key)).toEqual(["objetivos", "kpis", "medicoes"]);
  });

  it("sem autorização não há abas em Plano de Ação", () => {
    expect(actionModuleTabs(null)).toEqual([]);
  });

  it("action.read mostra apenas a aba de ações", () => {
    expect(actionModuleTabs(build("manager", ["action.read"])).map((t) => t.key)).toEqual([
      "acoes",
    ]);
  });

  it("routine.read mostra apenas a aba de rotinas", () => {
    expect(actionModuleTabs(build("collaborator", ["routine.read"])).map((t) => t.key)).toEqual([
      "rotinas",
    ]);
  });

  it("com as duas permissões mostra as duas abas", () => {
    expect(
      actionModuleTabs(build("manager", ["action.read", "routine.read"])).map((t) => t.key),
    ).toEqual(["acoes", "rotinas"]);
  });
});
