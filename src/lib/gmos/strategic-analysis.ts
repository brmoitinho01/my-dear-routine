// F13 — Ferramentas de análise estratégica com notas de 1 a 5.
// Lógica pura: catálogo das ferramentas e cálculo determinístico das médias.

export type ToolCode =
  | "pest"
  | "porter"
  | "atratividade"
  | "ciclo_vida"
  | "fcs"
  | "competencias"
  | "estrategias";

export type AnalysisGroup = { key: string; title: string; items: { key: string; label: string }[] };

export type AnalysisTool = {
  code: ToolCode;
  title: string;
  description: string;
  scale: string[];
  columns: { key: string; label: string; editable?: boolean }[];
  /** Linhas com nome editável pelo usuário (ex.: competências). */
  editableRows?: boolean;
  groups: AnalysisGroup[];
  /** Como interpretar o resultado. */
  verdict?: "highest_group";
};

export type AnalysisData = {
  scores?: Record<string, number>;
  notes?: Record<string, string>;
  labels?: Record<string, string>;
};

const AGREE = ["Discordo totalmente", "Discordo", "Em parte", "Concordo", "Concordo totalmente"];
const LEVEL = ["Desprezível", "Baixa", "Média", "Alta", "Muito alta"];
const ATTRACT = ["Muito pouco atrativo", "Pouco atrativo", "Neutro", "Atrativo", "Muito atrativo"];
const STRENGTH = ["Muito fraco", "Fraco", "Regular", "Bom", "Excelente"];

const g = (key: string, title: string, labels: string[]): AnalysisGroup => ({
  key,
  title,
  items: labels.map((label, i) => ({ key: `${key}_${i + 1}`, label })),
});

export const ANALYSIS_TOOLS: AnalysisTool[] = [
  {
    code: "pest",
    title: "Análise PEST",
    description:
      "Para cada fator do ambiente, avalie o quanto ele representa oportunidade e ameaça para a empresa.",
    scale: LEVEL,
    columns: [
      { key: "op", label: "Oportunidade" },
      { key: "am", label: "Ameaça" },
    ],
    groups: [
      g("politico", "Político", [
        "Carga tributária e incentivos",
        "Mudanças de legislação",
        "Direito do consumidor",
        "Legislação trabalhista",
        "Fiscalização",
        "Infraestrutura pública",
      ]),
      g("economico", "Econômico", [
        "Crescimento da economia",
        "Inflação",
        "Taxa de juros e crédito",
        "Renda e emprego da população",
        "Câmbio",
        "Custo dos insumos",
      ]),
      g("social", "Social", [
        "Hábitos e estilo de vida",
        "Crescimento da população local",
        "Preocupação com saúde e bem-estar",
        "Segurança pública",
        "Turismo e eventos",
      ]),
      g("tecnologico", "Tecnológico", [
        "Vendas e pedidos digitais",
        "Novos equipamentos e processos",
        "Redes sociais e marketing digital",
        "Automação e sistemas de gestão",
      ]),
    ],
  },
  {
    code: "porter",
    title: "5 Forças de Porter",
    description:
      "Avalie cada afirmação. Médias altas indicam força intensa, ou seja, maior pressão sobre a empresa.",
    scale: AGREE,
    columns: [{ key: "n", label: "Nota" }],
    groups: [
      g("entrantes", "Entrada de novos concorrentes", [
        "É possível ser pequeno para entrar no negócio",
        "Os concorrentes têm marcas pouco conhecidas",
        "O investimento inicial é baixo",
        "Os clientes têm baixo custo para trocar de fornecedor",
        "O mercado não está saturado",
      ]),
      g("rivalidade", "Rivalidade entre concorrentes", [
        "Há muitos concorrentes de porte parecido",
        "O mercado cresce pouco",
        "Os produtos são pouco diferenciados",
        "Há guerra de preços frequente",
      ]),
      g("substitutos", "Ameaça de produtos substitutos", [
        "Existem substitutos com preço mais baixo",
        "Os substitutos têm qualidade parecida",
        "O cliente troca facilmente pelo substituto",
      ]),
      g("clientes", "Poder dos clientes", [
        "Poucos clientes concentram as vendas",
        "Os clientes pesquisam muito preço",
        "Os clientes conhecem bem o produto",
      ]),
      g("fornecedores", "Poder dos fornecedores", [
        "Há poucos fornecedores dos principais insumos",
        "É caro trocar de fornecedor",
        "Os fornecedores impõem preços e prazos",
      ]),
    ],
  },
  {
    code: "atratividade",
    title: "Atratividade do setor",
    description: "Avalie cada fator hoje e como espera que ele esteja no futuro.",
    scale: ATTRACT,
    columns: [
      { key: "pr", label: "Presente" },
      { key: "fu", label: "Futuro" },
    ],
    groups: [
      g("mercado", "Fatores de mercado", [
        "Tamanho do mercado",
        "Crescimento do mercado",
        "Diferenciação dos produtos",
        "Sensibilidade a preços",
        "Sazonalidade",
        "Rentabilidade do setor",
      ]),
      g("competitivos", "Fatores competitivos", [
        "Intensidade da concorrência",
        "Barreiras de entrada",
        "Barreiras de saída",
        "Existência de substitutos",
      ]),
      g("economicos", "Fatores econômicos e governamentais", [
        "Inflação",
        "Juros e crédito",
        "Tributação",
        "Regulamentação",
      ]),
    ],
  },
  {
    code: "ciclo_vida",
    title: "Ciclo de vida do setor",
    description:
      "Avalie cada afirmação. O estágio com a maior média indica a fase atual do produto ou serviço.",
    scale: AGREE,
    columns: [{ key: "n", label: "Nota" }],
    verdict: "highest_group",
    groups: [
      g("introducao", "Introdução", [
        "O produto ou serviço é novidade no mercado",
        "Ainda não há mercado consolidado",
        "Exige alto investimento em divulgação",
        "Ainda não há padrão de qualidade definido",
      ]),
      g("crescimento", "Crescimento", [
        "O setor está em forte crescimento",
        "O produto já é reconhecido pelos clientes",
        "Novas empresas estão entrando no setor",
        "As vendas crescem mês a mês",
      ]),
      g("maturidade", "Maturidade", [
        "O mercado está estável",
        "A concorrência é forte e conhecida",
        "Os preços estão pressionados",
        "Crescer exige tirar clientes dos concorrentes",
      ]),
      g("declinio", "Declínio", [
        "As vendas do setor estão caindo",
        "Empresas estão saindo do setor",
        "Os clientes migram para substitutos",
      ]),
    ],
  },
  {
    code: "fcs",
    title: "Fatores-chave de sucesso × concorrentes",
    description:
      "Compare a empresa com os principais concorrentes em cada fator. Renomeie as colunas dos concorrentes.",
    scale: STRENGTH,
    columns: [
      { key: "nos", label: "Nossa empresa" },
      { key: "c1", label: "Concorrente 1", editable: true },
      { key: "c2", label: "Concorrente 2", editable: true },
      { key: "c3", label: "Concorrente 3", editable: true },
    ],
    groups: [
      g("fatores", "Fatores", [
        "Rapidez",
        "Qualidade",
        "Distribuição e entrega",
        "Preço",
        "Confiabilidade",
        "Escala de produção",
        "Atendimento",
        "Pós-venda",
      ]),
    ],
  },
  {
    code: "competencias",
    title: "Competências da empresa",
    description:
      "Liste as competências da empresa e avalie se cada uma é valiosa, sustentável e versátil.",
    scale: AGREE,
    editableRows: true,
    columns: [
      { key: "val", label: "Valiosa" },
      { key: "sus", label: "Sustentável" },
      { key: "ver", label: "Versátil" },
    ],
    groups: [
      g("competencias", "Competências", [
        "Competência 1",
        "Competência 2",
        "Competência 3",
        "Competência 4",
        "Competência 5",
      ]),
    ],
  },
  {
    code: "estrategias",
    title: "Estratégias genéricas",
    description:
      "Avalie cada afirmação. A estratégia com a maior média é a que melhor descreve a empresa.",
    scale: AGREE,
    columns: [{ key: "n", label: "Nota" }],
    verdict: "highest_group",
    groups: [
      g("custo", "Liderança em custo", [
        "Temos o menor custo entre os concorrentes",
        "Compramos em escala e com bom preço",
        "Nossos processos são enxutos e padronizados",
      ]),
      g("diferenciacao", "Diferenciação", [
        "Nosso produto é percebido como único",
        "O cliente aceita pagar mais pela nossa marca",
        "Investimos em inovação e experiência",
      ]),
      g("foco", "Foco", [
        "Atendemos um público específico",
        "Conhecemos profundamente nosso nicho",
        "Concentramos esforços em poucos produtos",
      ]),
    ],
  },
];

export const scoreKey = (itemKey: string, colKey: string) => `${itemKey}:${colKey}`;

export function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export type GroupResult = {
  key: string;
  title: string;
  /** média por coluna (null quando nada foi preenchido) */
  columns: Record<string, number | null>;
  average: number | null;
  answered: number;
  total: number;
};

export type ToolResult = {
  groups: GroupResult[];
  /** média por coluna considerando todas as linhas */
  columns: Record<string, number | null>;
  average: number | null;
  answered: number;
  total: number;
  /** linha → média (para ferramentas com várias colunas) */
  rows: Record<string, number | null>;
  verdict: { key: string; title: string; average: number } | null;
};

/** Notas vazias ou fora de 1–5 são ignoradas, nunca tratadas como zero. */
export function computeToolResult(tool: AnalysisTool, data: AnalysisData | null): ToolResult {
  const scores = data?.scores ?? {};
  const allByCol: Record<string, number[]> = {};
  const all: number[] = [];
  const rows: Record<string, number | null> = {};
  let answered = 0;
  let total = 0;

  const groups = tool.groups.map((grp) => {
    const byCol: Record<string, number[]> = {};
    const values: number[] = [];
    let gAnswered = 0;
    for (const item of grp.items) {
      const rowVals: number[] = [];
      for (const col of tool.columns) {
        total += 1;
        const v = scores[scoreKey(item.key, col.key)];
        if (!isValidScore(v)) continue;
        gAnswered += 1;
        (byCol[col.key] ??= []).push(v);
        (allByCol[col.key] ??= []).push(v);
        values.push(v);
        all.push(v);
        rowVals.push(v);
      }
      rows[item.key] = avg(rowVals);
    }
    answered += gAnswered;
    return {
      key: grp.key,
      title: grp.title,
      columns: Object.fromEntries(tool.columns.map((c) => [c.key, avg(byCol[c.key] ?? [])])),
      average: avg(values),
      answered: gAnswered,
      total: grp.items.length * tool.columns.length,
    };
  });

  let verdict: ToolResult["verdict"] = null;
  if (tool.verdict === "highest_group") {
    for (const grp of groups) {
      if (grp.average === null) continue;
      if (!verdict || grp.average > verdict.average)
        verdict = { key: grp.key, title: grp.title, average: grp.average };
    }
  }

  return {
    groups,
    columns: Object.fromEntries(tool.columns.map((c) => [c.key, avg(allByCol[c.key] ?? [])])),
    average: avg(all),
    answered,
    total,
    rows,
    verdict,
  };
}

export function getTool(code: ToolCode): AnalysisTool {
  const t = ANALYSIS_TOOLS.find((x) => x.code === code);
  if (!t) throw new Error(`Ferramenta desconhecida: ${code}`);
  return t;
}
