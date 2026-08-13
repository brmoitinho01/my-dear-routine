import { describe, expect, it } from "vitest";
import {
  deriveExecutiveKpiStatus,
  filterExecutiveKpis,
  formatCompetence,
  formatExecutiveKpiTarget,
  formatExecutiveKpiValue,
  groupExecutiveKpisByCompany,
  pickLatestMeasurement,
  summarizeExecutiveKpis,
  type ExecutiveKpi,
} from "./executive-kpis";

function kpi(overrides: Partial<ExecutiveKpi> = {}): ExecutiveKpi {
  return {
    companyId: "c1",
    companyName: "Alpha",
    businessUnitId: "u1",
    businessUnitName: "Filial 1",
    planId: "p1",
    planTitle: "Ciclo 2026",
    kpiId: "k1",
    kpiName: "Indicador",
    unit: null,
    frequency: "monthly",
    direction: "higher_better",
    targetValue: 100,
    targetMin: null,
    targetMax: null,
    kpiStatus: "active",
    latestValue: 100,
    latestPeriodStart: "2026-06-01",
    latestPeriodEnd: "2026-06-30",
    latestMeasurementStatus: "validated",
    ...overrides,
  };
}

describe("deriveExecutiveKpiStatus", () => {
  it("higher_better acima da meta está na meta", () => {
    expect(deriveExecutiveKpiStatus(kpi({ latestValue: 120 }))).toBe("on_target");
  });
  it("higher_better igual à meta está na meta", () => {
    expect(deriveExecutiveKpiStatus(kpi({ latestValue: 100 }))).toBe("on_target");
  });
  it("higher_better abaixo da meta está fora da meta", () => {
    expect(deriveExecutiveKpiStatus(kpi({ latestValue: 99.9 }))).toBe("off_target");
  });
  it("lower_better abaixo/igual está na meta e acima está fora", () => {
    const base = { direction: "lower_better", targetValue: 10 };
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 9 }))).toBe("on_target");
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 10 }))).toBe("on_target");
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 11 }))).toBe("off_target");
  });
  it("range dentro, nos limites e fora", () => {
    const base = { direction: "range", targetValue: null, targetMin: 5, targetMax: 8 };
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 6 }))).toBe("on_target");
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 5 }))).toBe("on_target");
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 8 }))).toBe("on_target");
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 8.1 }))).toBe("off_target");
    expect(deriveExecutiveKpiStatus(kpi({ ...base, latestValue: 4.9 }))).toBe("off_target");
  });
  it("higher/lower sem meta => no_target", () => {
    expect(deriveExecutiveKpiStatus(kpi({ targetValue: null }))).toBe("no_target");
    expect(deriveExecutiveKpiStatus(kpi({ direction: "lower_better", targetValue: null }))).toBe(
      "no_target",
    );
  });
  it("range incompleto => no_target", () => {
    expect(
      deriveExecutiveKpiStatus(
        kpi({ direction: "range", targetValue: null, targetMin: 5, targetMax: null }),
      ),
    ).toBe("no_target");
    expect(
      deriveExecutiveKpiStatus(
        kpi({ direction: "range", targetValue: null, targetMin: null, targetMax: 8 }),
      ),
    ).toBe("no_target");
  });
  it("sem medição => no_measurement", () => {
    expect(deriveExecutiveKpiStatus(kpi({ latestValue: null }))).toBe("no_measurement");
  });
  it("valor 0 é medição válida", () => {
    expect(deriveExecutiveKpiStatus(kpi({ latestValue: 0 }))).toBe("off_target");
    expect(
      deriveExecutiveKpiStatus(kpi({ direction: "lower_better", targetValue: 5, latestValue: 0 })),
    ).toBe("on_target");
  });
  it("medição pendente não altera a matemática da meta", () => {
    expect(
      deriveExecutiveKpiStatus(kpi({ latestValue: 120, latestMeasurementStatus: "pending" })),
    ).toBe("on_target");
  });
});

describe("summarizeExecutiveKpis", () => {
  const list = [
    kpi({ kpiId: "a", latestValue: 120 }),
    kpi({ kpiId: "b", latestValue: 10 }),
    kpi({ kpiId: "c", targetValue: null }),
    kpi({ kpiId: "d", latestValue: null, latestPeriodEnd: null, latestMeasurementStatus: null }),
    kpi({ kpiId: "e", latestValue: 130, latestMeasurementStatus: "pending" }),
  ];
  it("conta cada situação", () => {
    const s = summarizeExecutiveKpis(list);
    expect(s).toMatchObject({
      total: 5,
      onTarget: 2,
      offTarget: 1,
      noTarget: 1,
      noMeasurement: 1,
      measured: 4,
      pendingValidation: 1,
    });
  });
  it("percentual usa apenas os comparáveis", () => {
    expect(summarizeExecutiveKpis(list).onTargetPercent).toBe(67);
    expect(summarizeExecutiveKpis([kpi({ latestValue: null })]).onTargetPercent).toBeNull();
  });
  it("competência máxima visível", () => {
    const s = summarizeExecutiveKpis([
      kpi({ latestPeriodEnd: "2026-03-31" }),
      kpi({ latestPeriodEnd: "2026-06-30" }),
    ]);
    expect(s.latestPeriodEnd).toBe("2026-06-30");
  });
});

describe("groupExecutiveKpisByCompany", () => {
  it("agrupa deterministicamente por empresa e unidade", () => {
    const groups = groupExecutiveKpisByCompany([
      kpi({
        kpiId: "z",
        kpiName: "Zeta",
        companyId: "c2",
        companyName: "Beta",
        businessUnitId: "u2",
        businessUnitName: "Filial 2",
      }),
      kpi({ kpiId: "a", kpiName: "Alfa" }),
      kpi({ kpiId: "m", kpiName: "Meta" }),
    ]);
    expect(groups.map((g) => g.companyName)).toEqual(["Alpha", "Beta"]);
    expect(groups[0]!.units[0]!.kpis.map((k) => k.kpiName)).toEqual(["Alfa", "Meta"]);
  });
  it("unidade sem KPI permanece representada", () => {
    const groups = groupExecutiveKpisByCompany(
      [],
      [
        {
          companyId: "c1",
          companyName: "Alpha",
          businessUnitId: "u1",
          businessUnitName: "Filial 1",
        },
      ],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.units[0]!.kpis).toEqual([]);
    expect(groups[0]!.summary.total).toBe(0);
  });
  it("não inclui unidade fora do escopo informado quando não há KPI dela", () => {
    const groups = groupExecutiveKpisByCompany(
      [kpi()],
      [
        {
          companyId: "c1",
          companyName: "Alpha",
          businessUnitId: "u1",
          businessUnitName: "Filial 1",
        },
      ],
    );
    expect(groups.flatMap((g) => g.units).map((u) => u.businessUnitId)).toEqual(["u1"]);
  });
});

describe("filterExecutiveKpis", () => {
  const list = [
    kpi({ kpiId: "a", latestValue: 120 }),
    kpi({ kpiId: "b", latestValue: 10, companyId: "c2", companyName: "Beta" }),
    kpi({ kpiId: "c", latestValue: 150, latestMeasurementStatus: "pending" }),
  ];
  it("filtra por empresa, situação e validação", () => {
    expect(
      filterExecutiveKpis(list, { companyId: "c2", status: "all", validation: "all" }),
    ).toHaveLength(1);
    expect(
      filterExecutiveKpis(list, { companyId: null, status: "off_target", validation: "all" }),
    ).toHaveLength(1);
    expect(
      filterExecutiveKpis(list, { companyId: null, status: "all", validation: "pending" }),
    ).toHaveLength(1);
  });
});

describe("formatação", () => {
  it("percentual e unidades sem casas excessivas", () => {
    expect(formatExecutiveKpiValue(12.5, "%")).toBe("12,5%");
    expect(formatExecutiveKpiValue(1234.567, "t")).toBe("1.234,57 t");
    expect(formatExecutiveKpiValue(1000, "R$")).toBe("R$ 1.000");
    expect(formatExecutiveKpiValue(0, "%")).toBe("0%");
    expect(formatExecutiveKpiValue(null, "%")).toBe("—");
  });
  it("meta por direção", () => {
    expect(formatExecutiveKpiTarget(kpi({ unit: "%" }))).toBe("≥ 100%");
    expect(formatExecutiveKpiTarget(kpi({ direction: "lower_better", unit: "%" }))).toBe("≤ 100%");
    expect(
      formatExecutiveKpiTarget(
        kpi({ direction: "range", targetValue: null, targetMin: 5, targetMax: 8, unit: "%" }),
      ),
    ).toBe("5% a 8%");
    expect(formatExecutiveKpiTarget(kpi({ targetValue: null }))).toBe("Sem meta");
  });
  it("competência curta", () => {
    expect(formatCompetence("2026-06-30")).toBe("jun/2026");
    expect(formatCompetence(null)).toBe("Sem medição");
  });
});

describe("pickLatestMeasurement", () => {
  it("escolhe por period_end e desempata por created_at", () => {
    const chosen = pickLatestMeasurement([
      { id: "1", periodEnd: "2026-05-31", createdAt: "2026-06-01T00:00:00Z" },
      { id: "2", periodEnd: "2026-06-30", createdAt: "2026-07-01T00:00:00Z" },
      { id: "3", periodEnd: "2026-06-30", createdAt: "2026-07-05T00:00:00Z" },
    ]);
    expect(chosen?.id).toBe("3");
  });
  it("sem medições retorna null", () => {
    expect(pickLatestMeasurement([])).toBeNull();
  });
});
