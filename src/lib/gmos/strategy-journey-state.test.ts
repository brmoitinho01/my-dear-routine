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
        pendingObjectiveTemplateIds: ["a", "b", "c"],
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
