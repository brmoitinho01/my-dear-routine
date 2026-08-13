// FASE F8.1-A — ponte determinística entre o Diagnóstico da Jornada (F12) e o
// Diagnóstico do Planejamento (F8). Funções PURAS: nada de IA, nada de inferência,
// nada inventado. Só entra no rascunho o que a liderança selecionou explicitamente.
import {
  MATURITY_BAND_LABEL,
  SECTOR_LABEL,
  STAGE_LABEL,
  SWOT_LABEL,
  DIMENSION_LABEL,
  type Dimension,
  type DiagnosisSelection,
  type DiagnosisStatement,
  type MaturityScore,
  type SectorCode,
  type Stage,
  type SwotCategory,
} from "./strategy-recommendations";
import type { DiagnosticInput } from "./strategy";

export type PlanningDiagnosisInput = {
  profile: {
    sectorCode: SectorCode;
    stage: Stage;
    /** rótulo humano do modelo de negócio, quando disponível */
    businessModelLabel?: string | null;
  } | null;
  maturity: MaturityScore | null;
  statements: DiagnosisStatement[];
  selections: DiagnosisSelection[];
  priorityDimensions: Dimension[];
  /**
   * F8.1-A.1 — evidência oficial de que a liderança revisou o Diagnóstico da Jornada
   * (`company_strategy_profiles.diagnosis_reviewed_at`). Zero sinais selecionados é uma
   * conclusão legítima: a prova de conclusão é esta data, nunca a contagem de sinais.
   */
  diagnosisReviewedAt: string | null;
};

/** Sinais selecionados agrupados por categoria SWOT, na ordem da biblioteca. */
export function selectedStatementsBySwot(
  statements: DiagnosisStatement[],
  selections: DiagnosisSelection[],
): Record<SwotCategory, DiagnosisStatement[]> {
  const chosen = new Set(selections.map((s) => s.statementId));
  const out: Record<SwotCategory, DiagnosisStatement[]> = {
    strength: [],
    weakness: [],
    opportunity: [],
    threat: [],
  };
  const ordered = statements
    .filter((s) => chosen.has(s.id))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const s of ordered) {
    if (out[s.swotCategory]) out[s.swotCategory]!.push(s);
  }
  return out;
}

const bullets = (items: DiagnosisStatement[]) =>
  items.length === 0 ? "" : items.map((s) => `- ${s.statement}`).join("\n");

/** Resumo factual: apenas dados registrados, sem interpretação. */
export function synthesizeContextSummary(input: PlanningDiagnosisInput): string {
  const parts: string[] = [];
  if (input.profile) {
    parts.push(`Setor: ${SECTOR_LABEL[input.profile.sectorCode]}.`);
    const model = (input.profile.businessModelLabel ?? "").trim();
    if (model.length > 0) parts.push(`Modelo de negócio: ${model}.`);
    parts.push(`Fase da gestão: ${STAGE_LABEL[input.profile.stage]}.`);
  }
  const m = input.maturity;
  if (m) {
    if (m.complete) {
      parts.push(`Maturidade de gestão: ${MATURITY_BAND_LABEL[m.band]} (${m.overall}/100).`);
    } else {
      parts.push(
        `Maturidade de gestão: questionário incompleto (${m.answered}/${m.total} respostas).`,
      );
    }
  }
  const signals = input.selections.length;
  parts.push(
    signals === 1
      ? "1 sinal de diagnóstico selecionado pela liderança."
      : `${signals} sinais de diagnóstico selecionados pela liderança.`,
  );
  return parts.join(" ");
}

/** Rascunho do diagnóstico oficial do F8. `assumptions` nunca é inventado. */
export function synthesizePlanningDiagnostic(input: PlanningDiagnosisInput): DiagnosticInput {
  const swot = selectedStatementsBySwot(input.statements, input.selections);
  return {
    contextSummary: synthesizeContextSummary(input),
    strengths: bullets(swot.strength),
    weaknesses: bullets(swot.weakness),
    opportunities: bullets(swot.opportunity),
    threats: bullets(swot.threat),
    strategicPriorities: input.priorityDimensions.map((d) => DIMENSION_LABEL[d]).join(", "),
    assumptions: "",
  };
}

export type DiagnosisReadiness = {
  ready: boolean;
  /** o que falta na Jornada, em português */
  missing: string[];
};

/**
 * O que ainda falta na Jornada para gerar o diagnóstico do Planejamento.
 * ZERO sinais selecionados é permitido quando a revisão foi concluída.
 */
export function diagnosisReadiness(input: PlanningDiagnosisInput): DiagnosisReadiness {
  const missing: string[] = [];
  if (!input.profile) missing.push("Perfil da unidade na Jornada Estratégica.");
  if (!input.maturity || input.maturity.total === 0 || !input.maturity.complete) {
    missing.push("Questionário de maturidade completo.");
  }
  if (!input.diagnosisReviewedAt) {
    missing.push("Concluir a revisão do Diagnóstico da Jornada.");
  }
  const priorities = input.priorityDimensions.length;
  if (priorities === 0) {
    missing.push("Prioridades da liderança.");
  } else if (priorities > 3) {
    missing.push("No máximo 3 prioridades da liderança.");
  }
  return { ready: missing.length === 0, missing };
}

/**
 * F8.1-A.1 — decisão pura de confirmação. Sem readiness não existe botão:
 * confirmar ou substituir o diagnóstico oficial exige a Jornada concluída.
 */
export type DiagnosisConfirmDecision = {
  canConfirm: boolean;
  mode: "confirm" | "replace" | "blocked";
  reason: "not_ready" | "read_only" | null;
};

export function diagnosisConfirmDecision(args: {
  readiness: DiagnosisReadiness;
  replacement: DiagnosticReplacementDecision;
  canEdit: boolean;
}): DiagnosisConfirmDecision {
  if (!args.canEdit) return { canConfirm: false, mode: "blocked", reason: "read_only" };
  if (!args.readiness.ready) return { canConfirm: false, mode: "blocked", reason: "not_ready" };
  return {
    canConfirm: true,
    mode: args.replacement.requiresConfirmation ? "replace" : "confirm",
    reason: null,
  };
}

const trim = (v: string | null | undefined) => (v ?? "").trim();

export type DiagnosticReplacementDecision = {
  hasExisting: boolean;
  differs: boolean;
  requiresConfirmation: boolean;
};

export function diagnosticReplacement(
  current: {
    contextSummary?: string | null;
    strengths?: string | null;
    weaknesses?: string | null;
    opportunities?: string | null;
    threats?: string | null;
    strategicPriorities?: string | null;
  } | null,
  next: DiagnosticInput,
): DiagnosticReplacementDecision {
  const fields = [
    [current?.contextSummary, next.contextSummary],
    [current?.strengths, next.strengths],
    [current?.weaknesses, next.weaknesses],
    [current?.opportunities, next.opportunities],
    [current?.threats, next.threats],
    [current?.strategicPriorities, next.strategicPriorities],
  ] as const;
  const hasExisting = fields.some(([cur]) => trim(cur).length > 0);
  const differs = fields.some(([cur, nxt]) => trim(cur) !== trim(nxt));
  return { hasExisting, differs, requiresConfirmation: hasExisting && differs };
}

export const SWOT_ORDER: SwotCategory[] = ["strength", "weakness", "opportunity", "threat"];
export { SWOT_LABEL };
