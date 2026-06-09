export const MOMENT_LABEL = { abertura: "Abertura", fechamento: "Fechamento" } as const;
export const RESPONSE_LABEL = { conforme: "Conforme", nao_conforme: "Não conforme", na: "N/A" } as const;
export const SEVERITY_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" } as const;
export const NC_STATUS_LABEL = { aberta: "Aberta", em_tratamento: "Em tratamento", resolvida: "Resolvida", cancelada: "Cancelada" } as const;
export const ACTION_STATUS_LABEL = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída", atrasada: "Atrasada" } as const;

export function todayISO() {
  // America/Sao_Paulo local date (server uses same default)
  const d = new Date();
  const tz = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = tz.getFullYear();
  const m = String(tz.getMonth() + 1).padStart(2, "0");
  const day = String(tz.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}