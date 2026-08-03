// FASE F7-E — seleção pura do destaque da home por perfil.
// Não concede acesso: apenas escolhe qual bloco principal aparece no topo de "/",
// sempre a partir das permissões reais resolvidas pelo banco.
export type HomeFocusKey = "group" | "team" | "personal" | null;

export type HomeFocusInput = {
  canGroup: boolean;
  canTeam: boolean;
  canPersonal: boolean;
  isGroupOwner: boolean;
  isGroupAdmin: boolean;
  primaryRole: string | null;
};

export type HomeCta = { to: string; label: string };

export const HOME_FOCUS_CTA: Record<Exclude<HomeFocusKey, null>, HomeCta> = {
  group: { to: "/painel-grupo", label: "Abrir Painel do Grupo" },
  team: { to: "/painel-equipe", label: "Abrir Painel da equipe" },
  personal: { to: "/meu-trabalho", label: "Abrir Meu trabalho" },
};

/**
 * Destaque principal:
 * - group_owner e group_admin: Painel do Grupo;
 * - manager: Painel da equipe;
 * - collaborator: Meu trabalho.
 * Sem o papel esperado, cai para a permissão de maior alcance disponível.
 */
export function selectHomeFocus(input: HomeFocusInput): HomeFocusKey {
  if (input.primaryRole === "collaborator" && input.canPersonal) return "personal";
  if (input.primaryRole === "manager" && input.canTeam) return "team";
  if ((input.isGroupOwner || input.isGroupAdmin) && input.canGroup) return "group";
  if (input.canGroup) return "group";
  if (input.canTeam) return "team";
  if (input.canPersonal) return "personal";
  return null;
}

/** CTAs secundários: tudo que o usuário pode abrir, menos o destaque. */
export function homeSecondaryCtas(input: HomeFocusInput): HomeCta[] {
  const focus = selectHomeFocus(input);
  const all: { key: Exclude<HomeFocusKey, null>; show: boolean }[] = [
    { key: "group", show: input.canGroup },
    { key: "team", show: input.canTeam },
    { key: "personal", show: input.canPersonal },
  ];
  return all.filter((i) => i.show && i.key !== focus).map((i) => HOME_FOCUS_CTA[i.key]);
}
