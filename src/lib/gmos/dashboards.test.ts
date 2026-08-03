import { describe, expect, it } from "vitest";
import { bucketByDue, DONE_EXECUTION_STATUS, onlyMine } from "./my-work";
import {
  canExecute,
  canOperateExecution,
  effectiveOwnerId,
  isMine,
  ownerDisplay,
  OWNER_UNDEFINED_LABEL,
} from "./routine-access";
import { buildTeamAggregates } from "./team-dashboard";
import {
  kpiHealth,
  latestValidated,
  pendingMeasurements,
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

describe("classificação por prazo (data base fixa 2026-02-01)", () => {
  it("separa atrasado, hoje, próximo e concluído", () => {
    const b = bucketByDue(
      [
        { dueDate: "2026-01-01", status: "pending" },
        { dueDate: "2026-02-01", status: "pending" },
        { dueDate: "2026-02-04", status: "pending" },
        { dueDate: "2026-01-28", status: "completed" },
      ],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.late).toHaveLength(1);
    expect(b.today).toHaveLength(1);
    expect(b.upcoming).toHaveLength(1);
    expect(b.doneRecent).toHaveLength(1);
  });
  it("amanhã e +7 dias ficam em upcoming", () => {
    const b = bucketByDue(
      [
        { dueDate: "2026-02-02", status: "pending" },
        { dueDate: "2026-02-08", status: "pending" },
      ],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.upcoming.map((i) => i.dueDate)).toEqual(["2026-02-02", "2026-02-08"]);
    expect(b.later).toHaveLength(0);
  });
  it("+8 dias vai para later e nunca para upcoming", () => {
    const b = bucketByDue(
      [{ dueDate: "2026-02-09", status: "pending" }],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.upcoming).toHaveLength(0);
    expect(b.later).toHaveLength(1);
  });
  it("item sem prazo fica em later, não em próximas", () => {
    const b = bucketByDue(
      [{ dueDate: null, status: "pending" }],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.upcoming).toHaveLength(0);
    expect(b.later).toHaveLength(1);
  });
  it("concluído há 14 dias é recente e há 15 dias é antigo", () => {
    const b = bucketByDue(
      [
        { dueDate: "2025-01-01", status: "completed", completedAt: "2026-01-18T10:00:00Z" },
        { dueDate: "2025-01-01", status: "completed", completedAt: "2026-01-17T10:00:00Z" },
      ],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.doneRecent).toHaveLength(1);
    expect(b.doneRecent[0]!.completedAt).toBe("2026-01-18T10:00:00Z");
    expect(b.doneOlder).toHaveLength(1);
  });
  it("usa updated_at da ação e cai para due_date quando ausente", () => {
    const b = bucketByDue(
      [
        { dueDate: "2025-01-01", status: "completed", updatedAt: "2026-01-25T10:00:00Z" },
        { dueDate: "2026-01-30", status: "cancelled" },
      ],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.doneRecent).toHaveLength(2);
  });
  it("conclusão sem nenhuma referência temporal não é recente", () => {
    const b = bucketByDue(
      [{ dueDate: null, status: "completed" }],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.doneRecent).toHaveLength(0);
    expect(b.doneOlder).toHaveLength(1);
  });
  it("ignora conclusões antigas fora da janela recente", () => {
    const b = bucketByDue(
      [{ dueDate: "2025-11-01", status: "completed" }],
      "2026-02-01",
      DONE_EXECUTION_STATUS,
    );
    expect(b.doneRecent).toHaveLength(0);
  });
  it("recorte pessoal ignora itens sem responsável", () => {
    const items = [{ ownerUserId: null }, { ownerUserId: "u1" }, { ownerUserId: "u2" }];
    expect(onlyMine(items, "u1")).toEqual([{ ownerUserId: "u1" }]);
    expect(onlyMine(items, null)).toEqual([]);
  });
});

describe("medições pendentes", () => {
  it("considera apenas status pending", () => {
    const rows = [
      m({ id: "a", status: "pending" }),
      m({ id: "b", status: "validated" }),
      m({ id: "c", status: "rejected" }),
    ];
    expect(pendingMeasurements(rows).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("canOperateExecution", () => {
  const base = { currentUserId: "u1", ownerUserId: "u1", canExecuteOwn: false, canManage: false };
  it("responsável com execute_own pode operar", () => {
    expect(canOperateExecution({ ...base, canExecuteOwn: true })).toBe(true);
  });
  it("responsável sem permissão não pode operar", () => {
    expect(canOperateExecution(base)).toBe(false);
  });
  it("não responsável com manage pode operar", () => {
    expect(canOperateExecution({ ...base, ownerUserId: "u2", canManage: true })).toBe(true);
  });
  it("não responsável sem manage não pode operar", () => {
    expect(canOperateExecution({ ...base, ownerUserId: "u2", canExecuteOwn: true })).toBe(false);
  });
  it("execução sem responsável exige manage", () => {
    expect(canOperateExecution({ ...base, ownerUserId: null, canExecuteOwn: true })).toBe(false);
  });
  it("fallback legado: owner do modelo só vale se a execução não tem owner", () => {
    expect(effectiveOwnerId(null, "u1")).toBe("u1");
    expect(effectiveOwnerId("u2", "u1")).toBe("u2");
    expect(canExecute({ executionOwnerId: null, templateOwnerId: "u1", meUserId: "u1" }, { canManage: false, canExecuteOwn: true }, "pending")).toBe(true);
    expect(canExecute({ executionOwnerId: "u2", templateOwnerId: "u1", meUserId: "u1" }, { canManage: false, canExecuteOwn: true }, "pending")).toBe(false);
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
          ownerUserId: null,
          businessUnitId: "bu",
        },
        {
          id: "b",
          title: "y",
          status: "completed",
          progress: 100,
          dueDate: "2026-01-01",
          ownerUserId: null,
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

describe("regras de execução própria (F7-B)", () => {
  const me = "user-me";
  it("responsável pode executar quando possui execução própria", () => {
    expect(
      canExecute(
        { executionOwnerId: me, meUserId: me },
        { canManage: false, canExecuteOwn: true },
        "pending",
      ),
    ).toBe(true);
  });
  it("colaborador não executa rotina de outra pessoa", () => {
    expect(
      canExecute(
        { executionOwnerId: "outro", meUserId: me },
        { canManage: false, canExecuteOwn: true },
        "pending",
      ),
    ).toBe(false);
  });
  it("gestor com routine.manage executa no escopo", () => {
    expect(
      canExecute(
        { executionOwnerId: "outro", meUserId: me },
        { canManage: true, canExecuteOwn: false },
        "pending",
      ),
    ).toBe(true);
  });
  it("execução concluída ou cancelada não aceita novo registro", () => {
    expect(
      canExecute(
        { executionOwnerId: me, meUserId: me },
        { canManage: true, canExecuteOwn: true },
        "completed",
      ),
    ).toBe(false);
  });
  it("rotina sem responsável nunca é considerada minha", () => {
    expect(isMine({ executionOwnerId: null, meUserId: me })).toBe(false);
    expect(ownerDisplay(null, me)).toBe(OWNER_UNDEFINED_LABEL);
  });
});

describe("agregados do painel da equipe (F7-B)", () => {
  it("separa hoje, atraso, próximas e pendências de validação", () => {
    const agg = buildTeamAggregates(
      {
        units: [],
        allUnits: [],
        activeTemplates: 0,
        risks: [],
        kpis: [],
        measurements: [m({ id: "m1", status: "draft" }), m({ id: "m2", status: "validated" })],
        actions: [
          {
            id: "a",
            title: "atrasada",
            status: "in_progress",
            progress: 10,
            dueDate: "2026-01-01",
            ownerUserId: null,
            businessUnitId: "bu",
          },
        ],
        executions: [
          {
            id: "e1",
            templateId: "t",
            ownerUserId: null,
            competenceDate: "2026-02-01",
            dueDate: "2026-02-01",
            status: "pending",
            businessUnitId: "bu",
          },
        ],
        audit: [],
        templates: [
          {
            id: "t",
            name: "Rotina",
            frequency: "daily",
            status: "active",
            ownerUserId: null,
            requiresEvidence: false,
            businessUnitId: "bu",
          },
        ],
      },
      "2026-02-01",
    );
    expect(agg.routines.today).toHaveLength(1);
    expect(agg.routines.withoutOwner).toBe(1);
    expect(agg.actions.late).toHaveLength(1);
    expect(agg.measurements.pendingCount).toBe(1);
    expect(agg.measurements.validatedCount).toBe(1);
    expect(agg.templatesWithoutOwner).toBe(1);
  });
});
