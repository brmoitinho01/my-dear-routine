// FASE F7-B — catálogo de navegação com requisito de permissão por item.
// A filtragem é pura e testável; a proteção real fica nas rotas e na RLS.
import type { Authorization } from "./rbac";

export type NavKey =
  | "inicio"
  | "meu-trabalho"
  | "painel-equipe"
  | "painel-grupo"
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
  { key: "inicio", to: "/", label: "Início", order: 40 },
  {
    key: "meu-trabalho",
    to: "/meu-trabalho",
    label: "Meu trabalho",
    requires: "dashboard.personal",
    order: 10,
  },
  {
    key: "painel-equipe",
    to: "/painel-equipe",
    label: "Painel da equipe",
    requires: "dashboard.team",
    order: 20,
  },
  {
    key: "painel-grupo",
    to: "/painel-grupo",
    label: "Painel do Grupo",
    requires: "dashboard.group",
    order: 30,
  },
  { key: "metodo", to: "/metodo", label: "Método GMOS", order: 50 },
  {
    key: "planejamento",
    to: "/planejamento",
    label: "Planejamento",
    requires: "strategy.read",
    order: 60,
  },
  {
    key: "planos-de-acao",
    to: "/planos-de-acao",
    label: "Planos de ação",
    requires: "action.read",
    order: 70,
  },
  { key: "rotinas", to: "/rotinas", label: "Rotinas", requires: "routine.read", order: 80 },
  {
    key: "apresentacao",
    to: "/apresentacao",
    label: "Apresentação",
    requires: "strategy.read",
    order: 90,
  },
  {
    key: "estrutura",
    to: "/estrutura",
    label: "Estrutura",
    requires: "structure.read",
    order: 100,
  },
  { key: "acessos", to: "/acessos", label: "Acessos", order: 110 },
];

/**
 * Ordem de destaque por papel principal. Itens não listados mantêm a ordem base,
 * sempre depois dos promovidos. Nenhuma área é escondida por aqui.
 */
export const ROLE_NAV_PRIORITY: Record<string, NavKey[]> = {
  group_owner: ["painel-grupo", "inicio"],
  group_admin: ["inicio", "painel-grupo"],
  manager: ["painel-equipe", "meu-trabalho"],
  collaborator: ["meu-trabalho", "rotinas"],
};

/** Ordenação determinística: promovidos do papel primeiro, depois a ordem base. */
export function orderNavForRole(items: NavItem[], primaryRole: string | null): NavItem[] {
  const priority = (primaryRole && ROLE_NAV_PRIORITY[primaryRole]) || [];
  const rank = (item: NavItem) => {
    const i = priority.indexOf(item.key);
    return i === -1 ? priority.length : i;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || a.order - b.order);
}

/** Itens visíveis para a autorização informada, já ordenados pelo papel principal. */
export function filterNav(items: NavItem[], authz: Authorization | null): NavItem[] {
  if (!authz) return [];
  const visible = items.filter((item) => {
    if (item.key === "acessos") return authz.isGroupPrivileged || authz.can("role.read");
    if (!item.requires) return true;
    return authz.can(item.requires);
  });
  return orderNavForRole(visible, authz.primaryRole);
}
