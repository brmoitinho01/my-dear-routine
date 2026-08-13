// FASE F7-B — catálogo de navegação com requisito de permissão por item.
// A filtragem é pura e testável; a proteção real fica nas rotas e na RLS.
import type { Authorization } from "./rbac";

export type NavKey =
  | "inicio"
  | "meu-trabalho"
  | "painel-equipe"
  | "painel-grupo"
  | "metodo"
  | "jornada-estrategica"
  | "planejamento"
  | "planos-de-acao"
  | "rotinas"
  | "apresentacao"
  | "estrutura"
  | "organograma"
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

/**
 * Menu simplificado: somente três módulos visíveis.
 * As rotas antigas continuam existindo e acessíveis por URL; apenas saíram do menu.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "inicio", to: "/", label: "Visão Geral", order: 10 },
  {
    key: "planejamento",
    to: "/planejamento",
    label: "Planejamento Estratégico",
    requires: "strategy.read",
    order: 20,
  },
  {
    key: "planos-de-acao",
    to: "/planos-de-acao",
    label: "Plano de Ação",
    requires: "action.read",
    order: 30,
  },
];

/** Itens deliberadamente fora do menu (rotas preservadas). */
export const HIDDEN_NAV_KEYS: NavKey[] = [
  "meu-trabalho",
  "painel-equipe",
  "painel-grupo",
  "metodo",
  "jornada-estrategica",
  "rotinas",
  "apresentacao",
  "estrutura",
  "organograma",
  "acessos",
];

/**
 * Ordem de destaque por papel principal. Itens não listados mantêm a ordem base,
 * sempre depois dos promovidos. Nenhuma área é escondida por aqui.
 */
export const ROLE_NAV_PRIORITY: Record<string, NavKey[]> = {
  group_owner: ["inicio"],
  group_admin: ["inicio"],
  manager: ["inicio"],
  collaborator: ["inicio"],
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
