// FASE F8.1-B1 — Retrato do negócio: camada PURA.
// Nenhuma consulta, nenhuma IA, nenhum benchmark externo. Tudo aqui é cálculo
// determinístico sobre fatos que a liderança registrou explicitamente.
//
// Regras inegociáveis desta camada:
// - divisão por zero (ou denominador ausente) devolve null, nunca Infinity/NaN;
// - `unavailable` é resposta válida e NUNCA é convertida em zero;
// - nenhum valor é classificado como "bom" ou "ruim": sem benchmark confiável,
//   o sistema apenas expõe o fato calculado.

export type FactDimension =
  | "finance"
  | "marketing_sales"
  | "operations"
  | "people"
  | "governance";

export type FactValueType =
  | "currency"
  | "percentage"
  | "number"
  | "days"
  | "hours"
  | "boolean"
  | "text_short";

export type FactImportance = "core" | "recommended" | "optional";
export type FactConfidence = "exact" | "estimated" | "unavailable";

export const FACT_DIMENSION_LABEL: Record<FactDimension, string> = {
  finance: "Financeiro",
  marketing_sales: "Comercial e clientes",
  operations: "Operações",
  people: "Pessoas",
  governance: "Governança e dados",
};

export const FACT_CONFIDENCE_LABEL: Record<FactConfidence, string> = {
  exact: "Informado",
  estimated: "Estimativa",
  unavailable: "Não disponível",
};

export type FactDefinition = {
  id: string;
  version: number;
  code: string;
  label: string;
  description: string | null;
  dimension: FactDimension;
  category: string;
  valueType: FactValueType;
  unit: string | null;
  universal: boolean;
  sectorCode: string | null;
  businessModel: string | null;
  importance: FactImportance;
  derived: boolean;
  sourceFactCodes: string[];
  allowNegative: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type FactValue = {
  factDefinitionId: string;
  numericValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  confidence: FactConfidence;
  sourceNote: string | null;
};

export type BusinessSnapshotMeta = {
  id: string;
  referenceDate: string;
  periodLabel: string | null;
  currencyCode: string;
  reviewStatus: "draft" | "reviewed";
  reviewedAt: string | null;
};

export type BusinessFactsInput = {
  definitions: FactDefinition[];
  values: FactValue[];
  snapshot: BusinessSnapshotMeta | null;
};

export type NormalizedFact = {
  definition: FactDefinition;
  value: FactValue | null;
  /** A liderança respondeu (informou um valor OU marcou como indisponível). */
  answered: boolean;
  /** Existe um dado utilizável (exato ou estimado). */
  available: boolean;
  estimated: boolean;
  unavailable: boolean;
  numeric: number | null;
  boolean: boolean | null;
  text: string | null;
  sourceNote: string | null;
};

/* ---------------- validação de valor por tipo ---------------- */

export type FactValueDraft = {
  numericValue?: number | null;
  textValue?: string | null;
  booleanValue?: boolean | null;
  confidence: FactConfidence;
  sourceNote?: string | null;
};

export type FactValueValidation = { valid: boolean; message: string | null };

/** Validação determinística; a mesma regra é reforçada por CHECK no banco. */
export function validateFactValue(
  definition: FactDefinition,
  draft: FactValueDraft,
): FactValueValidation {
  if (draft.confidence === "unavailable") {
    return { valid: true, message: null };
  }
  if ((draft.sourceNote ?? "").length > 120) {
    return { valid: false, message: "A observação de fonte deve ter no máximo 120 caracteres." };
  }

  if (definition.valueType === "boolean") {
    return typeof draft.booleanValue === "boolean"
      ? { valid: true, message: null }
      : { valid: false, message: "Responda sim ou não." };
  }
  if (definition.valueType === "text_short") {
    const t = (draft.textValue ?? "").trim();
    if (!t.length) return { valid: false, message: "Informe o valor ou marque como não disponível." };
    if (t.length > 120) return { valid: false, message: "Use no máximo 120 caracteres." };
    return { valid: true, message: null };
  }

  const n = draft.numericValue;
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return { valid: false, message: "Informe um número ou marque como não disponível." };
  }
  if (!definition.allowNegative && n < 0) {
    return { valid: false, message: "Este dado não aceita valor negativo." };
  }
  if (definition.valueType === "percentage") {
    if (n > 100) return { valid: false, message: "Percentuais vão de 0 a 100." };
    if (n < (definition.allowNegative ? -100 : 0)) {
      return { valid: false, message: "Percentual fora da faixa aceita." };
    }
  }
  return { valid: true, message: null };
}

/* ---------------- normalização ---------------- */

export function normalizeBusinessFacts(
  definitions: FactDefinition[],
  values: FactValue[],
): NormalizedFact[] {
  const byDefinition = new Map<string, FactValue>();
  for (const v of values) byDefinition.set(v.factDefinitionId, v);

  return definitions
    .filter((d) => d.isActive && !d.derived)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((definition) => {
      const value = byDefinition.get(definition.id) ?? null;
      const unavailable = value?.confidence === "unavailable";
      const estimated = value?.confidence === "estimated";
      // `unavailable` nunca vira zero: os campos de valor permanecem nulos.
      const numeric = !value || unavailable ? null : (value.numericValue ?? null);
      const boolean = !value || unavailable ? null : (value.booleanValue ?? null);
      const text = !value || unavailable ? null : (value.textValue ?? null);
      const hasData = numeric !== null || boolean !== null || (text ?? "").length > 0;
      return {
        definition,
        value,
        answered: Boolean(value),
        available: Boolean(value) && !unavailable && hasData,
        estimated: estimated && hasData,
        unavailable,
        numeric,
        boolean,
        text,
        sourceNote: value?.sourceNote ?? null,
      };
    });
}

const numericByCode = (facts: NormalizedFact[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const f of facts) {
    if (f.available && f.numeric !== null) map.set(f.definition.code, f.numeric);
  }
  return map;
};

/* ---------------- fatos derivados ---------------- */

export type DerivedMetric = {
  code: string;
  label: string;
  value: number;
  unit: string;
  /** Códigos dos fatos brutos que originaram o cálculo. */
  evidence: string[];
  formula: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Só deriva quando TODOS os insumos existem e são compatíveis. Nenhuma
 * anualização, nenhuma extrapolação e nenhum alvo: apenas relações simples.
 */
export function deriveBusinessMetrics(input: BusinessFactsInput): DerivedMetric[] {
  const facts = normalizeBusinessFacts(input.definitions, input.values);
  const v = numericByCode(facts);
  const out: DerivedMetric[] = [];

  const current = v.get("annual_revenue_current");
  const previous = v.get("annual_revenue_previous");
  if (current !== undefined && previous !== undefined && previous > 0) {
    out.push({
      code: "revenue_growth_pct",
      label: "Variação da receita",
      value: round2(((current - previous) / Math.abs(previous)) * 100),
      unit: "%",
      evidence: ["annual_revenue_current", "annual_revenue_previous"],
      formula: "(atual - anterior) / |anterior| × 100",
    });
  }

  const headcount = v.get("headcount");
  if (current !== undefined && headcount !== undefined && headcount > 0) {
    out.push({
      code: "revenue_per_employee",
      label: "Receita por colaborador",
      value: round2(current / headcount),
      unit: "BRL",
      evidence: ["annual_revenue_current", "headcount"],
      formula: "receita ÷ colaboradores",
    });
  }

  const positions = v.get("leadership_positions");
  const filled = v.get("filled_leadership_positions");
  if (positions !== undefined && filled !== undefined && positions > 0) {
    out.push({
      code: "leadership_coverage_pct",
      label: "Cobertura da liderança",
      value: round2((filled / positions) * 100),
      unit: "%",
      evidence: ["filled_leadership_positions", "leadership_positions"],
      formula: "posições ocupadas ÷ posições previstas × 100",
    });
  }

  const utilization = v.get("capacity_utilization_pct");
  if (utilization !== undefined) {
    out.push({
      code: "capacity_headroom_pct",
      label: "Folga de capacidade",
      value: round2(100 - utilization),
      unit: "%",
      evidence: ["capacity_utilization_pct"],
      formula: "100 − utilização da capacidade",
    });
  }

  const top1 = v.get("top1_customer_revenue_pct");
  const top5 = v.get("top5_customer_revenue_pct");
  if (top1 !== undefined || top5 !== undefined) {
    // Fato factual de concentração. NÃO é benchmark e não classifica nada.
    out.push({
      code: "customer_concentration_signal",
      label: "Concentração de clientes informada",
      value: round2(top5 ?? top1!),
      unit: "%",
      evidence: top5 !== undefined ? ["top5_customer_revenue_pct"] : ["top1_customer_revenue_pct"],
      formula:
        top5 !== undefined
          ? "participação dos 5 maiores clientes na receita"
          : "participação do maior cliente na receita",
    });
  }

  const winRate = v.get("win_rate_pct");
  if (winRate !== undefined) {
    out.push({
      code: "commercial_conversion_signal",
      label: "Conversão comercial informada",
      value: round2(winRate),
      unit: "%",
      evidence: ["win_rate_pct"],
      formula: "conversão de oportunidades informada",
    });
  }

  return out;
}

/* ---------------- sinais explicáveis ---------------- */

export type BusinessFactSignal = {
  code: string;
  value: number | boolean | string;
  unit: string | null;
  evidence: string[];
  /** raw = informado pela liderança; derived = calculado pelo sistema. */
  kind: "raw" | "derived";
  confidence: FactConfidence;
};

/**
 * Fatos explicáveis para a futura camada de IA (F8.1-B2). Sem conclusão
 * prescritiva, sem julgamento e sem comparação de mercado.
 */
export function businessFactSignals(input: BusinessFactsInput): BusinessFactSignal[] {
  const facts = normalizeBusinessFacts(input.definitions, input.values);
  const raw: BusinessFactSignal[] = facts
    .filter((f) => f.available)
    .map((f) => ({
      code: f.definition.code,
      value: (f.numeric ?? f.boolean ?? f.text) as number | boolean | string,
      unit: f.definition.unit,
      evidence: [f.definition.code],
      kind: "raw" as const,
      confidence: f.estimated ? ("estimated" as const) : ("exact" as const),
    }));

  const derived: BusinessFactSignal[] = deriveBusinessMetrics(input).map((m) => ({
    code: m.code,
    value: m.value,
    unit: m.unit,
    evidence: m.evidence,
    kind: "derived" as const,
    confidence: "exact" as const,
  }));

  return [...raw, ...derived];
}

/* ---------------- cobertura ---------------- */

export type BusinessPortraitCoverage = {
  /** Definições universais core+recommended consideradas. */
  applicableCount: number;
  /** Respondidas (valor OU indisponível). */
  answeredCount: number;
  /** Com dado utilizável (exato ou estimado). */
  availableCount: number;
  estimatedCount: number;
  unavailableCount: number;
  /** % de dados realmente disponíveis. `unavailable` NÃO conta aqui. */
  coveragePercent: number;
  /** % de itens respondidos, incluindo "não disponível". */
  reviewedPercent: number;
};

const isCoverageScope = (d: FactDefinition) =>
  d.isActive && !d.derived && d.universal && (d.importance === "core" || d.importance === "recommended");

export function businessPortraitCoverage(input: BusinessFactsInput): BusinessPortraitCoverage {
  const facts = normalizeBusinessFacts(input.definitions, input.values).filter((f) =>
    isCoverageScope(f.definition),
  );
  const applicableCount = facts.length;
  const answeredCount = facts.filter((f) => f.answered).length;
  const availableCount = facts.filter((f) => f.available).length;
  const estimatedCount = facts.filter((f) => f.estimated).length;
  const unavailableCount = facts.filter((f) => f.unavailable).length;
  const pct = (n: number) => (applicableCount === 0 ? 0 : Math.round((n / applicableCount) * 100));
  return {
    applicableCount,
    answeredCount,
    availableCount,
    estimatedCount,
    unavailableCount,
    coveragePercent: pct(availableCount),
    reviewedPercent: pct(answeredCount),
  };
}

/* ---------------- readiness ---------------- */

export type CoreFactGroup = {
  key: string;
  label: string;
  codes?: string[];
  dimension?: FactDimension;
  excludeCodes?: string[];
};

/**
 * Blocos essenciais do retrato. A exigência é que a liderança RESPONDA cada
 * bloco — informar "não tenho este dado" é resposta válida. Mesma regra da
 * RPC `f81_review_business_snapshot`.
 */
export const CORE_FACT_GROUPS: CoreFactGroup[] = [
  { key: "revenue", label: "Faturamento atual", codes: ["annual_revenue_current"] },
  { key: "headcount", label: "Colaboradores", codes: ["headcount"] },
  {
    key: "finance_extra",
    label: "Mais um dado financeiro",
    dimension: "finance",
    excludeCodes: ["annual_revenue_current"],
  },
  { key: "commercial", label: "Um dado comercial ou de clientes", dimension: "marketing_sales" },
  { key: "operations", label: "Um dado operacional", dimension: "operations" },
];

const groupMatches = (group: CoreFactGroup, d: FactDefinition): boolean => {
  if (group.codes) return group.codes.includes(d.code);
  if (group.dimension && d.dimension !== group.dimension) return false;
  if (group.excludeCodes?.includes(d.code)) return false;
  return true;
};

export type BusinessPortraitReadiness = {
  hasSnapshot: boolean;
  reviewed: boolean;
  coreAvailable: number;
  coreTotal: number;
  readyForRecommendations: boolean;
  /** Chaves dos blocos essenciais ainda sem nenhuma resposta. */
  missingCoreCodes: string[];
  missingCoreLabels: string[];
  coveragePercent: number;
  reviewedPercent: number;
  estimatedCount: number;
  unavailableCount: number;
  message: string;
};

export function businessPortraitReadiness(input: BusinessFactsInput): BusinessPortraitReadiness {
  const coverage = businessPortraitCoverage(input);
  const facts = normalizeBusinessFacts(input.definitions, input.values);
  const answered = facts.filter((f) => f.answered);

  const missing = CORE_FACT_GROUPS.filter(
    (g) => !answered.some((f) => groupMatches(g, f.definition)),
  );
  const coreTotal = CORE_FACT_GROUPS.length;
  const coreAvailable = coreTotal - missing.length;
  const hasSnapshot = Boolean(input.snapshot);
  const reviewed = input.snapshot?.reviewStatus === "reviewed";
  const coreAnswered = missing.length === 0;
  const readyForRecommendations = hasSnapshot && reviewed && coreAnswered;

  let message: string;
  if (!hasSnapshot) message = "Comece o Retrato do negócio desta unidade.";
  else if (!coreAnswered)
    message = `Faltam ${missing.length} bloco(s) essencial(is). "Não tenho este dado" também vale como resposta.`;
  else if (!reviewed) message = "Blocos essenciais respondidos. Falta revisar e confirmar o retrato.";
  else message = `Retrato revisado · ${coverage.coveragePercent}% de dados disponíveis.`;

  return {
    hasSnapshot,
    reviewed,
    coreAvailable,
    coreTotal,
    readyForRecommendations,
    missingCoreCodes: missing.map((g) => g.key),
    missingCoreLabels: missing.map((g) => g.label),
    coveragePercent: coverage.coveragePercent,
    reviewedPercent: coverage.reviewedPercent,
    estimatedCount: coverage.estimatedCount,
    unavailableCount: coverage.unavailableCount,
    message,
  };
}

/* ---------------- formatação pt-BR ---------------- */

export function formatFactValue(
  valueType: FactValueType,
  value: number | boolean | string | null,
  unit?: string | null,
): string {
  if (value === null) return "—";
  if (valueType === "boolean") return value ? "Sim" : "Não";
  if (valueType === "text_short") return String(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (valueType === "currency") {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: unit && unit.length === 3 ? unit : "BRL",
      maximumFractionDigits: 2,
    });
  }
  if (valueType === "percentage") {
    return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  const formatted = n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit && unit !== "BRL" && unit !== "%" ? `${formatted} ${unit}` : formatted;
}

/** Rótulo pt-BR de um fato derivado, sempre marcado como calculado. */
export function formatDerivedMetric(metric: DerivedMetric): string {
  if (metric.unit === "BRL") return formatFactValue("currency", metric.value, "BRL");
  if (metric.unit === "%") {
    const sign = metric.code === "revenue_growth_pct" && metric.value > 0 ? "+" : "";
    return `${sign}${formatFactValue("percentage", metric.value)}`;
  }
  return formatFactValue("number", metric.value, metric.unit);
}
