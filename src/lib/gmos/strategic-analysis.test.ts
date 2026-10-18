import { describe, expect, it } from "vitest";
import { ANALYSIS_TOOLS, computeToolResult, getTool, scoreKey } from "./strategic-analysis";

describe("ferramentas de análise (notas 1 a 5)", () => {
  it("tem as 7 ferramentas da planilha", () => {
    expect(ANALYSIS_TOOLS.map((t) => t.code)).toEqual([
      "pest",
      "porter",
      "atratividade",
      "ciclo_vida",
      "fcs",
      "competencias",
      "estrategias",
    ]);
  });

  it("calcula a média de um grupo com as notas preenchidas", () => {
    const t = getTool("porter");
    const r = computeToolResult(t, {
      scores: { [scoreKey("entrantes_1", "n")]: 4, [scoreKey("entrantes_2", "n")]: 2 },
    });
    expect(r.groups[0].average).toBe(3);
    expect(r.groups[0].answered).toBe(2);
  });

  it("ignora notas vazias ou fora de 1 a 5 (não conta como zero)", () => {
    const t = getTool("porter");
    const r = computeToolResult(t, {
      scores: {
        [scoreKey("entrantes_1", "n")]: 5,
        [scoreKey("entrantes_2", "n")]: 0,
        [scoreKey("entrantes_3", "n")]: 7,
      },
    });
    expect(r.groups[0].average).toBe(5);
    expect(r.answered).toBe(1);
  });

  it("sem notas, as médias ficam vazias", () => {
    const r = computeToolResult(getTool("pest"), null);
    expect(r.average).toBeNull();
    expect(r.groups.every((g) => g.average === null)).toBe(true);
  });

  it("separa as médias por coluna (oportunidade × ameaça)", () => {
    const r = computeToolResult(getTool("pest"), {
      scores: {
        [scoreKey("politico_1", "op")]: 4,
        [scoreKey("politico_2", "op")]: 2,
        [scoreKey("politico_1", "am")]: 5,
      },
    });
    expect(r.groups[0].columns).toEqual({ op: 3, am: 5 });
  });

  it("ciclo de vida aponta o estágio de maior média", () => {
    const r = computeToolResult(getTool("ciclo_vida"), {
      scores: {
        [scoreKey("introducao_1", "n")]: 2,
        [scoreKey("crescimento_1", "n")]: 4,
        [scoreKey("maturidade_1", "n")]: 3,
      },
    });
    expect(r.verdict?.key).toBe("crescimento");
  });

  it("média da linha nas competências (valiosa, sustentável, versátil)", () => {
    const r = computeToolResult(getTool("competencias"), {
      scores: {
        [scoreKey("competencias_1", "val")]: 5,
        [scoreKey("competencias_1", "sus")]: 4,
        [scoreKey("competencias_1", "ver")]: 3,
      },
    });
    expect(r.rows["competencias_1"]).toBe(4);
  });

  it("arredonda a média com duas casas", () => {
    const r = computeToolResult(getTool("porter"), {
      scores: {
        [scoreKey("entrantes_1", "n")]: 1,
        [scoreKey("entrantes_2", "n")]: 1,
        [scoreKey("entrantes_3", "n")]: 2,
      },
    });
    expect(r.groups[0].average).toBe(1.33);
  });
});
