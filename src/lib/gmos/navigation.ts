// FASE F7 — catálogo de navegação com requisito de permissão por item.
// A filtragem é pura e testável; a proteção real fica nas rotas e na RLS.
import type { Authorization } from "./rbac";

export type NavKey =
  | "meu-trabalho"
  | "painel-grupo"
  | "painel-equipe"
  | "inicio"
  | "metodo"
  | "planejamento"
  | "planos-de-acao"
  | "rotinas"
  | "apresentacao"
  | "estrutura"
  | "acessos";

export type NavItem = {
  key: NavKey;
  to: string;
  label: string;
  /** Permissão mínima exigida em qualquer escopo do usuário. */
  requires?: string;
  /** Ordem base; o papel principal pode promover itens. */
  order: number;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "painel-grupo", to: "/painel-grupo", label: "Painel do Grupo", requires: "dashboard.group", order: 10 },
  { key: "painel-equipe", to: "/painel-equipe", label: "Painel da equipe", requires: "dashboard.team", order: 20 },
  { key: "meu-trabalho", to: "/meu-trabalho", label: "Meu trabalho", requires: "dashboard.personal", order: 30 },
  { key: "inicio", to: "/", label: "Início", order: 40 },
  { key: "metodo", to: "/metodo", label: "Método GMOS", order: 50 },
  { key: "planejamento", to: "/planejamento", label: "Planejamento", requires: "strategy.read", order: 60 },
  { key: "planos-de-acao", to: "/planos-de-acao", label: "Planos de ação", requires: "action.read", order: 70 },
  { key: "rotinas", to: "/rotinas", label: "Rotinas", requires: "routine.read", order: 80 },
  { key: "apresentacao", to: "/apresentacao", label: "Apresentação", requires: "strategy.read", order: 90 },
  { key: "estrutura", to: "/estrutura", label: "Estrutura", requires: "structure.read", order: 100 },
  { key: "acessos", to: "/acessos", label: "Acessos", order: 110 },
];

/** Itens visíveis para a autorização informada, já ordenados. */
export function filterNav(items: NavItem[], authz: Authorization | null): NavItem[] {
  if (!authz) return [];
  const visible = items.filter((item) => {
    if (item.key === "acessos") return authz.isGroupPrivileged || authz.can("role.read");
    if (!item.requires) return true;
    return authz.can(item.requires);
  });
  return visible.sort((a, b) => a.order - b.order);
}