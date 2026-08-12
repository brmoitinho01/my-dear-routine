// F12.1-C2A — estado central da Jornada: progresso real e retomada segura.
import { describe, expect, it } from "vitest";
import {
  deriveJourneyStatus,
  resolveJourneyResumeStep,
  type Dimension,
  type JourneyStatusInput,
} from "./strategy-recommendations";

function input(over: Partial<JourneyStatusInput> = {}): JourneyStatusInput {
  return {
    hasProfile: false,
    maturity: { complete: false, answered: 0, total: 10 },
    diagnosisReviewed: false,
    diagnosisSignals: 0,
    priorityDimensions: [],
    pendingObjectiveTemplateIds: [],
    appliedObjectives: 0,
    existingObjectives: 0,
    hasPlan: false,
    planEditable: false,
    kpiSelections: [],
    templateKpis: [],
    ...over,
  };
}

const prios: Dimension[] = ["finance", "operations"];

function kpi(objectiveId: string, id: string) {
  return {
    id,
    templateObjectiveId: objectiveId,
    code: id,
    name: id,
    kpiClass: "result" as const,
    description: null,
    unit: null,
    formula: null,
    sourceHint: null,
    direction: "up",
    frequency: "monthly",
    sortOrder: 1,
  };
}

const objIds = ["a", "b", "c"];
const draftKpis = objIds.map((o) => kpi(o, `k-${o}`));
const draftSelections = objIds.map((o) => ({
  templateObjectiveId: o,
  templateKpiId: `k-${o}`,
  decision: "accepted" as const,
}));

describe("deriveJourneyStatus", () => {
  it("jornada intocada: 0% e fase not_started", () => {
    const s = deriveJourneyStatus(input());
    expect(s.phase).toBe("not_started");
    expect(s.percent).toBe(0);
    expect(s.resumeStep).toBe("profile");
  });

  it("maturidade parcial não conclui a etapa", () => {
    const s = deriveJourneyStatus(
      input({ hasProfile: true, maturity: { complete: false, answered: 6, total: 10 } }),
    );
    expect(s.phase).toBe("maturity");
    expect(s.completedSteps).toEqual(["profile"]);
  });

  it("diagnóstico só conclui com revisão confirmada, mesmo com sinais", () => {
    const base = input({
      hasProfile: true,
      maturity: { complete: true, answered: 10, total: 10 },
      diagnosisSignals: 4,
    });
    expect(deriveJourneyStatus(base).phase).toBe("diagnosis");
    expect(deriveJourneyStatus({ ...base, diagnosisReviewed: true }).phase).toBe("priorities");
  });

  it("revisão com 0 sinais é válida", () => {
    const s = deriveJourneyStatus(
      input({
        hasProfile: true,
        maturity: { complete: true, answered: 10, total: 10 },
        diagnosisSignals: 0,
        diagnosisReviewed: true,
      }),
    );
    expect(s.completedSteps).toContain("diagnosis");
  });

  it("rascunho válido em ciclo editável fica pronto para aplicar", () => {
    const s = deriveJourneyStatus(
      input({
        hasProfile: true,
        maturity: { complete: true, answered: 10, total: 10 },
        diagnosisReviewed: true,
        priorityDimensions: prios,
        pendingObjectiveTemplateIds: objIds,
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.phase).toBe("ready_to_apply");
    expect(s.readyToApply).toBe(true);
  });

  it("após aplicar sem pendências: formalizing_plan e nunca 100%", () => {
    const s = deriveJourneyStatus(
      input({
        hasProfile: true,
        maturity: { complete: true, answered: 10, total: 10 },
        diagnosisReviewed: true,
        priorityDimensions: prios,
        appliedObjectives: 3,
        existingObjectives: 3,
        hasPlan: true,
      }),
    );
    expect(s.phase).toBe("formalizing_plan");
    expect(s.applied).toBe(true);
    expect(s.percent).toBeLessThan(100);
    expect(s.nextAction.href).toBe("/planejamento");
  });

  it("retomada usa a etapa derivada e ignora etapa salva à frente do dado real", () => {
    const s = deriveJourneyStatus(input({ hasProfile: true }));
    expect(resolveJourneyResumeStep(s, "review")).toBe("maturity");
  });
});

/* ---------- F12.1-C2A.2 — cobertura de regressão da máquina central ---------- */

const ready = {
  hasProfile: true,
  maturity: { complete: true, answered: 10, total: 10 },
  diagnosisReviewed: true,
  priorityDimensions: prios,
};

describe("prioridades na máquina central", () => {
  it("diagnóstico revisado com 0 prioridades para na fase priorities e pede 1 a 3", () => {
    const s = deriveJourneyStatus(input({ ...ready, priorityDimensions: [] }));
    expect(s.phase).toBe("priorities");
    expect(s.priority.valid).toBe(false);
    expect(s.nextAction.step).toBe("priorities");
    expect(s.nextAction.label).toBe("Escolha de 1 a 3 prioridades");
  });

  it("1 prioridade libera o gate e leva a recommendations quando não há rascunho", () => {
    const s = deriveJourneyStatus(input({ ...ready, priorityDimensions: ["finance"] }));
    expect(s.priority.valid).toBe(true);
    expect(s.completedSteps).toContain("priorities");
    expect(s.phase).toBe("recommendations");
  });

  it("3 prioridades continuam válidas", () => {
    const s = deriveJourneyStatus(
      input({ ...ready, priorityDimensions: ["finance", "operations", "people"] }),
    );
    expect(s.priority.valid).toBe(true);
    expect(s.priority.count).toBe(3);
    expect(s.completedSteps).toContain("priorities");
  });

  it("4 prioridades invalidam o gate e não avançam (regressão C1)", () => {
    const s = deriveJourneyStatus(
      input({
        ...ready,
        priorityDimensions: ["finance", "operations", "people", "governance"],
        pendingObjectiveTemplateIds: objIds,
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.priority.status).toBe("too_many");
    expect(s.phase).toBe("priorities");
    expect(s.readyToApply).toBe(false);
    expect(s.completedSteps).not.toContain("priorities");
  });
});

describe("capacidade do ciclo na máquina central", () => {
  it("4 existentes + 3 pendentes com KPIs e ciclo editável ficam prontos para aplicar", () => {
    const s = deriveJourneyStatus(
      input({
        ...ready,
        existingObjectives: 4,
        pendingObjectiveTemplateIds: objIds,
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.draft.finalCount).toBe(7);
    expect(s.phase).toBe("ready_to_apply");
    expect(s.readyToApply).toBe(true);
  });

  it("4 existentes + 4 pendentes bloqueiam por capacidade", () => {
    const ids = [...objIds, "d"];
    const s = deriveJourneyStatus(
      input({
        ...ready,
        existingObjectives: 4,
        pendingObjectiveTemplateIds: ids,
        kpiSelections: ids.map((o) => ({
          templateObjectiveId: o,
          templateKpiId: `k-${o}`,
          decision: "accepted" as const,
        })),
        templateKpis: ids.map((o) => kpi(o, `k-${o}`)),
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.draft.status).toBe("too_many");
    expect(s.readyToApply).toBe(false);
    expect(s.nextAction.label).toBe("Revise os objetivos do ciclo");
  });

  it("0 existentes + 2 pendentes bloqueiam pelo mínimo de 3", () => {
    const ids = ["a", "b"];
    const s = deriveJourneyStatus(
      input({
        ...ready,
        pendingObjectiveTemplateIds: ids,
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.draft.status).toBe("too_few");
    expect(s.readyToApply).toBe(false);
    expect(s.nextAction.label).toBe("Revise os objetivos do ciclo");
  });

  it("0 existentes + 3 pendentes com KPIs é válido", () => {
    const s = deriveJourneyStatus(
      input({
        ...ready,
        pendingObjectiveTemplateIds: objIds,
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.draft.valid).toBe(true);
    expect(s.readyToApply).toBe(true);
  });
});

describe("indicadores por objetivo na máquina central", () => {
  it("objetivo pendente sem indicador bloqueia a aplicação", () => {
    const s = deriveJourneyStatus(
      input({
        ...ready,
        pendingObjectiveTemplateIds: objIds,
        kpiSelections: draftSelections.slice(0, 2),
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.readyToApply).toBe(false);
    expect(s.kpiSelection.missingObjectiveIds).toEqual(["c"]);
    expect(s.nextAction.label).toBe("Selecione indicadores para cada objetivo");
  });

  it("indicador de outro objetivo não satisfaz o objetivo atual", () => {
    const s = deriveJourneyStatus(
      input({
        ...ready,
        pendingObjectiveTemplateIds: objIds,
        kpiSelections: [
          ...draftSelections.slice(0, 2),
          { templateObjectiveId: "c", templateKpiId: "k-a", decision: "accepted" as const },
        ],
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.kpiSelection.valid).toBe(false);
    expect(s.kpiSelection.missingObjectiveIds).toEqual(["c"]);
    expect(s.readyToApply).toBe(false);
  });
});

describe("ciclo de planejamento na máquina central", () => {
  const draftReady = {
    ...ready,
    pendingObjectiveTemplateIds: objIds,
    kpiSelections: draftSelections,
    templateKpis: draftKpis,
  };

  it("sem ciclo existente orienta criar o ciclo no Planejamento", () => {
    const s = deriveJourneyStatus(input({ ...draftReady, hasPlan: false, planEditable: false }));
    expect(s.readyToApply).toBe(false);
    expect(s.nextAction.href).toBe("/planejamento");
    expect(s.nextAction.label).toBe("Abrir Planejamento para criar o ciclo");
  });

  it("ciclo existente não editável orienta usar um ciclo em rascunho", () => {
    const s = deriveJourneyStatus(input({ ...draftReady, hasPlan: true, planEditable: false }));
    expect(s.readyToApply).toBe(false);
    expect(s.nextAction.href).toBe("/planejamento");
    expect(s.nextAction.label).toBe("Abrir Planejamento e usar um ciclo em rascunho");
  });

  it("ciclo editável conclui o gate do plano", () => {
    const s = deriveJourneyStatus(input({ ...draftReady, hasPlan: true, planEditable: true }));
    expect(s.phase).toBe("ready_to_apply");
    expect(s.readyToApply).toBe(true);
    expect(s.nextAction.step).toBe("review");
  });
});

describe("histórico aplicado x rascunho pendente", () => {
  it("aplicado sem pendências fica em formalizing_plan abaixo de 100%", () => {
    const s = deriveJourneyStatus(
      input({ ...ready, appliedObjectives: 4, existingObjectives: 4, hasPlan: true }),
    );
    expect(s.phase).toBe("formalizing_plan");
    expect(s.percent).toBeLessThan(100);
    expect(s.officialPlanReady).toBeNull();
  });

  it("pendingObjectives conta somente novos pendentes; histórico fica em appliedObjectives", () => {
    const ids = ["a", "b"];
    const s = deriveJourneyStatus(
      input({
        ...ready,
        appliedObjectives: 3,
        existingObjectives: 3,
        pendingObjectiveTemplateIds: ids,
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.pendingObjectives).toBe(2);
    expect(s.appliedObjectives).toBe(3);
    expect(s.phase).toBe("ready_to_apply");
  });

  it("pendingKpis e appliedKpis permanecem separados", () => {
    const s = deriveJourneyStatus(
      input({
        ...ready,
        appliedObjectives: 3,
        existingObjectives: 3,
        pendingObjectiveTemplateIds: ["a"],
        kpiSelections: draftSelections,
        templateKpis: draftKpis,
        pendingKpis: 2,
        appliedKpis: 9,
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.pendingKpis).toBe(2);
    expect(s.appliedKpis).toBe(9);
  });

  it("histórico aplicado não torna um novo rascunho inválido em válido", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const s = deriveJourneyStatus(
      input({
        ...ready,
        appliedObjectives: 3,
        existingObjectives: 4,
        pendingObjectiveTemplateIds: ids,
        kpiSelections: ids.map((o) => ({
          templateObjectiveId: o,
          templateKpiId: `k-${o}`,
          decision: "accepted" as const,
        })),
        templateKpis: ids.map((o) => kpi(o, `k-${o}`)),
        hasPlan: true,
        planEditable: true,
      }),
    );
    expect(s.draft.valid).toBe(false);
    expect(s.readyToApply).toBe(false);
    expect(s.phase).not.toBe("ready_to_apply");
  });
});

describe("retomada segura", () => {
  const partial = deriveJourneyStatus(input({ hasProfile: true }));

  it("etapa salva à frente da primeira pendência volta para a pendência", () => {
    expect(partial.resumeStep).toBe("maturity");
    expect(resolveJourneyResumeStep(partial, "priorities")).toBe("maturity");
  });

  it("etapa salva atrás mas já concluída avança para resumeStep", () => {
    expect(resolveJourneyResumeStep(partial, "profile")).toBe("maturity");
  });

  it("etapa salva igual à pendência é mantida", () => {
    expect(resolveJourneyResumeStep(partial, "maturity")).toBe("maturity");
  });

  it("etapa salva ausente usa resumeStep", () => {
    expect(resolveJourneyResumeStep(partial, null)).toBe("maturity");
    expect(resolveJourneyResumeStep(partial, undefined)).toBe("maturity");
  });
});

describe("revisão do diagnóstico", () => {
  const base = input({
    hasProfile: true,
    maturity: { complete: true, answered: 10, total: 10 },
    diagnosisSignals: 0,
    diagnosisReviewed: false,
  });

  it("maturidade completa sem sinais e sem revisão para em diagnosis", () => {
    expect(deriveJourneyStatus(base).phase).toBe("diagnosis");
  });

  it("mesma entrada com revisão confirmada avança para priorities", () => {
    expect(deriveJourneyStatus({ ...base, diagnosisReviewed: true }).phase).toBe("priorities");
  });

  it("revisão invalidada volta para diagnosis mesmo com sinais marcados", () => {
    const s = deriveJourneyStatus({
      ...base,
      diagnosisSignals: 6,
      priorityDimensions: prios,
      pendingObjectiveTemplateIds: objIds,
      kpiSelections: draftSelections,
      templateKpis: draftKpis,
      hasPlan: true,
      planEditable: true,
    });
    expect(s.phase).toBe("diagnosis");
    expect(s.readyToApply).toBe(false);
  });
});

describe("contrato de completude oficial do F8 (C2B)", () => {
  const appliedState = {
    ...ready,
    appliedObjectives: 4,
    existingObjectives: 4,
    hasPlan: true,
  };

  it("officialPlanReady null mantém formalizing_plan com teto de 95%", () => {
    const s = deriveJourneyStatus(input({ ...appliedState, officialPlanReady: null }));
    expect(s.phase).toBe("formalizing_plan");
    expect(s.percent).toBeLessThanOrEqual(95);
  });

  it("officialPlanReady false mantém formalizing_plan", () => {
    const s = deriveJourneyStatus(input({ ...appliedState, officialPlanReady: false }));
    expect(s.phase).toBe("formalizing_plan");
    expect(s.officialPlanReady).toBe(false);
  });

  it("officialPlanReady true conclui a jornada em 100%", () => {
    const s = deriveJourneyStatus(input({ ...appliedState, officialPlanReady: true }));
    expect(s.phase).toBe("complete");
    expect(s.percent).toBe(100);
  });

  it("officialPlanCompleteness é apenas propagado, sem alterar regra", () => {
    const a = deriveJourneyStatus(input({ ...appliedState, officialPlanCompleteness: 42 }));
    const b = deriveJourneyStatus(input(appliedState));
    expect(a.officialPlanCompleteness).toBe(42);
    expect(b.officialPlanCompleteness).toBeNull();
    expect(a.phase).toBe(b.phase);
    expect(a.percent).toBe(b.percent);
  });
});
