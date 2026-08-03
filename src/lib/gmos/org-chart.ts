// FASE F8.5 — Organograma funcional e validação de responsabilidades.
// Nenhuma pessoa, posição ou atribuição é criada automaticamente: tudo depende de
// ação explícita do gestor e é autorizado pela RLS (structure.read / structure.manage).
import { supabase } from "@/integrations/supabase/client";
import { translateError, SessionExpiredError } from "./structure";
import type { ScopeNode } from "./rbac";

/* ------------------------------------------------------------------ tipos */

export type OrgStatus = "active" | "inactive";
export type AssignmentType = "primary" | "acting" | "support";

export type OrgPerson = {
  id: string;
  organizationId: string;
  homeScopeId: string;
  userId: string | null;
  fullName: string;
  workEmail: string | null;
  employeeCode: string | null;
  status: OrgStatus;
};

export type OrgPosition = {
  id: string;
  organizationId: string;
  scopeId: string;
  parentPositionId: string | null;
  title: string;
  purpose: string | null;
  responsibilities: string | null;
  decisionAuthority: string | null;
  keyDeliverables: string | null;
  expectedHeadcount: number;
  status: OrgStatus;
  sortOrder: number;
};

export type OrgAssignment = {
  id: string;
  organizationId: string;
  positionId: string;
  personId: string;
  assignmentType: AssignmentType;
  startDate: string;
  endDate: string | null;
  status: "active" | "ended";
  notes: string | null;
};

/** Contagens reais de responsabilidade operacional, por usuário interno. */
export type OwnerWorkload = {
  objectives: number;
  kpis: number;
  actions: number;
  routines: number;
};

export const EMPTY_WORKLOAD: OwnerWorkload = { objectives: 0, kpis: 0, actions: 0, routines: 0 };

export type OrgIssueCode =
  | "position.vacant"
  | "position.over_headcount"
  | "position.no_parent"
  | "position.scope_mismatch"
  | "person.without_primary"
  | "person.multiple_primary"
  | "definition.purpose"
  | "definition.responsibilities"
  | "definition.authority"
  | "definition.deliverables";

export type OrgIssue = {
  code: OrgIssueCode;
  message: string;
  positionId?: string;
  personId?: string;
};

export type OrgOccupant = {
  assignment: OrgAssignment;
  person: OrgPerson;
};

export type OrgTreeNode = {
  position: OrgPosition;
  occupants: OrgOccupant[];
  children: OrgTreeNode[];
  depth: number;
  vacant: boolean;
  completeness: DefinitionCompleteness;
};

export type DefinitionCompleteness = {
  /** 0, 25, 50, 75 ou 100 */
  percent: number;
  missing: Array<"purpose" | "responsibilities" | "authority" | "deliverables">;
  complete: boolean;
};

export const SCOPE_RANK: Record<string, number> = {
  organization: 0,
  company: 1,
  business_unit: 2,
  department: 3,
};

/* --------------------------------------------------------- funções puras */

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function filled(value: string | null | undefined): boolean {
  return normalizeText(value).length > 0;
}

/** Avalia propósito, responsabilidades, autoridade e entregas-chave. */
export function positionDefinitionCompleteness(position: {
  purpose: string | null;
  responsibilities: string | null;
  decisionAuthority: string | null;
  keyDeliverables: string | null;
}): DefinitionCompleteness {
  const missing: DefinitionCompleteness["missing"] = [];
  if (!filled(position.purpose)) missing.push("purpose");
  if (!filled(position.responsibilities)) missing.push("responsibilities");
  if (!filled(position.decisionAuthority)) missing.push("authority");
  if (!filled(position.keyDeliverables)) missing.push("deliverables");
  return {
    percent: (4 - missing.length) * 25,
    missing,
    complete: missing.length === 0,
  };
}

function activePrimary(assignments: OrgAssignment[]): OrgAssignment[] {
  return assignments.filter((a) => a.status === "active" && a.assignmentType === "primary");
}

/** Monta a árvore. Posições sem chefia (ou com chefia invisível) viram raízes. */
export function buildOrgTree(
  positions: OrgPosition[],
  assignments: OrgAssignment[],
  people: OrgPerson[],
): OrgTreeNode[] {
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const known = new Set(positions.map((p) => p.id));
  const activeAssignments = assignments.filter((a) => a.status === "active");

  const occupantsOf = (positionId: string): OrgOccupant[] =>
    activeAssignments
      .filter((a) => a.positionId === positionId)
      .map((assignment) => {
        const person = peopleById.get(assignment.personId);
        return person ? { assignment, person } : null;
      })
      .filter((o): o is OrgOccupant => o !== null)
      .sort(
        (a, b) =>
          typeRank(a.assignment.assignmentType) - typeRank(b.assignment.assignmentType) ||
          a.person.fullName.localeCompare(b.person.fullName, "pt-BR"),
      );

  const byParent = new Map<string | null, OrgPosition[]>();
  for (const position of positions) {
    const parent =
      position.parentPositionId && known.has(position.parentPositionId)
        ? position.parentPositionId
        : null;
    const list = byParent.get(parent) ?? [];
    list.push(position);
    byParent.set(parent, list);
  }

  const sortPositions = (list: OrgPosition[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "pt-BR"));

  const build = (parentId: string | null, depth: number, seen: Set<string>): OrgTreeNode[] =>
    sortPositions(byParent.get(parentId) ?? [])
      .filter((position) => !seen.has(position.id))
      .map((position) => {
        const nextSeen = new Set(seen).add(position.id);
        const occupants = occupantsOf(position.id);
        const primaries = occupants.filter((o) => o.assignment.assignmentType === "primary");
        return {
          position,
          occupants,
          children: build(position.id, depth + 1, nextSeen),
          depth,
          vacant: position.status === "active" && primaries.length === 0,
          completeness: positionDefinitionCompleteness(position),
        };
      });

  return build(null, 0, new Set());
}

function typeRank(type: AssignmentType): number {
  return type === "primary" ? 0 : type === "acting" ? 1 : 2;
}

export function flattenTree(nodes: OrgTreeNode[]): OrgTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Escopo do filho deve ser o mesmo ou descendente do escopo da chefia. */
export function scopeIsSameOrDescendant(
  candidateScopeId: string,
  ancestorScopeId: string,
  scopes: ScopeNode[],
): boolean {
  const byId = new Map(scopes.map((s) => [s.id, s]));
  let cursor: string | null | undefined = candidateScopeId;
  let guard = 0;
  while (cursor && guard < 32) {
    if (cursor === ancestorScopeId) return true;
    cursor = byId.get(cursor)?.parent_scope_id ?? null;
    guard += 1;
  }
  return false;
}

export function validateOrgChart(input: {
  positions: OrgPosition[];
  people: OrgPerson[];
  assignments: OrgAssignment[];
  scopes?: ScopeNode[];
}): OrgIssue[] {
  const { positions, people, assignments } = input;
  const scopes = input.scopes ?? [];
  const issues: OrgIssue[] = [];
  const byId = new Map(positions.map((p) => [p.id, p]));
  const primaries = activePrimary(assignments);
  const activePositions = positions.filter((p) => p.status === "active");

  for (const position of activePositions) {
    const occupied = primaries.filter((a) => a.positionId === position.id).length;
    if (occupied === 0) {
      issues.push({
        code: "position.vacant",
        positionId: position.id,
        message: `Cargo vago: “${position.title}” está ativo e sem titular.`,
      });
    }
    if (occupied > position.expectedHeadcount) {
      issues.push({
        code: "position.over_headcount",
        positionId: position.id,
        message: `“${position.title}” tem ${occupied} titulares ativos e o previsto é ${position.expectedHeadcount}.`,
      });
    }

    const completeness = positionDefinitionCompleteness(position);
    for (const gap of completeness.missing) {
      issues.push({
        code: DEFINITION_ISSUE[gap],
        positionId: position.id,
        message: `${DEFINITION_LABEL[gap]} não definido em “${position.title}”.`,
      });
    }

    const parent = position.parentPositionId ? byId.get(position.parentPositionId) : undefined;
    const isRoot = scopeRankOf(position.scopeId, scopes) === 0;
    if (!position.parentPositionId && !isRoot) {
      issues.push({
        code: "position.no_parent",
        positionId: position.id,
        message: `“${position.title}” não é posição raiz e está sem chefia definida.`,
      });
    }
    if (
      parent &&
      scopes.length > 0 &&
      !scopeIsSameOrDescendant(position.scopeId, parent.scopeId, scopes)
    ) {
      issues.push({
        code: "position.scope_mismatch",
        positionId: position.id,
        message: `Escopo de “${position.title}” é incompatível com o escopo da chefia “${parent.title}”.`,
      });
    }
  }

  for (const person of people.filter((p) => p.status === "active")) {
    const mine = primaries.filter((a) => a.personId === person.id);
    if (mine.length === 0) {
      issues.push({
        code: "person.without_primary",
        personId: person.id,
        message: `${person.fullName} está ativa e não ocupa nenhuma posição como titular.`,
      });
    }
    if (mine.length > 1) {
      issues.push({
        code: "person.multiple_primary",
        personId: person.id,
        message: `${person.fullName} aparece como titular em ${mine.length} posições ao mesmo tempo.`,
      });
    }
  }

  return issues;
}

const DEFINITION_ISSUE: Record<DefinitionCompleteness["missing"][number], OrgIssueCode> = {
  purpose: "definition.purpose",
  responsibilities: "definition.responsibilities",
  authority: "definition.authority",
  deliverables: "definition.deliverables",
};

const DEFINITION_LABEL: Record<DefinitionCompleteness["missing"][number], string> = {
  purpose: "Propósito da função",
  responsibilities: "Responsabilidades",
  authority: "Autoridade de decisão",
  deliverables: "Entregas-chave",
};

export function definitionLabel(gap: DefinitionCompleteness["missing"][number]): string {
  return DEFINITION_LABEL[gap];
}

function scopeRankOf(scopeId: string, scopes: ScopeNode[]): number {
  const scope = scopes.find((s) => s.id === scopeId);
  if (!scope) return 0;
  return SCOPE_RANK[scope.scope_type] ?? 0;
}

export type PersonResponsibility = {
  person: OrgPerson;
  positionTitles: string[];
  linkedUser: boolean;
  workload: OwnerWorkload;
  hasWork: boolean;
};

/**
 * Responsabilidade operacional real. Só é agregada quando a pessoa possui user_id;
 * sem vínculo de acesso nada é inferido.
 */
export function responsibilitySummary(
  people: OrgPerson[],
  assignments: OrgAssignment[],
  positions: OrgPosition[],
  workloadByUser: Record<string, OwnerWorkload>,
): PersonResponsibility[] {
  const titleById = new Map(positions.map((p) => [p.id, p.title]));
  return people.map((person) => {
    const titles = assignments
      .filter((a) => a.personId === person.id && a.status === "active")
      .map((a) => titleById.get(a.positionId))
      .filter((t): t is string => Boolean(t))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const workload = person.userId
      ? (workloadByUser[person.userId] ?? EMPTY_WORKLOAD)
      : EMPTY_WORKLOAD;
    const total = workload.objectives + workload.kpis + workload.actions + workload.routines;
    return {
      person,
      positionTitles: titles,
      linkedUser: Boolean(person.userId),
      workload,
      hasWork: Boolean(person.userId) && total > 0,
    };
  });
}

export type Situation = "all" | "occupied" | "vacant" | "incomplete";

export function matchesFilters(
  node: OrgTreeNode,
  filters: {
    search?: string;
    scopeId?: string | null;
    status?: "all" | OrgStatus;
    situation?: Situation;
  },
): boolean {
  const search = normalizeText(filters.search).toLowerCase();
  if (search) {
    const haystack = [node.position.title, ...node.occupants.map((o) => o.person.fullName)]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  if (filters.scopeId && node.position.scopeId !== filters.scopeId) return false;
  const status = filters.status ?? "all";
  if (status !== "all" && node.position.status !== status) return false;
  const situation = filters.situation ?? "all";
  if (situation === "vacant" && !node.vacant) return false;
  if (situation === "occupied" && node.occupants.length === 0) return false;
  if (situation === "incomplete" && node.completeness.complete) return false;
  return true;
}

export type OrgSummary = {
  activePositions: number;
  occupied: number;
  vacant: number;
  peopleWithoutPosition: number;
  incompleteDefinitions: number;
};

export type OrgChartFilters = {
  search?: string;
  scopeId?: string | null;
  status?: "all" | OrgStatus;
  situation?: Situation;
};

/** Filtro canônico F8.5-A: aplica busca/situação preservando a hierarquia dos nós mantidos. */
export function filterOrgChart(nodes: OrgTreeNode[], filters: OrgChartFilters): OrgTreeNode[] {
  const walk = (list: OrgTreeNode[]): OrgTreeNode[] =>
    list.flatMap((node) => {
      const children = walk(node.children);
      if (matchesFilters(node, filters)) return [{ ...node, children }];
      return children;
    });
  return walk(nodes);
}

type OrgSummaryLegacy = {
  activePositions: number;
  occupied: number;
  vacant: number;
  peopleWithoutPosition: number;
  incompleteDefinitions: number;
};

export function orgSummary(
  positions: OrgPosition[],
  people: OrgPerson[],
  assignments: OrgAssignment[],
): OrgSummaryLegacy {
  const active = positions.filter((p) => p.status === "active");
  const primaries = activePrimary(assignments);
  const occupied = active.filter((p) => primaries.some((a) => a.positionId === p.id)).length;
  const peopleWithoutPosition = people.filter(
    (p) => p.status === "active" && !primaries.some((a) => a.personId === p.id),
  ).length;
  return {
    activePositions: active.length,
    occupied,
    vacant: active.length - occupied,
    peopleWithoutPosition,
    incompleteDefinitions: active.filter((p) => !positionDefinitionCompleteness(p).complete).length,
  };
}

/** Ações de gestão visíveis. Nada aqui autoriza: a RLS é a fonte de verdade. */
export function orgManagementActions(canManage: boolean): {
  canCreatePosition: boolean;
  canEditPosition: boolean;
  canCreatePerson: boolean;
  canAssign: boolean;
  canEndAssignment: boolean;
} {
  return {
    canCreatePosition: canManage,
    canEditPosition: canManage,
    canCreatePerson: canManage,
    canAssign: canManage,
    canEndAssignment: canManage,
  };
}

/**
 * Ações do organograma por capacidade declarada pelo banco (structure.read / structure.manage).
 * Função pura de apresentação: não autoriza nada, apenas reflete o que a RLS já permite.
 */
export function orgChartActions(
  canRead: boolean,
  canManage: boolean,
): {
  canView: boolean;
  canCreatePosition: boolean;
  canEditPosition: boolean;
  canCreatePerson: boolean;
  canAssign: boolean;
  canEndAssignment: boolean;
} {
  const manage = canRead && canManage;
  return { canView: canRead, ...orgManagementActions(manage) };
}

/* --------------------------------------------------------- leitura (RLS) */

type PositionRow = {
  id: string;
  organization_id: string;
  scope_id: string;
  parent_position_id: string | null;
  title: string;
  purpose: string | null;
  responsibilities_text: string | null;
  decision_authority_text: string | null;
  key_deliverables_text: string | null;
  expected_headcount: number;
  status: string;
  sort_order: number;
};

function mapPosition(row: PositionRow): OrgPosition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    scopeId: row.scope_id,
    parentPositionId: row.parent_position_id,
    title: row.title,
    purpose: row.purpose,
    responsibilities: row.responsibilities_text,
    decisionAuthority: row.decision_authority_text,
    keyDeliverables: row.key_deliverables_text,
    expectedHeadcount: row.expected_headcount,
    status: row.status === "inactive" ? "inactive" : "active",
    sortOrder: row.sort_order,
  };
}

export type OrgChartData = {
  positions: OrgPosition[];
  people: OrgPerson[];
  assignments: OrgAssignment[];
  scopes: ScopeNode[];
  workloadByUser: Record<string, OwnerWorkload>;
  organizationId: string | null;
};

export async function fetchOrgChart(): Promise<OrgChartData> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new SessionExpiredError();

  const [positionsRes, peopleRes, assignmentsRes, scopesRes] = await Promise.all([
    supabase
      .from("organizational_positions")
      .select(
        "id, organization_id, scope_id, parent_position_id, title, purpose, responsibilities_text, decision_authority_text, key_deliverables_text, expected_headcount, status, sort_order",
      )
      .order("sort_order")
      .order("title"),
    supabase
      .from("org_people")
      .select(
        "id, organization_id, home_scope_id, user_id, full_name, work_email, employee_code, status",
      )
      .order("full_name"),
    supabase
      .from("position_assignments")
      .select(
        "id, organization_id, position_id, person_id, assignment_type, start_date, end_date, status, notes",
      )
      .order("start_date", { ascending: false }),
    supabase
      .from("scopes")
      .select(
        "id, parent_scope_id, scope_type, label, organization_id, target_table, target_id, status",
      )
      .order("scope_type"),
  ]);

  for (const res of [positionsRes, peopleRes, assignmentsRes, scopesRes]) {
    if (res.error) translateError(res.error);
  }

  const positions = (positionsRes.data ?? []).map((row) => mapPosition(row as PositionRow));
  const people: OrgPerson[] = (peopleRes.data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    homeScopeId: row.home_scope_id,
    userId: row.user_id,
    fullName: row.full_name,
    workEmail: row.work_email,
    employeeCode: row.employee_code,
    status: row.status === "inactive" ? "inactive" : "active",
  }));
  const assignments: OrgAssignment[] = (assignmentsRes.data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    positionId: row.position_id,
    personId: row.person_id,
    assignmentType: row.assignment_type as AssignmentType,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status === "ended" ? "ended" : "active",
    notes: row.notes,
  }));

  const workloadByUser = await fetchWorkload();

  return {
    positions,
    people,
    assignments,
    scopes: (scopesRes.data ?? []) as ScopeNode[],
    workloadByUser,
    organizationId: positions[0]?.organizationId ?? people[0]?.organizationId ?? null,
  };
}

/** Vínculos reais existentes por owner_user_id — nada é inferido. */
export async function fetchWorkload(): Promise<Record<string, OwnerWorkload>> {
  const [objectives, kpis, actions, routines] = await Promise.all([
    supabase.from("strategic_objectives").select("owner_user_id").not("owner_user_id", "is", null),
    supabase.from("kpis").select("owner_user_id").not("owner_user_id", "is", null),
    supabase.from("action_plans").select("owner_user_id").not("owner_user_id", "is", null),
    supabase.from("routine_templates").select("owner_user_id").not("owner_user_id", "is", null),
  ]);

  const out: Record<string, OwnerWorkload> = {};
  const bump = (userId: string | null, key: keyof OwnerWorkload) => {
    if (!userId) return;
    out[userId] = { ...(out[userId] ?? EMPTY_WORKLOAD) };
    out[userId]![key] += 1;
  };
  // erros de leitura aqui não invalidam o organograma: apenas não há contagem.
  if (!objectives.error) for (const r of objectives.data ?? []) bump(r.owner_user_id, "objectives");
  if (!kpis.error) for (const r of kpis.data ?? []) bump(r.owner_user_id, "kpis");
  if (!actions.error) for (const r of actions.data ?? []) bump(r.owner_user_id, "actions");
  if (!routines.error) for (const r of routines.data ?? []) bump(r.owner_user_id, "routines");
  return out;
}

/* ------------------------------------------------------- escrita (RLS) */

export type PositionInput = {
  scopeId: string;
  parentPositionId: string | null;
  title: string;
  purpose: string | null;
  responsibilities: string | null;
  decisionAuthority: string | null;
  keyDeliverables: string | null;
  expectedHeadcount: number;
  sortOrder: number;
};

export async function createPosition(organizationId: string, input: PositionInput): Promise<void> {
  const { error } = await supabase.from("organizational_positions").insert({
    organization_id: organizationId,
    scope_id: input.scopeId,
    parent_position_id: input.parentPositionId,
    title: input.title.trim(),
    purpose: input.purpose,
    responsibilities_text: input.responsibilities,
    decision_authority_text: input.decisionAuthority,
    key_deliverables_text: input.keyDeliverables,
    expected_headcount: input.expectedHeadcount,
    sort_order: input.sortOrder,
  });
  if (error) translateError(error);
}

export async function updatePosition(id: string, input: PositionInput): Promise<void> {
  const { error } = await supabase
    .from("organizational_positions")
    .update({
      scope_id: input.scopeId,
      parent_position_id: input.parentPositionId,
      title: input.title.trim(),
      purpose: input.purpose,
      responsibilities_text: input.responsibilities,
      decision_authority_text: input.decisionAuthority,
      key_deliverables_text: input.keyDeliverables,
      expected_headcount: input.expectedHeadcount,
      sort_order: input.sortOrder,
    })
    .eq("id", id);
  if (error) translateError(error);
}

export async function setPositionStatus(id: string, status: OrgStatus): Promise<void> {
  const { error } = await supabase.from("organizational_positions").update({ status }).eq("id", id);
  if (error) translateError(error);
}

export type PersonInput = {
  homeScopeId: string;
  fullName: string;
  workEmail: string | null;
  employeeCode: string | null;
  userId: string | null;
};

export async function createPerson(organizationId: string, input: PersonInput): Promise<void> {
  const { error } = await supabase.from("org_people").insert({
    organization_id: organizationId,
    home_scope_id: input.homeScopeId,
    full_name: input.fullName.trim(),
    work_email: input.workEmail,
    employee_code: input.employeeCode,
    user_id: input.userId,
  });
  if (error) translateError(error);
}

export async function updatePerson(id: string, input: PersonInput): Promise<void> {
  const { error } = await supabase
    .from("org_people")
    .update({
      home_scope_id: input.homeScopeId,
      full_name: input.fullName.trim(),
      work_email: input.workEmail,
      employee_code: input.employeeCode,
      user_id: input.userId,
    })
    .eq("id", id);
  if (error) translateError(error);
}

export async function setPersonStatus(id: string, status: OrgStatus): Promise<void> {
  const { error } = await supabase.from("org_people").update({ status }).eq("id", id);
  if (error) translateError(error);
}

export async function assignPerson(
  organizationId: string,
  input: {
    positionId: string;
    personId: string;
    assignmentType: AssignmentType;
    startDate: string;
    notes: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("position_assignments").insert({
    organization_id: organizationId,
    position_id: input.positionId,
    person_id: input.personId,
    assignment_type: input.assignmentType,
    start_date: input.startDate,
    notes: input.notes,
  });
  if (error) translateError(error);
}

export async function endAssignment(id: string, endDate: string): Promise<void> {
  const { error } = await supabase
    .from("position_assignments")
    .update({ status: "ended", end_date: endDate })
    .eq("id", id);
  if (error) translateError(error);
}

/** Substituição de ocupante: encerra a atribuição anterior e cria a nova. */
export async function replaceOccupant(
  organizationId: string,
  input: {
    previousAssignmentId: string;
    positionId: string;
    personId: string;
    assignmentType: AssignmentType;
    startDate: string;
    notes: string | null;
  },
): Promise<void> {
  await endAssignment(input.previousAssignmentId, input.startDate);
  await assignPerson(organizationId, input);
}

export async function changeParentPosition(
  id: string,
  parentPositionId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("organizational_positions")
    .update({ parent_position_id: parentPositionId })
    .eq("id", id);
  if (error) translateError(error);
}

/** Usuários internos disponíveis para vínculo (leitura sujeita à RLS de users). */
export async function fetchLinkableUsers(): Promise<Array<{ id: string; label: string }>> {
  const { data, error } = await supabase.from("users").select("id, status").eq("status", "active");
  if (error) return [];
  return (data ?? []).map((u) => ({ id: u.id, label: u.id.slice(0, 8) }));
}
