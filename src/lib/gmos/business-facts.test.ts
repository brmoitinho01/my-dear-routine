// F8.1-B1 — Retrato do negócio: derivação, cobertura, readiness e contrato de IA.
import { describe, expect, it } from "vitest";
import {
  businessPortraitCoverage,
  businessPortraitReadiness,
  deriveBusinessMetrics,
  normalizeBusinessFacts,
  validateFactValue,
  type BusinessFactsInput,
  type FactDefinition,
  type FactValue,
} from "./business-facts";
import { ALLOWED_FACT_CODES, buildStrategicRecommendationContext } from "./recommendation-context";
import { deriveJourneyStatus, type JourneyStatusInput } from "./strategy-recommendations";

function def(over: Partial<FactDefinition> & { code: string }): FactDefinition {
  return {
    id: `id-${over.code}`,
    version: 1,
    code: over.code,
    label: over.code,
    description: null,
    dimension: "finance",
    category: "geral",
    valueType: "number",
    unit: null,
    universal: true,
    sectorCode: null,
    businessModel: null,
    importance: "core",
    derived: false,
    sourceFactCodes: [],
    allowNegative: false,
    sortOrder: 1,
    isActive: true,
    ...over,
  };
}

const val = (code: string, numeric: number | null, over: Partial<FactValue> = {}): FactValue => ({
  factDefinitionId: `id-${code}`,
  numericValue: numeric,
  textValue: null,
  booleanValue: null,
  confidence: "exact",
  sourceNote: null,
  ...over,
});

const defs: FactDefinition[] = [
  def({ code: "annual_revenue_current", valueType: "currency", unit: "BRL" }),
  def({ code: "annual_revenue_previous", valueType: "currency", unit: "BRL" }),
  def({ code: "gross_margin_pct", valueType: "percentage", unit: "%" }),
  def({ code: "headcount", dimension: "people" }),
  def({ code: "active_customers", dimension: "marketing_sales" }),
  def({
    code: "on_time_delivery_pct",
    dimension: "operations",
    valueType: "percentage",
    unit: "%",
  }),
];

const full: BusinessFactsInput = {
  definitions: defs,
  values: [
    val("annual_revenue_current", 1_200_000),
    val("annual_revenue_previous", 1_000_000),
    val("gross_margin_pct", 30),
    val("headcount", 10),
    val("active_customers", 40),
    val("on_time_delivery_pct", 90),
  ],
  snapshot: {
    id: "s1",
    referenceDate: "2026-01-01",
    periodLabel: "2026",
    currencyCode: "BRL",
    reviewStatus: "reviewed",
    reviewedAt: "2026-01-02T00:00:00Z",
  },
};

describe("validateFactValue", () => {
  it('"não tenho este dado" é sempre resposta válida', () => {
    expect(validateFactValue(defs[0], { confidence: "unavailable" }).valid).toBe(true);
  });
  it("percentual acima de 100 é recusado", () => {
    expect(validateFactValue(defs[2], { numericValue: 140, confidence: "exact" }).valid).toBe(
      false,
    );
  });
  it("valor vazio sem indisponibilidade é recusado", () => {
    expect(validateFactValue(defs[0], { numericValue: null, confidence: "exact" }).valid).toBe(
      false,
    );
  });
});

describe("normalizeBusinessFacts", () => {
  it('"não disponível" nunca se transforma em zero', () => {
    const facts = normalizeBusinessFacts(defs, [
      val("headcount", null, { confidence: "unavailable" }),
    ]);
    const hc = facts.find((f) => f.definition.code === "headcount")!;
    expect(hc.answered).toBe(true);
    expect(hc.available).toBe(false);
    expect(hc.numeric).toBeNull();
  });
});

describe("deriveBusinessMetrics", () => {
  it("deriva variação de receita e receita por colaborador", () => {
    const m = deriveBusinessMetrics(full);
    const growth = m.find((x) => x.code === "revenue_growth_pct")!;
    expect(growth.value).toBe(20);
    expect(growth.evidence).toContain("annual_revenue_current");
    expect(m.some((x) => x.code === "revenue_per_employee")).toBe(true);
  });

  it("não deriva quando falta insumo", () => {
    const m = deriveBusinessMetrics({ ...full, values: [val("annual_revenue_current", 100)] });
    expect(m.some((x) => x.code === "revenue_growth_pct")).toBe(false);
  });
});

describe("cobertura e readiness", () => {
  it("cobertura não conta itens marcados como indisponíveis", () => {
    const c = businessPortraitCoverage({
      ...full,
      values: [
        val("annual_revenue_current", 1000),
        val("headcount", null, { confidence: "unavailable" }),
      ],
    });
    expect(c.availableCount).toBe(1);
    expect(c.unavailableCount).toBe(1);
    expect(c.answeredCount).toBe(2);
    expect(c.coveragePercent).toBeLessThan(c.reviewedPercent);
  });

  it("sem snapshot não existe retrato", () => {
    const r = businessPortraitReadiness({ ...full, snapshot: null, values: [] });
    expect(r.hasSnapshot).toBe(false);
    expect(r.readyForRecommendations).toBe(false);
  });

  it("blocos essenciais respondidos com indisponível ainda liberam a revisão", () => {
    const r = businessPortraitReadiness({
      ...full,
      values: full.values.map((v) =>
        v.factDefinitionId === "id-on_time_delivery_pct"
          ? val("on_time_delivery_pct", null, { confidence: "unavailable" })
          : v,
      ),
    });
    expect(r.missingCoreCodes).toEqual([]);
    expect(r.readyForRecommendations).toBe(true);
  });

  it("retrato em rascunho não está pronto mesmo com todos os blocos", () => {
    const r = businessPortraitReadiness({
      ...full,
      snapshot: { ...full.snapshot!, reviewStatus: "draft", reviewedAt: null },
    });
    expect(r.reviewed).toBe(false);
    expect(r.readyForRecommendations).toBe(false);
  });
});

/* ---------- gate na máquina central da Jornada ---------- */

function journey(over: Partial<JourneyStatusInput> = {}): JourneyStatusInput {
  return {
    hasProfile: true,
    maturity: { complete: true, answered: 10, total: 10 },
    diagnosisReviewed: true,
    diagnosisSignals: 0,
    priorityDimensions: ["finance"],
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

describe("etapa business na jornada", () => {
  it("retrato não iniciado para a jornada na etapa business", () => {
    const s = deriveJourneyStatus(
      journey({
        businessPortrait: {
          hasSnapshot: false,
          coreAnswered: false,
          reviewed: false,
          coveragePercent: 0,
        },
      }),
    );
    expect(s.phase).toBe("business");
    expect(s.nextAction.step).toBe("business");
    expect(s.completedSteps).not.toContain("business");
  });

  it("blocos essenciais pendentes mostram exatamente o que falta", () => {
    const s = deriveJourneyStatus(
      journey({
        businessPortrait: {
          hasSnapshot: true,
          coreAnswered: false,
          reviewed: false,
          coveragePercent: 20,
          missingCoreLabels: ["Colaboradores"],
        },
      }),
    );
    expect(s.nextAction.reason).toContain("Colaboradores");
  });

  it("retrato revisado conclui a etapa e libera a maturidade", () => {
    const s = deriveJourneyStatus(
      journey({
        businessPortrait: {
          hasSnapshot: true,
          coreAnswered: true,
          reviewed: true,
          coveragePercent: 60,
        },
      }),
    );
    expect(s.completedSteps).toContain("business");
    expect(s.steps.find((x) => x.step === "maturity")?.blocked).toBe(false);
  });

  it("cobertura baixa não bloqueia a jornada", () => {
    const s = deriveJourneyStatus(
      journey({
        businessPortrait: {
          hasSnapshot: true,
          coreAnswered: true,
          reviewed: true,
          coveragePercent: 35,
        },
      }),
    );
    expect(s.completedSteps).toContain("business");
    expect(s.phase).not.toBe("business");
  });
});

/* ---------- contrato para a camada de IA ---------- */

describe("buildStrategicRecommendationContext", () => {
  const ctx = () =>
    buildStrategicRecommendationContext({
      businessUnitId: "bu-1",
      companyProfile: {
        sectorCode: "mining",
        businessModel: "b2b",
        stage: "growth",
        sizeBand: "small",
        horizonYears: 3,
      },
      directionChoices: null,
      portrait: full,
      maturity: null,
      selectedDiagnosisStatements: [
        { code: "z", dimension: "finance", category: "weakness" },
        { code: "a", dimension: "operations", category: "threat" },
      ],
      priorityDimensions: ["operations", "finance"],
      planCounts: { hasPlan: false, objectives: 0, kpis: 0 },
    });

  it("é determinístico e ordenado", () => {
    expect(JSON.stringify(ctx())).toBe(JSON.stringify(ctx()));
    expect(ctx().diagnosis.selectedStatements.map((s) => s.code)).toEqual(["a", "z"]);
    expect(ctx().priorities).toEqual(["finance", "operations"]);
  });

  it("só serializa códigos allowlisted", () => {
    const c = buildStrategicRecommendationContext({
      businessUnitId: "bu-1",
      companyProfile: null,
      directionChoices: null,
      portrait: {
        ...full,
        definitions: [...defs, def({ code: "segredo_interno" })],
        values: [...full.values, val("segredo_interno", 42)],
      },
      maturity: null,
      selectedDiagnosisStatements: [],
      priorityDimensions: [],
      planCounts: { hasPlan: false, objectives: 0, kpis: 0 },
    });
    expect(c.rawFacts.every((f) => ALLOWED_FACT_CODES.includes(f.code))).toBe(true);
    expect(JSON.stringify(c)).not.toContain("segredo_interno");
  });

  it("não vaza pessoas, papéis nem auditoria", () => {
    const json = JSON.stringify(ctx());
    for (const forbidden of ["email", "user_id", "userId", "created_by", "role", "permission"]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("declara versão do contrato e ausência de benchmark", () => {
    expect(ctx().contextVersion).toBe(1);
    expect(ctx().benchmarks.available).toBe(false);
  });
});
