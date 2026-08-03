import { describe, expect, it } from "vitest";
import { bucketByDue, DONE_EXECUTION_STATUS } from "./my-work";
import {
  kpiHealth,
  latestValidated,
  riskSeverity,
  summarizeActions,
  summarizeRoutines,
  type KpiRow,
  type MeasurementRow,
} from "./group-dashboard";

const kpi = (over: Partial<KpiRow> = {}): KpiRow => ({
  id: "k1",
  name: "KPI",
  unit: null,
  direction: "higher_better",
  targetValue: 100,
  targetMin: null,
  targetMax: null,
  businessUnitId: "bu",
  ...over,
});

const m = (over: Partial<MeasurementRow> = {}): MeasurementRow => ({
  id: "m1",
  kpiId: "k1",
  periodEnd: "2026-01-31",
  value: 100,
  status: "validated",
  businessUnitId: "bu",
  ...over,
});

describe("classificação por prazo", () => {
  it("separa atrasado, hoje, próximo e concluído", () => {
    const b = bucketByDue(
      [
        { dueDate: "2026-01-01", status: "pending" },
        { dueDate: "2026-02-01", status: "pending" },
        { dueDate: "2026-03-01", status: "pending" },
        { dueDate: "2026-01-05", status: "completed" },
      ],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.late).toHaveLength(1);
    expect(b.today).toHaveLength(1);
    expect(b.upcoming).toHaveLength(1);
    expect(b.done).toHaveLength(1);
  });
});

describe("semáforo de KPI", () => {
  it("ignora medições não validadas", () => {
    expect(latestValidated([m({ status: "draft" })], "k1")).toBeNull();
    expect(kpiHealth(kpi(), null)).toBe("no_measurement");
  });
  it("avalia maior é melhor", () => {
    expect(kpiHealth(kpi(), m({ value: 100 }))).toBe("on_target");
    expect(kpiHealth(kpi(), m({ value: 95 }))).toBe("attention");
    expect(kpiHealth(kpi(), m({ value: 50 }))).toBe("critical");
  });
  it("avalia menor é melhor e faixa", () => {
    expect(kpiHealth(kpi({ direction: "lower_better" }), m({ value: 80 }))).toBe("on_target");
    expect(
      kpiHealth(
        kpi({ direction: "range", targetValue: null, targetMin: 10, targetMax: 20 }),
        m({ value: 15 }),
      ),
    ).toBe("on_target");
  });
});

describe("resumos operacionais", () => {
  it("conta atraso de ações e aderência de rotinas", () => {
    const actions = summarizeActions(
      [
        {
          id: "a",
          title: "x",
          status: "in_progress",
          progress: 50,
          dueDate: "2026-01-01",
          businessUnitId: "bu",
        },
        {
          id: "b",
          title: "y",
          status: "completed",
          progress: 100,
          dueDate: "2026-01-01",
          businessUnitId: "bu",
        },
      ],
      "2026-02-01",
    );
    expect(actions).toMatchObject({ total: 2, late: 1, completed: 1, averageProgress: 75 });

    const routines = summarizeRoutines(
      [
        {
          id: "e1",
          templateId: "t",
          status: "completed",
          dueDate: "2026-01-01",
          competenceDate: "2026-01-01",
          ownerUserId: null,
          businessUnitId: "bu",
        },
        {
          id: "e2",
          templateId: "t",
          status: "pending",
          dueDate: "2026-01-02",
          competenceDate: "2026-01-02",
          ownerUserId: null,
          businessUnitId: "bu",
        },
      ],
      "2026-02-01",
    );
    expect(routines).toMatchObject({
      planned: 2,
      completed: 1,
      pending: 1,
      late: 1,
      adherence: 50,
    });
  });
  it("deriva severidade de risco", () => {
    expect(
      riskSeverity({
        id: "r",
        title: "t",
        impact: "high",
        probability: "high",
        status: "open",
        businessUnitId: "bu",
      }),
    ).toBe("critical");
    expect(
      riskSeverity({
        id: "r",
        title: "t",
        impact: "low",
        probability: "low",
        status: "open",
        businessUnitId: "bu",
      }),
    ).toBe("low");
  });
});
