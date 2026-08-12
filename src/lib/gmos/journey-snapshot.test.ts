// F12.1-C2B — validação formal oficial do F8 + resumo compartilhado (Home/Jornada).
import { describe, expect, it } from "vitest";
import {
  deriveOfficialPlanAction,
  type MaturityQuestion,
  type OfficialPlanFacts,
} from "./strategy-recommendations";
import {
  maturityLine,
  officialPlanLine,
  summarizeJourneySnapshot,
  type JourneySnapshotInput,
} from "./journey-snapshot";

function facts(over: Partial<OfficialPlanFacts> = {}): OfficialPlanFacts {
  return { ready: true, status: "draft", reviewStatus: "draft", issues: [], ...over };
}

const twoIssues = [
  { code: "diagnosis.missing", section: "diagnosis", message: "Registre o diagnóstico do plano." },
  { code: "kpis.incomplete", section: "kpis", message: "Há indicadores sem meta." },
];

describe("deriveOfficialPlanAction", () => {
  it("sem completude consultada não há ação oficial", () => {
    expect(deriveOfficialPlanAction(null)).toBeNull();
    expect(deriveOfficialPlanAction(undefined)).toBeNull();
  });

  it("ready=false usa a primeira issue oficial como motivo", () => {
    const a = deriveOfficialPlanAction(facts({ ready: false, issues: twoIssues }))!;
    expect(a.kind).toBe("resolve_pendings");
    expect(a.label).toBe("Resolver pendências no Planejamento");
    expect(a.href).toBe("/planejamento");
    expect(a.reason).toBe(twoIssues[0].message);
    expect(a.issueCount).toBe(2);
  });

  it("ready=false sem mensagem cai no resumo com a contagem oficial", () => {
    const a = deriveOfficialPlanAction(
      facts({ ready: false, issues: [{ code: "x", section: "kpis", message: "  " }] }),
    )!;
    expect(a.reason).toBe("Existem 1 pendências formais no plano.");
  });

  it("ready=true em rascunho pede envio para revisão", () => {
    const a = deriveOfficialPlanAction(facts({ reviewStatus: "draft" }))!;
    expect(a.kind).toBe("submit_for_review");
    expect(a.label).toBe("Enviar plano para revisão");
  });

  it("ready=true em revisão pede acompanhar", () => {
    expect(deriveOfficialPlanAction(facts({ reviewStatus: "in_review" }))!.label).toBe(
      "Acompanhar revisão do plano",
    );
  });

  it("ready=true aprovado e não ativo pede ativação", () => {
    const a = deriveOfficialPlanAction(facts({ reviewStatus: "approved", status: "draft" }))!;
    expect(a.kind).toBe("activate_cycle");
    expect(a.label).toBe("Ativar ciclo no Planejamento");
  });

  it("ready=true e ciclo ativo abre o ciclo ativo", () => {
    const a = deriveOfficialPlanAction(facts({ reviewStatus: "approved", status: "active" }))!;
    expect(a.kind).toBe("open_active_cycle");
    expect(a.label).toBe("Abrir ciclo ativo");
  });
});

/* ---------------- resumo compartilhado ---------------- */

function question(id: string): MaturityQuestion {
  return { id, code: id, dimension: "finance", weight: 1, maxScore: 4 };
}

const questions = [question("q1"), question("q2")];

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

function snapshot(over: Partial<JourneySnapshotInput> = {}): JourneySnapshotInput {
  return {
    hasProfile: false,
    diagnosisReviewedAt: null,
    questions,
    answers: [],
    diagnosisSignals: 0,
    priorityDimensions: [],
    pendingObjectiveTemplateIds: [],
    appliedObjectives: 0,
    appliedKpis: 0,
    existingObjectives: 0,
    hasPlan: false,
    planEditable: false,
    kpiSelections: [],
    templateKpis: [],
    completeness: null,
    ...over,
  };
}

const appliedSnapshot = (completeness: OfficialPlanFacts | null): JourneySnapshotInput =>
  snapshot({
    hasProfile: true,
    answers: questions.map((q) => ({ questionId: q.id, score: 4 })),
    diagnosisReviewedAt: "2026-01-10T00:00:00Z",
    diagnosisSignals: 3,
    priorityDimensions: ["finance", "operations"],
    pendingObjectiveTemplateIds: [],
    appliedObjectives: 4,
    appliedKpis: 6,
    existingObjectives: 4,
    hasPlan: true,
    planEditable: false,
    kpiSelections: objIds.map((o) => ({
      templateObjectiveId: o,
      templateKpiId: `k-${o}`,
      decision: "accepted" as const,
    })),
    templateKpis: objIds.map((o) => kpi(o, `k-${o}`)),
    completeness,
  });

describe("summarizeJourneySnapshot", () => {
  it("sem perfil: fase not_started e CTA da Jornada", () => {
    const s = summarizeJourneySnapshot(snapshot());
    expect(s.derived.phase).toBe("not_started");
    expect(s.cta.to).toBe("/jornada-estrategica");
    expect(s.cta.label).toBe("Continuar Jornada");
    expect(s.officialAction).toBeNull();
    expect(officialPlanLine(s)).toBeNull();
  });

  it("maturidade parcial fica provisória", () => {
    const s = summarizeJourneySnapshot(
      snapshot({ hasProfile: true, answers: [{ questionId: "q1", score: 3 }] }),
    );
    expect(s.maturity.complete).toBe(false);
    expect(maturityLine(s.maturity, "Estruturando")).toBe(
      "Maturidade: resultado provisório · 1/2 respostas",
    );
  });

  it("aplicado + F8 incompleto: formalizing, teto 95% e N pendências", () => {
    const s = summarizeJourneySnapshot(appliedSnapshot(facts({ ready: false, issues: twoIssues })));
    expect(s.derived.phase).toBe("formalizing_plan");
    expect(s.derived.percent).toBeLessThanOrEqual(95);
    expect(s.derived.officialPlanCompleteness).toBeNull();
    expect(officialPlanLine(s)).toBe("Planejamento: 2 pendência(s)");
    expect(s.cta.to).toBe("/planejamento");
    expect(s.cta.label).toBe("Resolver pendências no Planejamento");
  });

  it("aplicado + F8 ready: jornada completa em 100% sem inventar percentual do F8", () => {
    const s = summarizeJourneySnapshot(appliedSnapshot(facts({ ready: true })));
    expect(s.derived.phase).toBe("complete");
    expect(s.derived.percent).toBe(100);
    expect(s.derived.officialPlanCompleteness).toBeNull();
    expect(officialPlanLine(s)).toBe("Planejamento: sem pendências de completude");
    expect(s.cta).toEqual({ label: "Ver Jornada", to: "/jornada-estrategica" });
  });

  it("ready=true com issues vazias não é a fonte: a fonte é ready", () => {
    const s = summarizeJourneySnapshot(appliedSnapshot(facts({ ready: false, issues: [] })));
    expect(s.derived.phase).toBe("formalizing_plan");
    expect(officialPlanLine(s)).toBe("Planejamento: 0 pendência(s)");
  });

  it("completude indisponível não derruba o resumo da Jornada", () => {
    const s = summarizeJourneySnapshot({
      ...appliedSnapshot(null),
      completenessUnavailable: true,
    });
    expect(s.derived.phase).toBe("formalizing_plan");
    expect(officialPlanLine(s)).toBe("Validação do Planejamento indisponível");
  });

  it("sem plano nenhuma validação formal é composta", () => {
    const s = summarizeJourneySnapshot(snapshot({ hasProfile: true }));
    expect(s.hasPlan).toBe(false);
    expect(s.completeness).toBeNull();
    expect(s.officialAction).toBeNull();
  });
});
