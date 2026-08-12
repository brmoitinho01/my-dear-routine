// F12.1-C1 — prioridade humana influencia ranking; maturidade parcial não.
import { describe, expect, it } from "vitest";
import {
  PRIORITY_BONUS,
  calculateMaturityScore,
  derivePriorityThemes,
  diagnosisSummary,
  priorityReason,
  rankStrategicRecommendations,
  validatePrioritySelection,
  type Dimension,
  type MaturityQuestion,
  type TemplateObjective,
} from "./strategy-recommendations";

const q = (id: string, dimension: Dimension): MaturityQuestion => ({
  id,
  code: id,
  dimension,
  weight: 1,
  maxScore: 4,
});

const QUESTIONS = [q("q1", "finance"), q("q2", "operations")];

const tpl = (
  id: string,
  dimension: Dimension,
  sectorCode: TemplateObjective["sectorCode"] = "general",
): TemplateObjective => ({
  id,
  code: id,
  sectorCode,
  dimension,
  stages: ["growth"],
  title: `Objetivo ${id}`,
  description: "desc",
  rationale: "Conhecimento curado da biblioteca.",
  baseWeight: 1,
  sortOrder: 1,
});

const emptyDiagnosis = diagnosisSummary([], []);
const profile = { sectorCode: "general" as const, stage: "growth" as const };

const rank = (priorityDimensions: Dimension[], answers: { questionId: string; score: number }[]) =>
  rankStrategicRecommendations({
    profile,
    templates: [tpl("t-fin", "finance"), tpl("t-ops", "operations")],
    kpis: [],
    maturity: calculateMaturityScore(QUESTIONS, answers),
    diagnosis: emptyDiagnosis,
    priorityDimensions,
  });

describe("validatePrioritySelection", () => {
  it("zero prioridades é inválido", () => {
    const r = validatePrioritySelection([]);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("too_few");
  });
  it("1 prioridade é válida", () => {
    expect(validatePrioritySelection(["finance"]).valid).toBe(true);
  });
  it("3 prioridades são válidas", () => {
    const r = validatePrioritySelection(["finance", "operations", "people"]);
    expect(r.valid).toBe(true);
    expect(r.count).toBe(3);
  });
  it("4 prioridades são inválidas", () => {
    const r = validatePrioritySelection(["finance", "operations", "people", "governance"]);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("too_many");
  });
});

describe("prioridade no ranking", () => {
  const answers = [
    { questionId: "q1", score: 4 },
    { questionId: "q2", score: 4 },
  ];

  it("prioridade explícita aumenta o score da mesma dimensão", () => {
    const base = rank([], answers).find((r) => r.objective.id === "t-ops")!;
    const boosted = rank(["operations"], answers).find((r) => r.objective.id === "t-ops")!;
    expect(boosted.score - base.score).toBe(PRIORITY_BONUS);
  });

  it("reason de prioridade aparece", () => {
    const boosted = rank(["operations"], answers).find((r) => r.objective.id === "t-ops")!;
    expect(boosted.reasons).toContain(priorityReason("operations"));
  });

  it("prioridade não faz template de outro setor passar pelo filtro", () => {
    const out = rankStrategicRecommendations({
      profile: { sectorCode: "food_service", stage: "growth" },
      templates: [tpl("t-min", "operations", "mining")],
      kpis: [],
      maturity: calculateMaturityScore(QUESTIONS, answers),
      diagnosis: emptyDiagnosis,
      priorityDimensions: ["operations"],
    });
    expect(out).toHaveLength(0);
  });
});

describe("maturidade provisória", () => {
  it("1 resposta de score máximo continua provisória", () => {
    const m = calculateMaturityScore(QUESTIONS, [{ questionId: "q1", score: 4 }]);
    expect(m.complete).toBe(false);
    expect(m.isProvisional).toBe(true);
    expect(m.overall).toBe(100);
    expect(m.gaps).toEqual([]);
    expect(m.completionPercent).toBe(50);
  });

  it("todas respondidas => completa", () => {
    const m = calculateMaturityScore(QUESTIONS, [
      { questionId: "q1", score: 1 },
      { questionId: "q2", score: 4 },
    ]);
    expect(m.complete).toBe(true);
    expect(m.isProvisional).toBe(false);
    expect(m.completionPercent).toBe(100);
    expect(m.gaps[0]).toBe("finance");
  });

  it("ranking não recebe bônus de maturidade quando incompleta", () => {
    const partial = rankStrategicRecommendations({
      profile,
      templates: [tpl("t-fin", "finance"), tpl("t-ops", "operations")],
      kpis: [],
      maturity: calculateMaturityScore(QUESTIONS, [{ questionId: "q1", score: 0 }]),
      diagnosis: emptyDiagnosis,
    });
    const fin = partial.find((r) => r.objective.id === "t-fin")!;
    const ops = partial.find((r) => r.objective.id === "t-ops")!;
    expect(fin.score).toBe(ops.score);
    expect(fin.reasons.join(" ")).not.toContain("menor maturidade");
  });

  it("ranking recebe bônus e reason de maturidade quando completa", () => {
    const full = rankStrategicRecommendations({
      profile,
      templates: [tpl("t-fin", "finance"), tpl("t-ops", "operations")],
      kpis: [],
      maturity: calculateMaturityScore(QUESTIONS, [
        { questionId: "q1", score: 0 },
        { questionId: "q2", score: 4 },
      ]),
      diagnosis: emptyDiagnosis,
    });
    const fin = full.find((r) => r.objective.id === "t-fin")!;
    const ops = full.find((r) => r.objective.id === "t-ops")!;
    expect(fin.score).toBeGreaterThan(ops.score);
    expect(fin.reasons.join(" ")).toContain("menor maturidade");
  });

  it("derivePriorityThemes ignora maturidade incompleta", () => {
    const m = calculateMaturityScore(QUESTIONS, [{ questionId: "q1", score: 0 }]);
    expect(derivePriorityThemes(m, emptyDiagnosis)).toEqual([]);
  });
});

describe("rationale curado", () => {
  it("não entra automaticamente nas razões", () => {
    const rec = rank(["operations"], [{ questionId: "q1", score: 4 }])[0];
    expect(rec.objective.rationale).toContain("curado");
    expect(rec.reasons.join(" ")).not.toContain(rec.objective.rationale);
  });
});
