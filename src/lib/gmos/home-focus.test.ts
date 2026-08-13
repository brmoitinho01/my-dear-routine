import { describe, expect, it } from "vitest";
import { HOME_FOCUS_CTA, homeSecondaryCtas, selectHomeFocus } from "./home-focus";

// Cobertura preservada da F7-E: a lógica pura continua no domínio mesmo com a Home
// simplificada, e não deve perder testes por causa de refatoração visual.
describe("destaque da home por perfil", () => {
  const base = {
    canGroup: false,
    canTeam: false,
    canPersonal: false,
    isGroupOwner: false,
    isGroupAdmin: false,
    primaryRole: null as string | null,
  };

  it("collaborator destaca Meu trabalho", () => {
    expect(selectHomeFocus({ ...base, primaryRole: "collaborator", canPersonal: true })).toBe(
      "personal",
    );
  });

  it("manager destaca Painel da equipe", () => {
    expect(
      selectHomeFocus({ ...base, primaryRole: "manager", canTeam: true, canPersonal: true }),
    ).toBe("team");
  });

  it("group_owner destaca Painel do Grupo", () => {
    expect(
      selectHomeFocus({
        ...base,
        primaryRole: "group_owner",
        isGroupOwner: true,
        canGroup: true,
        canTeam: true,
        canPersonal: true,
      }),
    ).toBe("group");
  });

  it("group_admin destaca Painel do Grupo e oferece os demais atalhos", () => {
    const input = {
      ...base,
      primaryRole: "group_admin",
      isGroupAdmin: true,
      canGroup: true,
      canTeam: true,
      canPersonal: true,
    };
    expect(selectHomeFocus(input)).toBe("group");
    expect(homeSecondaryCtas(input).map((c) => c.to)).toEqual(["/painel-equipe", "/meu-trabalho"]);
  });

  it("sem papel esperado cai para a permissão de maior alcance", () => {
    expect(selectHomeFocus({ ...base, canTeam: true, canPersonal: true })).toBe("team");
    expect(selectHomeFocus({ ...base, canPersonal: true })).toBe("personal");
  });

  it("sem permissão de painel não há destaque nem CTAs", () => {
    expect(selectHomeFocus(base)).toBeNull();
    expect(homeSecondaryCtas(base)).toEqual([]);
  });

  it("catálogo de CTAs aponta para as rotas preservadas", () => {
    expect(HOME_FOCUS_CTA.group.to).toBe("/painel-grupo");
    expect(HOME_FOCUS_CTA.team.to).toBe("/painel-equipe");
    expect(HOME_FOCUS_CTA.personal.to).toBe("/meu-trabalho");
  });
});
