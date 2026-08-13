// FASE F8.1-A — decisões estruturadas do direcionamento estratégico.
// Todas as funções deste arquivo são PURAS e determinísticas: mesma entrada, mesma saída.
// Não há IA, aleatoriedade, data/hora ou chamada externa. Nada é inventado: cada frase
// é montada exclusivamente a partir de escolhas explícitas da liderança.
import {
  DIMENSION_LABEL,
  DIMENSIONS,
  SECTOR_LABEL,
  type Dimension,
  type SectorCode,
} from "./strategy-recommendations";
import type { IdentityInput } from "./strategy";

/* ---------------- bibliotecas de escolha ---------------- */

export type ChoiceOption = { code: string; label: string; phrase: string };
export type AmbitionOption = {
  code: string;
  label: string;
  visionPhrase: string;
  northPhrase: string;
};

export const OTHER_CODE = "other";

export const FOCUS_OPTIONS: ChoiceOption[] = [
  { code: "current_customers", label: "Clientes atuais", phrase: "os clientes atuais" },
  { code: "new_customers", label: "Novos clientes", phrase: "novos clientes" },
  { code: "key_accounts", label: "Grandes contas", phrase: "as grandes contas" },
  { code: "regional_market", label: "Mercado regional", phrase: "o mercado regional" },
  { code: "national_market", label: "Mercado nacional", phrase: "o mercado nacional" },
  { code: "internal_operation", label: "Operação interna", phrase: "a operação interna" },
  { code: "employees", label: "Colaboradores", phrase: "os colaboradores" },
  { code: "shareholders", label: "Acionistas e sócios", phrase: "os acionistas e sócios" },
];

export const VALUE_PROPOSITION_OPTIONS: ChoiceOption[] = [
  { code: "reliability", label: "Confiabilidade", phrase: "confiabilidade" },
  { code: "quality", label: "Qualidade", phrase: "qualidade" },
  { code: "productivity", label: "Produtividade", phrase: "produtividade" },
  { code: "speed", label: "Velocidade", phrase: "velocidade" },
  { code: "price", label: "Preço competitivo", phrase: "preço competitivo" },
  { code: "safety", label: "Segurança", phrase: "segurança" },
  { code: "customer_experience", label: "Experiência do cliente", phrase: "experiência do cliente" },
  { code: "predictability", label: "Previsibilidade", phrase: "previsibilidade" },
  { code: "innovation", label: "Inovação", phrase: "inovação" },
  { code: "sustainability", label: "Sustentabilidade", phrase: "sustentabilidade" },
];

export const COMPETITIVE_EDGE_OPTIONS: ChoiceOption[] = [
  { code: "operational_excellence", label: "Excelência operacional", phrase: "excelência operacional" },
  { code: "relationship", label: "Relacionamento e confiança", phrase: "relacionamento e confiança" },
  { code: "cost_leadership", label: "Liderança em custo", phrase: "liderança em custo" },
  { code: "superior_quality", label: "Qualidade superior", phrase: "qualidade superior" },
  { code: "agility", label: "Agilidade", phrase: "agilidade" },
  { code: "scale", label: "Escala", phrase: "escala" },
  { code: "technical_expertise", label: "Especialização técnica", phrase: "especialização técnica" },
  { code: "service", label: "Atendimento", phrase: "atendimento" },
  { code: "innovation", label: "Inovação", phrase: "inovação" },
];

export const AMBITION_OPTIONS: AmbitionOption[] = [
  {
    code: "grow_revenue",
    label: "Crescer receita",
    visionPhrase: "crescer receita de forma sustentável",
    northPhrase: "crescer receita",
  },
  {
    code: "increase_margin",
    label: "Aumentar margem",
    visionPhrase: "aumentar a margem do negócio",
    northPhrase: "aumentar a margem",
  },
  {
    code: "productivity",
    label: "Ganhar produtividade",
    visionPhrase: "ganhar produtividade na operação",
    northPhrase: "ganhar produtividade",
  },
  {
    code: "consolidate",
    label: "Consolidar operação",
    visionPhrase: "consolidar a operação atual",
    northPhrase: "consolidar a operação",
  },
  {
    code: "expand_market",
    label: "Expandir mercado",
    visionPhrase: "expandir a presença no mercado",
    northPhrase: "expandir mercado",
  },
  {
    code: "reduce_risk",
    label: "Reduzir riscos",
    visionPhrase: "reduzir riscos do negócio",
    northPhrase: "reduzir riscos",
  },
  {
    code: "professionalize",
    label: "Profissionalizar gestão",
    visionPhrase: "profissionalizar a gestão",
    northPhrase: "profissionalizar a gestão",
  },
  {
    code: "develop_leaders",
    label: "Desenvolver liderança",
    visionPhrase: "desenvolver a liderança da unidade",
    northPhrase: "desenvolver a liderança",
  },
  {
    code: "customer_satisfaction",
    label: "Aumentar satisfação do cliente",
    visionPhrase: "aumentar a satisfação do cliente",
    northPhrase: "aumentar a satisfação do cliente",
  },
];

export const VALUE_CODE_OPTIONS: ChoiceOption[] = [
  { code: "safety", label: "Segurança", phrase: "segurança" },
  { code: "ethics", label: "Ética", phrase: "ética" },
  { code: "discipline", label: "Disciplina", phrase: "disciplina" },
  { code: "respect", label: "Respeito", phrase: "respeito" },
  { code: "transparency", label: "Transparência", phrase: "transparência" },
  { code: "ownership", label: "Senso de dono", phrase: "senso de dono" },
  { code: "customer_focus", label: "Foco no cliente", phrase: "foco no cliente" },
  { code: "excellence", label: "Excelência", phrase: "excelência" },
  { code: "collaboration", label: "Colaboração", phrase: "colaboração" },
  { code: "simplicity", label: "Simplicidade", phrase: "simplicidade" },
  { code: "accountability", label: "Responsabilidade", phrase: "responsabilidade" },
  { code: "continuous_improvement", label: "Melhoria contínua", phrase: "melhoria contínua" },
];

export const DIRECTION_LIMITS = {
  focusGroups: { min: 1, max: 3 },
  valuePropositions: { min: 1, max: 3 },
  competitiveEdges: { min: 1, max: 2 },
  valueCodes: { min: 3, max: 5 },
} as const;

/* ---------------- contrato das escolhas ---------------- */

export type DirectionChoices = {
  focusGroups: string[];
  valuePropositions: string[];
  competitiveEdges: string[];
  ambition: string | null;
  valueCodes: string[];
  priorityDimension: Dimension | null;
  customFocus: string;
  customValueProposition: string;
  customCompetitiveEdge: string;
};

export const EMPTY_DIRECTION_CHOICES: DirectionChoices = {
  focusGroups: [],
  valuePropositions: [],
  competitiveEdges: [],
  ambition: null,
  valueCodes: [],
  priorityDimension: null,
  customFocus: "",
  customValueProposition: "",
  customCompetitiveEdge: "",
};

export type DirectionIssue = { field: keyof DirectionChoices; message: string };

export type DirectionValidation = { valid: boolean; issues: DirectionIssue[] };

const trim = (v: string | null | undefined) => (v ?? "").trim();

function checkRange(
  field: "focusGroups" | "valuePropositions" | "competitiveEdges" | "valueCodes",
  values: string[],
  label: string,
): DirectionIssue | null {
  const { min, max } = DIRECTION_LIMITS[field];
  if (values.length < min) {
    return { field, message: `Selecione de ${min} a ${max} ${label}.` };
  }
  if (values.length > max) {
    return { field, message: `Selecione no máximo ${max} ${label}.` };
  }
  return null;
}

/** Uma escolha `Outro` só é válida quando o texto curto correspondente foi preenchido. */
function checkOther(
  field: keyof DirectionChoices,
  values: string[],
  custom: string,
  message: string,
): DirectionIssue | null {
  if (values.includes(OTHER_CODE) && trim(custom).length === 0) {
    return { field, message };
  }
  return null;
}

export function validateDirectionChoices(choices: DirectionChoices): DirectionValidation {
  const issues: DirectionIssue[] = [];
  const push = (i: DirectionIssue | null) => {
    if (i) issues.push(i);
  };

  push(checkRange("focusGroups", choices.focusGroups, "focos do ciclo"));
  push(checkRange("valuePropositions", choices.valuePropositions, "entregas de valor"));
  push(checkRange("competitiveEdges", choices.competitiveEdges, "formas de competir"));
  push(checkRange("valueCodes", choices.valueCodes, "comportamentos inegociáveis"));

  push(checkOther("customFocus", choices.focusGroups, choices.customFocus, "Descreva o outro foco escolhido."));
  push(
    checkOther(
      "customValueProposition",
      choices.valuePropositions,
      choices.customValueProposition,
      "Descreva a outra entrega de valor escolhida.",
    ),
  );
  push(
    checkOther(
      "customCompetitiveEdge",
      choices.competitiveEdges,
      choices.customCompetitiveEdge,
      "Descreva a outra forma de competir escolhida.",
    ),
  );

  if (!choices.ambition) {
    issues.push({ field: "ambition", message: "Escolha a principal ambição do ciclo." });
  }
  if (!choices.priorityDimension) {
    issues.push({
      field: "priorityDimension",
      message: "Escolha o tema prioritário que resolve o maior gargalo agora.",
    });
  }

  return { valid: issues.length === 0, issues };
}

/* ---------------- rótulos e frases ---------------- */

const byCode = (options: ChoiceOption[]) => new Map(options.map((o) => [o.code, o]));
const FOCUS = byCode(FOCUS_OPTIONS);
const VALUES_PROP = byCode(VALUE_PROPOSITION_OPTIONS);
const EDGES = byCode(COMPETITIVE_EDGE_OPTIONS);
const BEHAVIOURS = byCode(VALUE_CODE_OPTIONS);
const AMBITIONS = new Map(AMBITION_OPTIONS.map((o) => [o.code, o]));

export function ambitionOption(code: string | null): AmbitionOption | null {
  return code ? AMBITIONS.get(code) ?? null : null;
}

function resolve(
  codes: string[],
  map: Map<string, ChoiceOption>,
  custom: string,
  kind: "label" | "phrase",
): string[] {
  const out: string[] = [];
  for (const code of codes) {
    if (code === OTHER_CODE) {
      const text = trim(custom);
      if (text.length > 0) out.push(text);
      continue;
    }
    const option = map.get(code);
    if (option) out.push(kind === "label" ? option.label : option.phrase);
  }
  return out;
}

export function focusLabels(c: DirectionChoices): string[] {
  return resolve(c.focusGroups, FOCUS, c.customFocus, "label");
}
export function valuePropositionLabels(c: DirectionChoices): string[] {
  return resolve(c.valuePropositions, VALUES_PROP, c.customValueProposition, "label");
}
export function competitiveEdgeLabels(c: DirectionChoices): string[] {
  return resolve(c.competitiveEdges, EDGES, c.customCompetitiveEdge, "label");
}
export function behaviourLabels(c: DirectionChoices): string[] {
  return resolve(c.valueCodes, BEHAVIOURS, "", "label");
}

/** Junta itens em português: "a, b e c". */
export function joinList(items: string[]): string {
  const clean = items.map((i) => trim(i)).filter((i) => i.length > 0);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0]!;
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

const capitalize = (v: string) => (v.length === 0 ? v : v[0]!.toUpperCase() + v.slice(1));

export type DirectionContext = {
  sectorCode?: SectorCode | null;
  horizonYears?: number | null;
};

/* ---------------- síntese determinística ---------------- */

/** Missão: quem servimos + valor entregue + modo principal. Vazio sem escolhas. */
export function synthesizeMission(c: DirectionChoices, ctx: DirectionContext = {}): string {
  const focus = joinList(resolve(c.focusGroups, FOCUS, c.customFocus, "phrase"));
  const value = joinList(resolve(c.valuePropositions, VALUES_PROP, c.customValueProposition, "phrase"));
  const edge = joinList(resolve(c.competitiveEdges, EDGES, c.customCompetitiveEdge, "phrase"));
  if (!focus || !value) return "";
  const sector =
    ctx.sectorCode && ctx.sectorCode !== "general" ? ` no setor de ${SECTOR_LABEL[ctx.sectorCode]}` : "";
  const base = `Atender ${focus} com ${value}${sector}`;
  return edge ? `${base}, sustentados por ${edge}.` : `${base}.`;
}

/** Visão: ambição + horizonte do ciclo + reconhecimento desejado. */
export function synthesizeVision(c: DirectionChoices, ctx: DirectionContext = {}): string {
  const ambition = ambitionOption(c.ambition);
  if (!ambition) return "";
  const edge = joinList(resolve(c.competitiveEdges, EDGES, c.customCompetitiveEdge, "phrase"));
  const years = typeof ctx.horizonYears === "number" && ctx.horizonYears > 0 ? ctx.horizonYears : null;
  const horizon = years ? (years === 1 ? " no próximo ano" : ` nos próximos ${years} anos`) : " neste ciclo";
  const recognition = edge ? ` e ser reconhecida por ${edge}` : "";
  return `${capitalize(ambition.visionPhrase)}${horizon}${recognition}.`;
}

/** Valores: exatamente os comportamentos escolhidos, sem acréscimo. */
export function synthesizeValues(c: DirectionChoices): string {
  const labels = behaviourLabels(c);
  if (labels.length === 0) return "";
  return `${labels.join(", ")}.`;
}

/** Norte: prioridade principal + ambição do ciclo. */
export function synthesizeStrategicNorth(c: DirectionChoices): string {
  const ambition = ambitionOption(c.ambition);
  if (!c.priorityDimension || !ambition) return "";
  return `${DIMENSION_LABEL[c.priorityDimension]} é a prioridade deste ciclo para ${ambition.northPhrase}.`;
}

export function synthesizeStrategicIdentity(
  c: DirectionChoices,
  ctx: DirectionContext = {},
): IdentityInput {
  return {
    mission: synthesizeMission(c, ctx),
    vision: synthesizeVision(c, ctx),
    valuesText: synthesizeValues(c),
    strategicNorth: synthesizeStrategicNorth(c),
  };
}

/* ---------------- substituição de conteúdo existente ---------------- */

export type ReplacementDecision = {
  /** já existe qualquer texto formal preenchido */
  hasExisting: boolean;
  /** a síntese difere do texto atual */
  differs: boolean;
  /** confirmação humana obrigatória antes de gravar */
  requiresConfirmation: boolean;
};

const same = (a: string | null | undefined, b: string | null | undefined) => trim(a) === trim(b);

export function identityReplacement(
  current: {
    mission?: string | null;
    vision?: string | null;
    valuesText?: string | null;
    strategicNorth?: string | null;
  } | null,
  next: IdentityInput,
): ReplacementDecision {
  const fields = [
    [current?.mission, next.mission],
    [current?.vision, next.vision],
    [current?.valuesText, next.valuesText],
    [current?.strategicNorth, next.strategicNorth],
  ] as const;
  const hasExisting = fields.some(([cur]) => trim(cur).length > 0);
  const differs = fields.some(([cur, nxt]) => !same(cur, nxt));
  return { hasExisting, differs, requiresConfirmation: hasExisting && differs };
}

/** Dimensões oferecidas quando a Jornada ainda não registrou prioridades. */
export const PRIORITY_DIMENSION_OPTIONS: { code: Dimension; label: string }[] = DIMENSIONS.map(
  (d) => ({ code: d, label: DIMENSION_LABEL[d] }),
);
