// FASE F8.5 — regras puras do organograma funcional.
import { describe, expect, it } from "vitest";
import {
  buildOrgTree,
  filterOrgChart,
  flattenTree,
  matchesFilters,
  orgChartActions,
  orgManagementActions,
  orgSummary,
  positionDefinitionCompleteness,
  responsibilitySummary,
  validateOrgChart,
  type OrgAssignment,
  type OrgPerson,
  type OrgPosition,
} from "./org-chart";
import type { ScopeNode } from "./rbac";

const ORG = "org-1";

function position(over: Partial<OrgPosition> & { id: string; title: string }): OrgPosition {
  return {
    organizationId: ORG,
    scopeId: "scope-org",
    parentPositionId: null,
    purpose: "Propósito",
    responsibilities: "Responsabilidades",
    decisionAuthority: "Autoridade",
    keyDeliverables: "Entregas",
    expectedHeadcount: 1,
    status: "active",
    sortOrder: 0,
    ...over,
  };
}

function person(over: Partial<OrgPerson> & { id: string; fullName: string }): OrgPerson {
  return {
    organizationId: ORG,
    homeScopeId: "scope-org",
    userId: null,
    workEmail: null,
    employeeCode: null,
    status: "active",
    ...over,
  };
}

function assignment(
  over: Partial<OrgAssignment> & { id: string; positionId: string; personId: string },
): OrgAssignment {
  return {
    organizationId: ORG,
    assignmentType: "primary",
    startDate: "2026-01-01",
    endDate: null,
    status: "active",
    notes: null,
    ...over,
  };
}

const SCOPES: ScopeNode[] = [
  {
    id: "scope-org",
    parent_scope_id: null,
    scope_type: "organization",
    label: "Grupo",
    organization_id: ORG,
    target_table: null,
    target_id: null,
    status: "active",
  },
  {
    id: "scope-bu",
    parent_scope_id: "scope-org",
    scope_type: "business_unit",
    label: "Filial",
    organization_id: ORG,
    target_table: null,
    target_id: null,
    status: "active",
  },
  {
    id: "scope-other",
    parent_scope_id: "scope-org",
    scope_type: "business_unit",
    label: "Outra filial",
    organization_id: ORG,
    target_table: null,
    target_id: null,
    status: "active",
  },
];

describe("buildOrgTree", () => {
  it("monta múltiplas raízes com filhos", () => {
    const positions = [
      position({ id: "a", title: "Diretoria" }),
      position({ id: "b", title: "Conselho" }),
      position({ id: "c", title: "Gerência", parentPositionId: "a", scopeId: "scope-bu" }),
    ];
    const tree = buildOrgTree(positions, [], []);
    expect(tree.map((n) => n.position.id).sort()).toEqual(["a", "b"]);
    expect(flattenTree(tree)).toHaveLength(3);
    const diretoria = tree.find((n) => n.position.id === "a")!;
    expect(diretoria.children[0]!.position.id).toBe("c");
    expect(diretoria.children[0]!.depth).toBe(1);
  });

  it("ordena por sort_order e depois por título", () => {
    const positions = [
      position({ id: "x", title: "Zeladoria", sortOrder: 1 }),
      position({ id: "y", title: "Almoxarifado", sortOrder: 1 }),
      position({ id: "z", title: "Presidência", sortOrder: 0 }),
    ];
    expect(buildOrgTree(positions, [], []).map((n) => n.position.title)).toEqual([
      "Presidência",
      "Almoxarifado",
      "Zeladoria",
    ]);
  });

  it("marca posição vaga e ordena ocupantes com titular primeiro", () => {
    const positions = [position({ id: "a", title: "Gerência", expectedHeadcount: 2 })];
    const people = [person({ id: "p1", fullName: "Ana" }), person({ id: "p2", fullName: "Bruno" })];
    const vacant = buildOrgTree(positions, [], people)[0]!;
    expect(vacant.vacant).toBe(true);

    const assignments = [
      assignment({ id: "a2", positionId: "a", personId: "p2", assignmentType: "support" }),
      assignment({ id: "a1", positionId: "a", personId: "p1" }),
    ];
    const filled = buildOrgTree(positions, assignments, people)[0]!;
    expect(filled.vacant).toBe(false);
    expect(filled.occupants.map((o) => o.person.fullName)).toEqual(["Ana", "Bruno"]);
  });
});

describe("positionDefinitionCompleteness", () => {
  it("0%, parcial e 100%", () => {
    const empty = positionDefinitionCompleteness({
      purpose: "   ",
      responsibilities: null,
      decisionAuthority: "",
      keyDeliverables: null,
    });
    expect(empty.percent).toBe(0);
    expect(empty.complete).toBe(false);
    expect(empty.missing).toHaveLength(4);

    const partial = positionDefinitionCompleteness({
      purpose: "Garantir a operação",
      responsibilities: "Conduzir rotinas",
      decisionAuthority: null,
      keyDeliverables: null,
    });
    expect(partial.percent).toBe(50);
    expect(partial.missing).toEqual(["authority", "deliverables"]);

    const full = positionDefinitionCompleteness({
      purpose: "a",
      responsibilities: "b",
      decisionAuthority: "c",
      keyDeliverables: "d",
    });
    expect(full.percent).toBe(100);
    expect(full.complete).toBe(true);
  });
});

describe("validateOrgChart", () => {
  const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

  it("posição raiz sem chefia não gera alerta e não raiz gera", () => {
    const positions = [
      position({ id: "root", title: "Presidência", scopeId: "scope-org" }),
      position({ id: "solta", title: "Gerência", scopeId: "scope-bu" }),
    ];
    const issues = validateOrgChart({ positions, people: [], assignments: [], scopes: SCOPES });
    const orphan = issues.filter((i) => i.code === "position.no_parent");
    expect(orphan).toHaveLength(1);
    expect(orphan[0]!.positionId).toBe("solta");
  });

  it("cargo vago, headcount excedido e escopo incompatível", () => {
    const positions = [
      position({ id: "root", title: "Presidência" }),
      position({ id: "g", title: "Gerência", parentPositionId: "root", scopeId: "scope-bu" }),
      position({
        id: "v",
        title: "Coordenação",
        parentPositionId: "g",
        scopeId: "scope-other",
      }),
    ];
    const people = [person({ id: "p1", fullName: "Ana" }), person({ id: "p2", fullName: "Bruno" })];
    const assignments = [
      assignment({ id: "a1", positionId: "root", personId: "p1" }),
      assignment({ id: "a2", positionId: "root", personId: "p2" }),
    ];
    const issues = validateOrgChart({ positions, people, assignments, scopes: SCOPES });
    expect(codes(issues)).toContain("position.vacant");
    expect(codes(issues)).toContain("position.over_headcount");
    expect(codes(issues)).toContain("position.scope_mismatch");
  });

  it("pessoa sem titularidade e pessoa com duas titularidades", () => {
    const positions = [
      position({ id: "a", title: "Um", expectedHeadcount: 2 }),
      position({ id: "b", title: "Dois", expectedHeadcount: 2 }),
    ];
    const people = [person({ id: "p1", fullName: "Ana" }), person({ id: "p2", fullName: "Bruno" })];
    const assignments = [
      assignment({ id: "a1", positionId: "a", personId: "p1" }),
      assignment({ id: "a2", positionId: "b", personId: "p1" }),
    ];
    const issues = validateOrgChart({ positions, people, assignments, scopes: SCOPES });
    expect(issues.find((i) => i.code === "person.multiple_primary")?.personId).toBe("p1");
    expect(issues.find((i) => i.code === "person.without_primary")?.personId).toBe("p2");
  });

  it("função sem propósito, responsabilidades, autoridade e entregas", () => {
    const positions = [
      position({
        id: "a",
        title: "Sem definição",
        purpose: null,
        responsibilities: null,
        decisionAuthority: null,
        keyDeliverables: null,
      }),
    ];
    const issues = validateOrgChart({ positions, people: [], assignments: [], scopes: SCOPES });
    expect(codes(issues)).toContain("definition.purpose");
    expect(codes(issues)).toContain("definition.responsibilities");
    expect(codes(issues)).toContain("definition.authority");
    expect(codes(issues)).toContain("definition.deliverables");
    expect(issues.every((i) => i.message.length > 0)).toBe(true);
  });

  it("posição inativa não gera alerta de vaga", () => {
    const positions = [position({ id: "a", title: "Desativada", status: "inactive" })];
    expect(validateOrgChart({ positions, people: [], assignments: [] })).toHaveLength(0);
  });
});

describe("responsibilitySummary", () => {
  const positions = [position({ id: "a", title: "Gerência" })];

  it("agrega responsabilidade real apenas quando existe user_id", () => {
    const people = [
      person({ id: "p1", fullName: "Ana", userId: "u1" }),
      person({ id: "p2", fullName: "Bruno" }),
    ];
    const assignments = [
      assignment({ id: "a1", positionId: "a", personId: "p1" }),
      assignment({ id: "a2", positionId: "a", personId: "p2", assignmentType: "support" }),
    ];
    const workload = {
      u1: { objectives: 2, kpis: 3, actions: 1, routines: 0 },
      u2: { objectives: 9, kpis: 9, actions: 9, routines: 9 },
    };
    const summary = responsibilitySummary(people, assignments, positions, workload);
    const ana = summary.find((s) => s.person.id === "p1")!;
    const bruno = summary.find((s) => s.person.id === "p2")!;
    expect(ana.linkedUser).toBe(true);
    expect(ana.workload.kpis).toBe(3);
    expect(ana.hasWork).toBe(true);
    expect(ana.positionTitles).toEqual(["Gerência"]);
    expect(bruno.linkedUser).toBe(false);
    expect(bruno.workload).toEqual({ objectives: 0, kpis: 0, actions: 0, routines: 0 });
    expect(bruno.hasWork).toBe(false);
  });
});

describe("filtros e resumo", () => {
  const positions = [
    position({ id: "a", title: "Gerência de Obras" }),
    position({
      id: "b",
      title: "Analista de Custos",
      purpose: null,
      responsibilities: null,
      decisionAuthority: null,
      keyDeliverables: null,
      scopeId: "scope-bu",
    }),
  ];
  const people = [person({ id: "p1", fullName: "Ana Souza" })];
  const assignments = [assignment({ id: "a1", positionId: "a", personId: "p1" })];
  const tree = buildOrgTree(positions, assignments, people);
  const nodes = flattenTree(tree);

  it("busca por cargo e por pessoa", () => {
    expect(nodes.filter((n) => matchesFilters(n, { search: "obras" }))).toHaveLength(1);
    expect(nodes.filter((n) => matchesFilters(n, { search: "souza" }))).toHaveLength(1);
    expect(nodes.filter((n) => matchesFilters(n, { search: "inexistente" }))).toHaveLength(0);
  });

  it("filtra por situação e escopo", () => {
    expect(nodes.filter((n) => matchesFilters(n, { situation: "vacant" }))).toHaveLength(1);
    expect(nodes.filter((n) => matchesFilters(n, { situation: "occupied" }))).toHaveLength(1);
    expect(nodes.filter((n) => matchesFilters(n, { situation: "incomplete" }))).toHaveLength(1);
    expect(nodes.filter((n) => matchesFilters(n, { scopeId: "scope-bu" }))).toHaveLength(1);
  });

  it("resumo de governança", () => {
    expect(orgSummary(positions, people, assignments)).toEqual({
      activePositions: 2,
      occupied: 1,
      vacant: 1,
      peopleWithoutPosition: 0,
      incompleteDefinitions: 1,
    });
  });
});

describe("orgManagementActions", () => {
  it("structure.manage habilita ações; somente leitura não", () => {
    const manage = orgManagementActions(true);
    expect(Object.values(manage).every(Boolean)).toBe(true);
    const readOnly = orgManagementActions(false);
    expect(Object.values(readOnly).some(Boolean)).toBe(false);
  });
});
