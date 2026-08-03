// FASE F6 — catálogo canônico do Método GMOS.
// Este módulo descreve metodologia e estrutura oficial do Grupo Moitinho.
// Não contém dados operacionais, números de desempenho ou registros fictícios.

export type MethodStage = {
  order: number;
  key: "direcionar" | "diagnosticar" | "planejar" | "executar" | "controlar";
  title: string;
  purpose: string;
  question: string;
  /** Estado real da implementação no aplicativo. */
  state: "available" | "partial" | "planned";
};

export const METHOD_STAGES: MethodStage[] = [
  {
    order: 1,
    key: "direcionar",
    title: "Direcionar",
    purpose: "Definir identidade estratégica, propósito e prioridades do ciclo.",
    question: "Para onde a empresa vai?",
    state: "planned",
  },
  {
    order: 2,
    key: "diagnosticar",
    title: "Diagnosticar",
    purpose: "Entender a situação atual de forma resumida e honesta.",
    question: "Onde a empresa está?",
    state: "planned",
  },
  {
    order: 3,
    key: "planejar",
    title: "Planejar",
    purpose: "Traduzir direção em objetivos, indicadores, metas e iniciativas.",
    question: "O que será feito e como será medido?",
    state: "available",
  },
  {
    order: 4,
    key: "executar",
    title: "Executar",
    purpose: "Conduzir ações e rotinas com responsável, prazo e evidência.",
    question: "Quem faz, quando e com qual evidência?",
    state: "available",
  },
  {
    order: 5,
    key: "controlar",
    title: "Controlar e aprender",
    purpose: "Comparar resultado com meta, decidir em reunião e revisar o ciclo.",
    question: "Funcionou? O que muda a partir disso?",
    state: "partial",
  },
];

export const STATE_LABEL: Record<MethodStage["state"], string> = {
  available: "Disponível nesta versão",
  partial: "Parcialmente disponível",
  planned: "Próximas fases",
};

/** Cadeia central universal do GMOS. */
export const CORE_CHAIN = [
  "Empresa",
  "Ciclo",
  "Diagnóstico",
  "Objetivo",
  "Indicador",
  "Meta",
  "Iniciativa",
  "Ação",
  "Controle",
  "Reunião",
  "Decisão",
] as const;

export type OrgLevel = { order: number; title: string; description: string };

export const ORG_LEVELS: OrgLevel[] = [
  { order: 1, title: "Grupo", description: "Consolidação e direção corporativa do Grupo Moitinho." },
  { order: 2, title: "Empresa", description: "Cada negócio com ciclo, objetivos e indicadores próprios." },
  { order: 3, title: "Unidade/filial", description: "Operação local com metas e rotinas próprias." },
  { order: 4, title: "Área", description: "Departamento ou frente responsável pela execução." },
];

export type MaturityStage = {
  order: number;
  key: "essencial" | "estruturado" | "gerenciado" | "otimizado";
  title: string;
  description: string;
  unlocks: string[];
};

export const MATURITY_STAGES: MaturityStage[] = [
  {
    order: 1,
    key: "essencial",
    title: "Essencial",
    description: "Direção mínima viável: ciclo, poucos objetivos, indicadores e responsáveis.",
    unlocks: ["Ciclo", "3 a 7 objetivos", "1 a 3 indicadores por objetivo", "Ações e rotinas"],
  },
  {
    order: 2,
    key: "estruturado",
    title: "Estruturado",
    description: "Rotina de gestão consolidada, com reuniões, decisões e evidências.",
    unlocks: ["Iniciativas", "Reuniões e decisões", "Riscos principais", "Orçamento essencial"],
  },
  {
    order: 3,
    key: "gerenciado",
    title: "Gerenciado",
    description: "Gestão por desdobramento entre níveis e controle mais formal.",
    unlocks: ["Desdobramento por área", "Mapa de processos", "Riscos avançados", "Auditorias"],
  },
  {
    order: 4,
    key: "otimizado",
    title: "Otimizado",
    description: "Análises avançadas e melhoria contínua orientada por dados.",
    unlocks: ["PESTEL e Cinco Forças", "Stakeholders detalhados", "Cenários", "OKRs avançados", "ESG e compliance"],
  },
];

export type CoreDomain = { order: number; title: string; description: string };

/** Doze domínios centrais que substituem tabelas isoladas por setor. */
export const CORE_DOMAINS: CoreDomain[] = [
  { order: 1, title: "Organização e estrutura", description: "Grupo, empresas, unidades e áreas." },
  { order: 2, title: "Pessoas e acesso", description: "Usuários, papéis, permissões por escopo." },
  { order: 3, title: "Configuração e maturidade", description: "Nível de maturidade e módulos ativos por empresa." },
  { order: 4, title: "Identidade estratégica", description: "Propósito, missão, visão, valores e posicionamento." },
  { order: 5, title: "Ciclos", description: "Períodos de planejamento em qualquer nível organizacional." },
  { order: 6, title: "Diagnóstico", description: "Leitura da situação atual, simples ou avançada por tipo." },
  { order: 7, title: "Objetivos e temas", description: "Prioridades do ciclo agrupadas por tema ou pilar." },
  { order: 8, title: "Indicadores e metas", description: "KPI com fórmula e fonte, meta por período e medições." },
  { order: 9, title: "Iniciativas e ações", description: "Projetos e ações 5W2H ligados a objetivo e indicador." },
  { order: 10, title: "Rotinas e controles", description: "Execução recorrente, checagens e evidências." },
  { order: 11, title: "Governança e aprendizado", description: "Reuniões, decisões, riscos, revisões e auditoria." },
  { order: 12, title: "Economia e custos", description: "Orçamento essencial e custos compartilhados." },
];

export type OfficialCompany = {
  key: string;
  /** Nome oficial usado para conferência com o cadastro real. */
  name: string;
  /** Nomes equivalentes já cadastrados na base. */
  aliases: string[];
  role: string;
  purpose: string;
  modules: string[];
};

/**
 * Estrutura oficial do Grupo Moitinho.
 * Elite Construção e Incorporação foi removida da estrutura ativa e não deve constar aqui.
 */
export const OFFICIAL_COMPANIES: OfficialCompany[] = [
  {
    key: "rm-mineracao",
    name: "RM Mineração",
    aliases: ["RM Mineracao"],
    role: "Operação de mineração",
    purpose: "Extração e beneficiamento mineral com controle ambiental e de ativos.",
    modules: [
      "Lavra",
      "Britagem",
      "Manutenção pesada",
      "Licenciamento",
      "Transporte",
      "Controle ambiental",
    ],
  },
  {
    key: "xrm-premoldados",
    name: "XRM Premoldados",
    aliases: ["XRM Pré-Moldados", "XRM Pre-Moldados", "XRM Pré Moldados"],
    role: "Indústria de pré-moldados",
    purpose: "Produção industrial com qualidade e expedição controladas.",
    modules: [
      "Produção",
      "Dosagem",
      "Prensagem",
      "Cura",
      "Qualidade",
      "Paletização",
      "Expedição",
    ],
  },
  {
    key: "xrm-construtora",
    name: "XRM Construtora",
    aliases: [],
    role: "Construção civil",
    purpose: "Execução de obras e contratos com custo por empreendimento.",
    modules: [
      "Obras",
      "Contratos",
      "Cronogramas",
      "Medições",
      "Suprimentos",
      "Custos por empreendimento",
    ],
  },
  {
    key: "blue-house",
    name: "Blue House",
    aliases: [],
    role: "Projetos e soluções sob medida",
    purpose: "Venda consultiva, fabricação, montagem e pós-venda.",
    modules: ["Projetos", "Vendas consultivas", "Medição", "Fabricação", "Montagem", "Pós-venda"],
  },
  {
    key: "meu-querido",
    name: "Meu Querido",
    aliases: [],
    role: "Alimentação e experiência",
    purpose: "Operação de restaurante com padrão, custo e experiência do cliente.",
    modules: [
      "Salão",
      "Cozinha",
      "Estoque",
      "Fichas técnicas",
      "CMV",
      "Experiência do cliente",
      "Produção por praça",
    ],
  },
  {
    key: "toca-hub",
    name: "Toca Hub",
    aliases: [],
    role: "Centro de serviços e custos compartilhados",
    purpose:
      "Atende as demais empresas do Grupo como cliente interno, com SLA e rateio de custos compartilhados.",
    modules: [
      "Clientes internos",
      "Serviços compartilhados",
      "Demandas",
      "Projetos",
      "SLA",
      "Custos compartilhados",
      "Tecnologia",
      "Marketing",
      "Financeiro",
      "Pessoas",
      "Processos",
    ],
  },
];

const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

/** Compara o catálogo oficial com os nomes realmente retornados pela consulta. */
export function matchOfficialCompany(company: OfficialCompany, registeredNames: string[]): boolean {
  const targets = [company.name, ...company.aliases].map(norm);
  return registeredNames.some((n) => targets.includes(norm(n)));
}

export const PILLARS = [
  {
    title: "Universal",
    description:
      "O mesmo núcleo de gestão serve mineração, indústria, construção, varejo, serviços e centro compartilhado.",
  },
  {
    title: "Modular",
    description:
      "Cada empresa ativa apenas os módulos setoriais que usa, sem duplicar o núcleo estratégico.",
  },
  {
    title: "Evolutivo",
    description:
      "Começa no Essencial e avança de maturidade sem reconstrução do modelo de dados.",
  },
] as const;
