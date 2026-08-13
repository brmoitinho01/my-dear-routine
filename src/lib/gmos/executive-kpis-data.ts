// FASE F8.1-C — acesso a dados do Painel executivo de KPIs.
// Somente tabelas oficiais: kpis, kpi_measurements, strategic_plans + escopo já visível (RLS).
// Leitura pura: nenhuma escrita, nenhum seed, nenhum dado sintético.
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";
import { fetchWorkspaceOptions, type WorkspaceOption } from "./f3";
import {
  pickLatestMeasurement,
  type ExecutiveKpi,
  type ExecutiveScopeUnit,
} from "./executive-kpis";

export type ExecutiveKpiDataset = {
  units: ExecutiveScopeUnit[];
  kpis: ExecutiveKpi[];
};

export function toScopeUnits(options: WorkspaceOption[]): ExecutiveScopeUnit[] {
  return options.map((o) => ({
    companyId: o.companyId,
    companyName: o.companyName,
    businessUnitId: o.businessUnitId,
    businessUnitName: o.businessUnitName,
  }));
}

/**
 * Consolida os KPIs de TODAS as filiais visíveis ao perfil.
 * A RLS é a autoridade final; o `in(business_unit_id, ...)` é apenas recorte de leitura.
 */
export async function fetchExecutiveKpis(options?: {
  units?: WorkspaceOption[];
}): Promise<ExecutiveKpiDataset> {
  const workspaceOptions = options?.units ?? (await fetchWorkspaceOptions());
  const units = toScopeUnits(workspaceOptions);
  const ids = units.map((u) => u.businessUnitId);
  if (ids.length === 0) return { units, kpis: [] };

  const kpiRes = await supabase
    .from("kpis")
    .select(
      "id, name, unit, frequency, direction, target_value, target_min, target_max, status, plan_id, business_unit_id",
    )
    .in("business_unit_id", ids)
    .order("name");
  if (kpiRes.error) translateError(kpiRes.error);
  const kpiRows = kpiRes.data ?? [];
  if (kpiRows.length === 0) return { units, kpis: [] };

  const planIds = Array.from(new Set(kpiRows.map((k) => k.plan_id).filter(Boolean)));
  const kpiIds = kpiRows.map((k) => k.id);

  const [planRes, measurementRes] = await Promise.all([
    planIds.length
      ? supabase.from("strategic_plans").select("id, title").in("id", planIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase
      .from("kpi_measurements")
      .select("id, kpi_id, period_start, period_end, value, status, created_at")
      .in("kpi_id", kpiIds)
      .order("period_end", { ascending: false })
      .limit(5000),
  ]);
  if (planRes.error) translateError(planRes.error);
  if (measurementRes.error) translateError(measurementRes.error);

  const planTitleById = new Map((planRes.data ?? []).map((p) => [p.id, p.title]));
  const byKpi = new Map<
    string,
    Array<{
      id: string;
      periodStart: string;
      periodEnd: string;
      value: number;
      status: string;
      createdAt: string;
    }>
  >();
  for (const m of measurementRes.data ?? []) {
    const list = byKpi.get(m.kpi_id) ?? [];
    list.push({
      id: m.id,
      periodStart: m.period_start,
      periodEnd: m.period_end,
      value: Number(m.value),
      status: m.status,
      createdAt: m.created_at,
    });
    byKpi.set(m.kpi_id, list);
  }

  const unitById = new Map(units.map((u) => [u.businessUnitId, u]));

  const kpis: ExecutiveKpi[] = kpiRows
    .filter((k) => unitById.has(k.business_unit_id))
    .map((k) => {
      const unit = unitById.get(k.business_unit_id)!;
      const latest = pickLatestMeasurement(byKpi.get(k.id) ?? []);
      return {
        companyId: unit.companyId,
        companyName: unit.companyName,
        businessUnitId: unit.businessUnitId,
        businessUnitName: unit.businessUnitName,
        planId: k.plan_id ?? null,
        planTitle: k.plan_id ? (planTitleById.get(k.plan_id) ?? null) : null,
        kpiId: k.id,
        kpiName: k.name,
        unit: k.unit,
        frequency: k.frequency,
        direction: k.direction,
        targetValue: k.target_value === null ? null : Number(k.target_value),
        targetMin: k.target_min === null ? null : Number(k.target_min),
        targetMax: k.target_max === null ? null : Number(k.target_max),
        kpiStatus: k.status,
        latestValue: latest ? latest.value : null,
        latestPeriodStart: latest ? latest.periodStart : null,
        latestPeriodEnd: latest ? latest.periodEnd : null,
        latestMeasurementStatus: latest ? latest.status : null,
      } satisfies ExecutiveKpi;
    });

  return { units, kpis };
}