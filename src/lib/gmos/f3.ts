// FASE F3 — contexto corporativo: empresas e filiais visíveis ao usuário.
// A seleção de empresa/filial é apenas preferência de interface.
// Toda autorização continua no servidor (RLS + public.has_permission).
import { supabase } from "@/integrations/supabase/client";
import { SessionExpiredError, translateError } from "./structure";

export type WorkspaceOption = {
  organizationId: string;
  organizationName: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  companyStatus: string;
  businessUnitId: string;
  businessUnitName: string;
  businessUnitSlug: string;
  businessUnitStatus: string;
  scopeId: string | null;
};

export type Workspace = WorkspaceOption & {
  meUserId: string | null;
  meEmail: string | null;
  canStrategy: boolean;
  canAction: boolean;
  canRoutine: boolean;
};

export type Me = { meUserId: string | null; meEmail: string | null };

export async function fetchMe(): Promise<Me> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new SessionExpiredError();
  const meRes = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (meRes.error) translateError(meRes.error);
  return {
    meUserId: (meRes.data as { id?: string } | null)?.id ?? null,
    meEmail: auth.user.email ?? null,
  };
}

/** Lista somente as empresas/filiais que a RLS torna visíveis ao usuário atual. */
export async function fetchWorkspaceOptions(): Promise<WorkspaceOption[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new SessionExpiredError();

  const [orgRes, companiesRes, unitsRes, scopesRes] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("companies").select("id, name, slug, status, organization_id").order("name"),
    supabase
      .from("business_units")
      .select("id, name, slug, status, company_id, organization_id")
      .order("name"),
    supabase
      .from("scopes")
      .select("id, target_id")
      .eq("target_table", "public.business_units")
      .eq("scope_type", "business_unit"),
  ]);
  for (const r of [orgRes, companiesRes, unitsRes, scopesRes]) if (r.error) translateError(r.error);

  const orgById = new Map((orgRes.data ?? []).map((o) => [o.id, o.name]));
  const companyById = new Map((companiesRes.data ?? []).map((c) => [c.id, c]));
  const scopeByUnit = new Map(
    (scopesRes.data ?? []).map((s) => [String(s.target_id), String(s.id)]),
  );

  return (unitsRes.data ?? [])
    .map((u) => {
      const company = companyById.get(u.company_id);
      if (!company) return null;
      return {
        organizationId: u.organization_id,
        organizationName: orgById.get(u.organization_id) ?? "Grupo Moitinho",
        companyId: company.id,
        companyName: company.name,
        companySlug: String(company.slug),
        companyStatus: company.status,
        businessUnitId: u.id,
        businessUnitName: u.name,
        businessUnitSlug: String(u.slug),
        businessUnitStatus: u.status,
        scopeId: scopeByUnit.get(u.id) ?? null,
      } satisfies WorkspaceOption;
    })
    .filter((x): x is WorkspaceOption => x !== null)
    .sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "pt-BR") ||
      a.businessUnitName.localeCompare(b.businessUnitName, "pt-BR"),
    );
}

const MANAGE_CODES = ["strategy.manage", "action.manage", "routine.manage"] as const;

export type ScopePermissions = {
  canStrategy: boolean;
  canAction: boolean;
  canRoutine: boolean;
};

/** Consulta public.has_permission no scope da filial selecionada. Nunca compara papel ou e-mail. */
export async function fetchScopePermissions(scopeId: string | null): Promise<ScopePermissions> {
  if (!scopeId) return { canStrategy: false, canAction: false, canRoutine: false };
  const results = await Promise.all(
    MANAGE_CODES.map(async (code) => {
      const { data, error } = await supabase.rpc("has_permission", {
        p_code: code,
        p_scope_type: "business_unit",
        p_scope_id: scopeId,
      });
      if (error) return false;
      return Boolean(data);
    }),
  );
  return { canStrategy: results[0], canAction: results[1], canRoutine: results[2] };
}

/* ---------------- resumo corporativo por filial ---------------- */

export type UnitSummary = {
  businessUnitId: string;
  plan: { id: string; title: string; status: string; cycleStart: string; cycleEnd: string } | null;
  objectives: number;
  kpis: number;
  actions: number;
  lateActions: number;
  routines: number;
  activeRoutines: number;
  pendingExecutions: number;
};

const countOf = async (
  table:
    | "strategic_objectives"
    | "kpis"
    | "action_plans"
    | "routine_templates"
    | "routine_executions",
  businessUnitId: string,
  extra?: (q: any) => any,
) => {
  let q = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("business_unit_id", businessUnitId);
  if (extra) q = extra(q);
  const { count, error } = await q;
  if (error) translateError(error);
  return count ?? 0;
};

export async function fetchUnitSummary(businessUnitId: string): Promise<UnitSummary> {
  const planRes = await supabase
    .from("strategic_plans")
    .select("id, title, status, cycle_start, cycle_end")
    .eq("business_unit_id", businessUnitId)
    .order("cycle_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planRes.error) translateError(planRes.error);

  const today = new Date().toISOString().slice(0, 10);

  const [objectives, kpis, actions, lateActions, routines, activeRoutines, pendingExecutions] =
    await Promise.all([
      countOf("strategic_objectives", businessUnitId),
      countOf("kpis", businessUnitId),
      countOf("action_plans", businessUnitId),
      countOf("action_plans", businessUnitId, (q) =>
        q.lt("due_date", today).not("status", "in", "(completed,cancelled)"),
      ),
      countOf("routine_templates", businessUnitId),
      countOf("routine_templates", businessUnitId, (q) => q.eq("status", "active")),
      countOf("routine_executions", businessUnitId, (q) => q.eq("status", "pending")),
    ]);

  const p = planRes.data;
  return {
    businessUnitId,
    plan: p
      ? {
          id: p.id,
          title: p.title,
          status: p.status,
          cycleStart: p.cycle_start,
          cycleEnd: p.cycle_end,
        }
      : null,
    objectives,
    kpis,
    actions,
    lateActions,
    routines,
    activeRoutines,
    pendingExecutions,
  };
}
