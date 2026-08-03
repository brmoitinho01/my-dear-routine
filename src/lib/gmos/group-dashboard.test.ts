import { describe, expect, it } from "vitest";
import {
  aggregateGroupDashboard,
  classifyKpi,
  latestValidatedByKpi,
  type GroupRaw,
  type RawKpi,
} from "./group-dashboard";

const kpi = (over: Partial<RawKpi> = {}): RawKpi => ({
  id: "k1",
  name: "KPI",
  businessUnitId: "u1",
  direction: "higher_better",
  unit: "%",
  targetValue: 100,
  targetMin: null,
  targetMax: null,
  status: "active",
  ...over,
});

describe("classifyKpi", () => {
  it("sem medição validada", () => {
    expect(classifyKpi(kpi(), null)).toBe("no_data");
  });
  it("maior é melhor", () => {
    expect(classifyKpi(kpi(), 100)).toBe("on_target");
    expect(classifyKpi(kpi(), 95)).toBe("attention");
    expect(classifyKpi(kpi(), 50)).toBe("critical");
  });
  it("menor é melhor", () => {
    const k = kpi({ direction: "lower_better", targetValue: 10 });
    expect(classifyKpi(k, 9)).toBe("on_target");
    expect(classifyKpi(k, 10.5)).toBe("attention");
    expect(classifyKpi(k, 30)).toBe("critical");
  });
  it("faixa ideal", () => {
    const k = kpi({ direction: "range", targetValue: null, targetMin: 10, targetMax: 20 });
    expect(classifyKpi(k, 15)).toBe("on_target");
    expect(classifyKpi(k, 20.5)).toBe("attention");
    expect(classifyKpi(k, 40)).toBe("critical");
  });
});

describe("latestValidatedByKpi", () => {
  it("ignora medições não validadas", () => {
    const map = latestValidatedByKpi([
      { id: "m1", kpiId: "k1", periodEnd: "2026-01-31", value: 10, status: "validated" },
      { id: "m2", kpiId: "k1", periodEnd: "2026-02-28", value: 99, status: "pending" },
    ]);
    expect(map.get("k1")?.id).toBe("m1");
  });
});

describe("aggregateGroupDashboard", () => {
  const raw: GroupRaw = {
    companies: [{ id: "c1", name: "Empresa 1", status: "active" }],
    units: [{ id: "u1", name: "Filial 1", companyId: "c1", status: "active" }],
    kpis: [kpi()],
    measurements: [
      { id: "m1", kpiId: "k1", periodEnd: "2026-01-31", value: 20, status: "validated" },
      { id: "m2", kpiId: "k1", periodEnd: "2026-02-28", value: 90, status: "pending" },
    ],
    actions: [
      {
        id: "a1",
        businessUnitId: "u1",
        title: "Ação vencida",
        dueDate: "2026-01-05",
        status: "in_progress",
        progress: 40,
      },
    ],
    executions: [
      { id: "e1", businessUnitId: "u1", dueDate: "2026-01-02", status: "pending", templateId: "t1" },
      {
        id: "e2",
        businessUnitId: "u1",
        dueDate: "2026-02-02",
        status: "completed",
        templateId: "t1",
      },
    ],
    risks: [
      {
        id: "r1",
        businessUnitId: "u1",
        title: "Risco alto",
        impact: "high",
        probability: "high",
        status: "open",
      },
    ],
    audit: [],
  };

  it("consolida contagens e pontos de atenção", () => {
    const d = aggregateGroupDashboard(raw, "2026-03-01");
    expect(d.summary.kpis.critical).toBe(1);
    expect(d.summary.actionsLate).toBe(1);
    expect(d.summary.routinesLate).toBe(1);
    expect(d.summary.measurementsPending).toBe(1);
    expect(d.summary.risksBySeverity.critical).toBe(1);
    expect(d.companies[0]!.adherence).toBe(50);
    expect(d.attention.map((a) => a.kind)).toEqual([
      "kpi",
      "risk",
      "action",
      "routine",
      "measurement",
    ]);
  });
});