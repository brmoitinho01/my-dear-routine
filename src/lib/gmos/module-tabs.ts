// Abas visíveis dos módulos simplificados. Lógica pura e testável;
// a proteção real continua nas rotas e na RLS.
import type { Authorization } from "./rbac";

export type PlanningTabKey = "objetivos" | "kpis" | "medicoes";
export type ActionTabKey = "acoes" | "rotinas";

export const PLANNING_TABS: { key: PlanningTabKey; label: string }[] = [
  { key: "objetivos", label: "Objetivos" },
  { key: "kpis", label: "KPIs" },
  { key: "medicoes", label: "Medições" },
];

/** Planejamento Estratégico tem sempre as três áreas para quem lê o módulo. */
export function planningTabs(): { key: PlanningTabKey; label: string }[] {
  return PLANNING_TABS;
}

/**
 * Plano de Ação: `action.read` habilita a aba de ações e `routine.read` a de rotinas.
 * Com as duas permissões, as duas abas aparecem; sem nenhuma, nada é exibido.
 */
export function actionModuleTabs(
  authz: Authorization | null,
): { key: ActionTabKey; label: string }[] {
  if (!authz) return [];
  const tabs: { key: ActionTabKey; label: string }[] = [];
  if (authz.can("action.read")) tabs.push({ key: "acoes", label: "Planos de ação" });
  if (authz.can("routine.read")) tabs.push({ key: "rotinas", label: "Rotinas" });
  return tabs;
}
