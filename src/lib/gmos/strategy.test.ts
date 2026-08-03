import { describe, expect, it } from "vitest";
import {
  isFilled,
  isSubmittable,
  parseCompleteness,
  pendingsBySection,
  stageProgress,
  workflowActions,
  type Pending,
} from "./strategy";

const fullIdentity = {
  mission: "Missão",
  vision: "Visão",
  valuesText: "Valores",
  strategicNorth: "Norte",
};

const fullDiagnostic = {
  contextSummary: "Contexto",
  strengths: "Forças",
  weaknesses: "Fraquezas",
  opportunities: "Oportunidades",
  threats: "Ameaças",
  strategicPriorities: "Prioridades",
};

function objectives(n: number, withOwner = true) {
  return Array.from({ length: n }, () => ({
    status: "active",
    ownerUserId: withOwner ? "u1" : null,
  }));
}

describe("isFilled", () => {
  it("rejeita vazio, nulo e espaços", () => {
    expect(isFilled(null)).toBe(false);
    expect(isFilled(undefined)).toBe(false);
    expect(isFilled("")).toBe(false);
    expect(isFilled("   ")).toBe(false);
    expect(isFilled(" x ")).toBe(true);
  });
});

describe("stageProgress", () => {
  it("etapa vazia não conta progresso", () => {
    const p = stageProgress({
      identity: null,
      diagnostic: null,
      objectives: [],
      kpis: [],
      reviewStatus: "draft",
      planStatus: "draft",
    });
    expect(p.percent).toBe(0);
    expect(p.stages.map((s) => s.complete)).toEqual([false, false, false, false, false]);
  });

  it("direcionamento completo apenas com os quatro campos", () => {
    const partial = stageProgress({
      identity: { ...fullIdentity, strategicNorth: "  " },
      diagnostic: null,
      objectives: [],
      kpis: [],
      reviewStatus: "draft",
      planStatus: "draft",
    });
    expect(partial.stages[0]!.done).toBe(3);
    expect(partial.stages[0]!.complete).toBe(false);
  });

  it("objetivos exigem de 3 a 7, responsável e KPI vinculado", () => {
    const p = stageProgress({
      identity: fullIdentity,
      diagnostic: fullDiagnostic,
      objectives: [
        { status: "active", ownerUserId: "u1" },
        { status: "active", ownerUserId: "u2" },
        { status: "active", ownerUserId: null },
      ],
      kpis: [{ status: "active", objectiveId: null, incomplete: true }],
      reviewStatus: "draft",
      planStatus: "draft",
    });
    expect(p.stages[2]!.done).toBe(1);
    expect(p.stages[3]!.done).toBe(1);
  });

  it("oito objetivos ativos reprovam a faixa", () => {
    const p = stageProgress({
      identity: fullIdentity,
      diagnostic: fullDiagnostic,
      objectives: objectives(8),
      kpis: [],
      reviewStatus: "draft",
      planStatus: "draft",
    });
    expect(p.stages[2]!.complete).toBe(false);
  });

  it("objetivo cancelado e KPI arquivado são ignorados", () => {
    const p = stageProgress({
      identity: fullIdentity,
      diagnostic: fullDiagnostic,
      objectives: [...objectives(3), { status: "cancelled", ownerUserId: null }],
      kpis: [
        { status: "active", objectiveId: "o1", incomplete: false },
        { status: "archived", objectiveId: null, incomplete: true },
      ],
      reviewStatus: "draft",
      planStatus: "draft",
    });
    expect(p.stages[3]!.complete).toBe(true);
  });

  it("revisão só fecha com aprovação e ciclo ativo", () => {
    const base = {
      identity: fullIdentity,
      diagnostic: fullDiagnostic,
      objectives: objectives(3),
      kpis: [{ status: "active", objectiveId: "o1", incomplete: false }],
    };
    expect(
      stageProgress({ ...base, reviewStatus: "approved", planStatus: "approved" }).stages[4]!.done,
    ).toBe(1);
    expect(
      stageProgress({ ...base, reviewStatus: "approved", planStatus: "active" }).stages[4]!
        .complete,
    ).toBe(true);
    expect(
      stageProgress({ ...base, reviewStatus: "in_review", planStatus: "draft" }).stages[4]!.done,
    ).toBe(0);
  });
});

describe("workflowActions", () => {
  const base = {
    canManage: true,
    canApprovePermission: false,
    reviewStatus: "draft",
    planStatus: "draft",
    ready: false,
    submittable: true,
  };

  it("gestor submete, mas nunca aprova nem ativa", () => {
    const a = workflowActions({ ...base, ready: true });
    expect(a.canSubmit).toBe(true);
    expect(a.canApprove).toBe(false);
    expect(a.canActivate).toBe(false);
  });

  it("sem submissão quando faltam direcionamento, diagnóstico ou objetivos", () => {
    expect(workflowActions({ ...base, submittable: false }).canSubmit).toBe(false);
  });

  it("colaborador sem strategy.manage não edita nem submete", () => {
    const a = workflowActions({ ...base, canManage: false });
    expect(a.canEdit).toBe(false);
    expect(a.canSubmit).toBe(false);
  });

  it("aprovação exige permissão e completude total", () => {
    expect(
      workflowActions({
        ...base,
        canApprovePermission: true,
        reviewStatus: "in_review",
        ready: false,
      }).canApprove,
    ).toBe(false);
    expect(
      workflowActions({
        ...base,
        canApprovePermission: true,
        reviewStatus: "in_review",
        ready: true,
      }).canApprove,
    ).toBe(true);
  });

  it("ativação exige aprovado, pronto e ainda não ativo", () => {
    const ok = workflowActions({
      ...base,
      canApprovePermission: true,
      reviewStatus: "approved",
      planStatus: "approved",
      ready: true,
    });
    expect(ok.canActivate).toBe(true);
    expect(ok.activateBlockedReason).toBeNull();

    const already = workflowActions({
      ...base,
      canApprovePermission: true,
      reviewStatus: "approved",
      planStatus: "active",
      ready: true,
    });
    expect(already.canActivate).toBe(false);
    expect(already.activateBlockedReason).toBe("Ciclo já está ativo.");

    const notApproved = workflowActions({
      ...base,
      canApprovePermission: true,
      reviewStatus: "in_review",
      ready: true,
    });
    expect(notApproved.activateBlockedReason).toBe(
      "O planejamento precisa ser aprovado antes da ativação.",
    );
  });

  it("já aprovado não pode ser submetido novamente", () => {
    expect(workflowActions({ ...base, reviewStatus: "approved" }).canSubmit).toBe(false);
    expect(workflowActions({ ...base, reviewStatus: "in_review" }).canSubmit).toBe(false);
  });
});

describe("pendências", () => {
  const pendings: Pending[] = [
    { code: "identity.mission", section: "direction", message: "Missão não preenchida." },
    { code: "diagnosis.missing", section: "diagnosis", message: "Diagnóstico não iniciado." },
    { code: "objectives.min", section: "objectives", message: "Mínimo de 3 objetivos." },
    { code: "kpi.incomplete", section: "kpis", message: "KPI incompleto." },
    { code: "x", section: "desconhecida", message: "Outra." },
  ];

  it("agrupa por seção e joga desconhecidas em other", () => {
    const g = pendingsBySection(pendings);
    expect(g.direction).toHaveLength(1);
    expect(g.diagnosis).toHaveLength(1);
    expect(g.objectives).toHaveLength(1);
    expect(g.kpis).toHaveLength(1);
    expect(g.other).toHaveLength(1);
  });

  it("isSubmittable bloqueia direcionamento, diagnóstico e mínimo de objetivos", () => {
    expect(isSubmittable(pendings)).toBe(false);
    expect(isSubmittable([{ code: "kpi.incomplete", section: "kpis", message: "" }])).toBe(true);
    expect(isSubmittable([{ code: "objectives.max", section: "objectives", message: "" }])).toBe(
      true,
    );
    expect(isSubmittable([])).toBe(true);
  });
});

describe("parseCompleteness", () => {
  it("normaliza retorno vazio sem quebrar", () => {
    const c = parseCompleteness(null);
    expect(c.ready).toBe(false);
    expect(c.counts.objectives).toBe(0);
    expect(c.pendings).toEqual([]);
  });

  it("preserva contagens e mensagens do banco", () => {
    const c = parseCompleteness({
      ready: true,
      planId: "p1",
      version: 2,
      status: "approved",
      reviewStatus: "approved",
      counts: { objectives: 4, kpisIncomplete: 1 },
      pendings: [{ code: "kpi.incomplete", section: "kpis", message: "KPI incompleto." }],
    });
    expect(c.ready).toBe(true);
    expect(c.counts.objectives).toBe(4);
    expect(c.counts.kpisIncomplete).toBe(1);
    expect(c.pendings[0]!.message).toBe("KPI incompleto.");
  });
});
