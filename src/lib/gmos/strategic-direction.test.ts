// FASE F8.1-A — cobertura das decisões estruturadas e da ponte Jornada → Planejamento.
import { describe, expect, it } from "vitest";
import {
  EMPTY_DIRECTION_CHOICES,
  identityReplacement,
  joinList,
  synthesizeStrategicIdentity,
  validateDirectionChoices,
  type DirectionChoices,
} from "./strategic-direction-builder";
import {
  diagnosisConfirmDecision,
  diagnosisReadiness,
  diagnosticReplacement,
  selectedStatementsBySwot,
  synthesizePlanningDiagnostic,
  type PlanningDiagnosisInput,
} from "./planning-diagnosis";
import type { DiagnosisStatement, MaturityScore } from "./strategy-recommendations";

const valid: DirectionChoices = {
  focusGroups: ["key_accounts"],
  valuePropositions: ["reliability"],
  competitiveEdges: ["operational_excellence"],
  ambition: "grow_revenue",
  valueCodes: ["safety", "discipline", "transparency"],
  priorityDimension: "operations",
  customFocus: "",
  customValueProposition: "",
  customCompetitiveEdge: "",
};

describe("validateDirectionChoices", () => {
  it("recusa escolhas vazias e aponta todas as pendências", () => {
    const r = validateDirectionChoices(EMPTY_DIRECTION_CHOICES);
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(6);
  });

  it("aceita um conjunto mínimo completo", () => {
    expect(validateDirectionChoices(valid).valid).toBe(true);
  });

  it("recusa 'Outro' sem descrição", () => {
    const r = validateDirectionChoices({
      ...valid,
      focusGroups: ["other"],
      customFocus: "   ",
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "customFocus")).toBe(true);
  });

  it("recusa mais comportamentos que o limite", () => {
    const r = validateDirectionChoices({
      ...valid,
      valueCodes: [
        "safety",
        "discipline",
        "transparency",
        "ownership",
        "customer_focus",
        "learning",
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.field === "valueCodes")).toBe(true);
  });

  it("exige ambição e prioridade", () => {
    const r = validateDirectionChoices({ ...valid, ambition: null, priorityDimension: null });
    expect(r.issues.some((i) => i.field === "ambition")).toBe(true);
    expect(r.issues.some((i) => i.field === "priorityDimension")).toBe(true);
  });
});

describe("síntese determinística do direcionamento", () => {
  it("é vazia quando não há escolhas — nada é inventado", () => {
    const s = synthesizeStrategicIdentity(EMPTY_DIRECTION_CHOICES, {});
    expect(s.mission).toBe("");
    expect(s.vision).toBe("");
    expect(s.valuesText).toBe("");
    expect(s.strategicNorth).toBe("");
  });

  it("é estável: mesmas escolhas geram exatamente o mesmo texto", () => {
    const a = synthesizeStrategicIdentity(valid, { sectorCode: "mining", horizonYears: 2 });
    const b = synthesizeStrategicIdentity(valid, { sectorCode: "mining", horizonYears: 2 });
    expect(a).toEqual(b);
    expect(a.mission.length).toBeGreaterThan(0);
    expect(a.valuesText.length).toBeGreaterThan(0);
  });

  it("usa o texto de 'Outro' informado pelo usuário", () => {
    const s = synthesizeStrategicIdentity(
      { ...valid, focusGroups: ["other"], customFocus: "cooperativas parceiras" },
      {},
    );
    expect(s.mission).toContain("cooperativas parceiras");
  });

  it("joinList usa vírgulas e 'e' final", () => {
    expect(joinList(["a", "b", "c"])).toBe("a, b e c");
    expect(joinList([" ", ""])).toBe("");
  });
});

describe("identityReplacement", () => {
  it("não pede confirmação quando não há conteúdo anterior", () => {
    const next = synthesizeStrategicIdentity(valid, {});
    expect(identityReplacement(null, next).requiresConfirmation).toBe(false);
  });

  it("pede confirmação quando havia texto diferente", () => {
    const next = synthesizeStrategicIdentity(valid, {});
    const d = identityReplacement(
      { mission: "texto anterior", vision: "", valuesText: "", strategicNorth: "" },
      next,
    );
    expect(d.hasExisting).toBe(true);
    expect(d.requiresConfirmation).toBe(true);
  });

  it("não pede confirmação quando o texto já é idêntico", () => {
    const next = synthesizeStrategicIdentity(valid, {});
    expect(identityReplacement(next, next).requiresConfirmation).toBe(false);
  });
});

/* ---------- ponte Jornada → Planejamento ---------- */

const statement = (
  id: string,
  swotCategory: DiagnosisStatement["swotCategory"],
  sortOrder: number,
): DiagnosisStatement => ({
  id,
  code: id,
  sectorCode: "general",
  dimension: "operations",
  swotCategory,
  statement: `sinal ${id}`,
  weight: 1,
  sortOrder,
});

const maturity: MaturityScore = {
  overall: 60,
  band: "managed",
  byDimension: {} as MaturityScore["byDimension"],
  gaps: [],
  answered: 4,
  total: 4,
  complete: true,
  completionPercent: 100,
  isProvisional: false,
};

const input: PlanningDiagnosisInput = {
  profile: { sectorCode: "mining", stage: "growth", businessModelLabel: "Indústria / produção" },
  maturity,
  statements: [
    statement("s1", "strength", 2),
    statement("s2", "strength", 1),
    statement("w1", "weakness", 3),
    statement("t1", "threat", 4),
  ],
  selections: [
    { statementId: "s1", intensity: "medium" },
    { statementId: "s2", intensity: "high" },
  ],
  priorityDimensions: ["operations"],
  diagnosisReviewedAt: "2026-02-01T12:00:00Z",
};

describe("selectedStatementsBySwot", () => {
  it("agrupa apenas o que foi selecionado, na ordem da biblioteca", () => {
    const out = selectedStatementsBySwot(input.statements, input.selections);
    expect(out.strength.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(out.weakness).toEqual([]);
    expect(out.threat).toEqual([]);
  });
});

describe("synthesizePlanningDiagnostic", () => {
  it("preenche só as categorias com sinais selecionados", () => {
    const d = synthesizePlanningDiagnostic(input);
    expect(d.strengths).toContain("sinal s2");
    expect(d.weaknesses).toBe("");
    expect(d.threats).toBe("");
    expect(d.strategicPriorities.length).toBeGreaterThan(0);
    expect(d.contextSummary.length).toBeGreaterThan(0);
  });

  it("não inventa contexto sem perfil e sem seleções", () => {
    const d = synthesizePlanningDiagnostic({
      profile: null,
      maturity: null,
      statements: [],
      selections: [],
      priorityDimensions: [],
      diagnosisReviewedAt: null,
    });
    expect(d.strengths).toBe("");
    expect(d.strategicPriorities).toBe("");
  });
});

describe("diagnosisReadiness", () => {
  it("lista o que falta quando a Jornada está vazia", () => {
    const r = diagnosisReadiness({
      profile: null,
      maturity: null,
      statements: [],
      selections: [],
      priorityDimensions: [],
      diagnosisReviewedAt: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing.length).toBe(4);
  });

  it("fica pronta com perfil, maturidade completa, sinais e prioridades", () => {
    expect(diagnosisReadiness(input).ready).toBe(true);
  });

  it("não fica pronta com maturidade provisória", () => {
    const r = diagnosisReadiness({
      ...input,
      maturity: {
        ...maturity,
        answered: 2,
        complete: false,
        completionPercent: 50,
        isProvisional: true,
      },
    });
    expect(r.ready).toBe(false);
  });
});

// F8.1-A.1 — zero sinais é conclusão legítima; a prova é diagnosis_reviewed_at.
describe("diagnosisReadiness — zero sinais", () => {
  it("fica pronta com revisão concluída, maturidade completa, prioridades e ZERO sinais", () => {
    const r = diagnosisReadiness({ ...input, selections: [] });
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("não fica pronta quando a revisão do diagnóstico não foi concluída, mesmo com sinais", () => {
    const r = diagnosisReadiness({ ...input, diagnosisReviewedAt: null });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("Concluir a revisão do Diagnóstico da Jornada.");
  });

  it("não fica pronta sem prioridades e nem com mais de 3 prioridades", () => {
    expect(diagnosisReadiness({ ...input, priorityDimensions: [] }).ready).toBe(false);
    expect(
      diagnosisReadiness({
        ...input,
        priorityDimensions: ["operations", "finance", "people", "governance"],
      }).ready,
    ).toBe(false);
  });

  it("com zero sinais todos os blocos SWOT oficiais ficam vazios e o resumo é factual", () => {
    const d = synthesizePlanningDiagnostic({ ...input, selections: [] });
    expect(d.strengths).toBe("");
    expect(d.weaknesses).toBe("");
    expect(d.opportunities).toBe("");
    expect(d.threats).toBe("");
    expect(d.contextSummary).toContain("0 sinais de diagnóstico selecionados pela liderança.");
  });
});

describe("diagnosisConfirmDecision", () => {
  const replacement = { hasExisting: false, differs: true, requiresConfirmation: false };

  it("bloqueia a confirmação quando a Jornada não está pronta", () => {
    const d = diagnosisConfirmDecision({
      readiness: diagnosisReadiness({ ...input, diagnosisReviewedAt: null }),
      replacement,
      canEdit: true,
    });
    expect(d.canConfirm).toBe(false);
    expect(d.mode).toBe("blocked");
    expect(d.reason).toBe("not_ready");
  });

  it("bloqueia a substituição quando a Jornada não está pronta", () => {
    const d = diagnosisConfirmDecision({
      readiness: diagnosisReadiness({ ...input, diagnosisReviewedAt: null }),
      replacement: { hasExisting: true, differs: true, requiresConfirmation: true },
      canEdit: true,
    });
    expect(d.canConfirm).toBe(false);
    expect(d.mode).toBe("blocked");
  });

  it("bloqueia em perfil somente leitura", () => {
    const d = diagnosisConfirmDecision({
      readiness: diagnosisReadiness(input),
      replacement,
      canEdit: false,
    });
    expect(d.canConfirm).toBe(false);
    expect(d.reason).toBe("read_only");
  });

  it("libera confirmar e substituir quando pronta", () => {
    expect(
      diagnosisConfirmDecision({
        readiness: diagnosisReadiness(input),
        replacement,
        canEdit: true,
      }),
    ).toEqual({ canConfirm: true, mode: "confirm", reason: null });
    expect(
      diagnosisConfirmDecision({
        readiness: diagnosisReadiness(input),
        replacement: { hasExisting: true, differs: true, requiresConfirmation: true },
        canEdit: true,
      }).mode,
    ).toBe("replace");
  });
});

describe("diagnosticReplacement", () => {
  it("pede confirmação só quando há diagnóstico anterior diferente", () => {
    const next = synthesizePlanningDiagnostic(input);
    expect(diagnosticReplacement(null, next).requiresConfirmation).toBe(false);
    expect(
      diagnosticReplacement({ contextSummary: "outro contexto" }, next).requiresConfirmation,
    ).toBe(true);
    expect(diagnosticReplacement(next, next).requiresConfirmation).toBe(false);
  });
});
