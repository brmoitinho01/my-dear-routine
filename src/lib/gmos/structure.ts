// FASE F1 — leitura da estrutura organizacional.
// Todas as consultas passam pelo cliente do navegador e respeitam a RLS.
import { supabase } from "@/integrations/supabase/client";

export class SessionExpiredError extends Error {
  constructor() {
    super("Sessão expirada. Entre novamente para continuar.");
    this.name = "SessionExpiredError";
  }
}

export class PermissionError extends Error {
  constructor() {
    super("Você não tem permissão para visualizar estas informações.");
    this.name = "PermissionError";
  }
}

type SupabaseError = { code?: string; message?: string } | null;

export function translateError(error: SupabaseError): never {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "PGRST301" || /JWT|token/i.test(message)) throw new SessionExpiredError();
  if (code === "42501" || /permission denied/i.test(message)) throw new PermissionError();
  throw new Error(message || "Não foi possível carregar os dados.");
}

export type StructureNode = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type StructureTree = {
  organization: OrganizationSummary | null;
  companies: Array<
    StructureNode & {
      businessUnits: Array<StructureNode & { departments: StructureNode[] }>;
    }
  >;
  counts: { companies: number; businessUnits: number; departments: number };
};

export async function fetchStructure(): Promise<StructureTree> {
  const [orgRes, companiesRes, unitsRes, departmentsRes] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, status").limit(1),
    supabase.from("companies").select("id, name, slug, status").order("name"),
    supabase.from("business_units").select("id, name, slug, status, company_id").order("name"),
    supabase.from("departments").select("id, name, slug, status, business_unit_id").order("name"),
  ]);

  for (const res of [orgRes, companiesRes, unitsRes, departmentsRes]) {
    if (res.error) translateError(res.error);
  }

  const units = unitsRes.data ?? [];
  const departments = departmentsRes.data ?? [];
  const companies = (companiesRes.data ?? []).map((company) => ({
    id: company.id,
    name: company.name,
    slug: String(company.slug),
    status: company.status,
    businessUnits: units
      .filter((unit) => unit.company_id === company.id)
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        slug: String(unit.slug),
        status: unit.status,
        departments: departments
          .filter((dept) => dept.business_unit_id === unit.id)
          .map((dept) => ({
            id: dept.id,
            name: dept.name,
            slug: String(dept.slug),
            status: dept.status,
          })),
      })),
  }));

  const org = orgRes.data?.[0];

  return {
    organization: org
      ? { id: org.id, name: org.name, slug: String(org.slug), status: org.status }
      : null,
    companies,
    counts: {
      companies: companies.length,
      businessUnits: units.length,
      departments: departments.length,
    },
  };
}

export type AccessAssignment = {
  id: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  roleName: string;
  roleCode: string;
  scopeLabel: string;
  scopeType: string;
};

export type AccessProfile = {
  internalUserId: string | null;
  status: string | null;
  preferredLocale: string | null;
  organizationName: string | null;
  assignments: AccessAssignment[];
};

const SCOPE_TYPE_LABELS: Record<string, string> = {
  organization: "Organização",
  company: "Empresa",
  business_unit: "Unidade",
  department: "Departamento",
  position: "Cargo",
  person: "Pessoa",
};

export function scopeTypeLabel(code: string): string {
  return SCOPE_TYPE_LABELS[code] ?? code;
}

export async function fetchMyAccess(): Promise<AccessProfile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new SessionExpiredError();

  const userRes = await supabase
    .from("users")
    .select("id, status, preferred_locale, organization_id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (userRes.error) translateError(userRes.error);

  const me = userRes.data;
  if (!me) {
    return {
      internalUserId: null,
      status: null,
      preferredLocale: null,
      organizationName: null,
      assignments: [],
    };
  }

  const [orgRes, uraRes] = await Promise.all([
    me.organization_id
      ? supabase.from("organizations").select("name").eq("id", me.organization_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("user_role_assignments")
      .select(
        "id, status, effective_from, effective_to, roles(name, code), scopes(label, scope_type)",
      )
      .eq("user_id", me.id)
      .order("created_at", { ascending: false }),
  ]);

  if (orgRes.error) translateError(orgRes.error);
  if (uraRes.error) translateError(uraRes.error);

  const assignments: AccessAssignment[] = (uraRes.data ?? []).map((row) => {
    const role = row.roles as { name?: string; code?: string } | null;
    const scope = row.scopes as { label?: string; scope_type?: string } | null;
    return {
      id: row.id,
      status: row.status,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      roleName: role?.name ?? "—",
      roleCode: String(role?.code ?? "—"),
      scopeLabel: scope?.label ?? "—",
      scopeType: scope?.scope_type ?? "—",
    };
  });

  return {
    internalUserId: me.id,
    status: me.status,
    preferredLocale: me.preferred_locale,
    organizationName: (orgRes.data as { name?: string } | null)?.name ?? null,
    assignments,
  };
}
