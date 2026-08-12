// F12.1-B — seleção humana de indicadores: ausência de decisão nunca vale como aceite.
import { describe, expect, it } from "vitest";
import {
  acceptedKpiIds,
  validateKpiSelection,
  type KpiSelection,
  type TemplateKpi,
} from "./strategy-recommendations";

const kpi = (id: string, templateObjectiveId: string, sortOrder = 1): TemplateKpi => ({
  id,
  templateObjectiveId,
  code: id,
  name: `KPI ${id}`,
  kpiClass: "result",
  description: null,
  unit: "%",
  formula: "a / b",
  sourceHint: "Planilha do financeiro",
  direction: "up",
  frequency: "monthly",
  sortOrder,
});

const KPIS = [kpi("k1", "o1"), kpi("k2", "o1", 2), kpi("k3", "o2")];

const sel = (
  templateKpiId: string,
  templateObjectiveId: string,
  decision: KpiSelection["decision"],
): KpiSelection => ({ templateKpiId, templateObjectiveId, decision });

describe("validateKpiSelection", () => {
  it("objetivo aceito sem KPI selecionado é inválido para aplicação", () => {
    const r = validateKpiSelection(["o1"], [], KPIS);
    expect(r.valid).toBe(false);
    expect(r.missingObjectiveIds).toEqual(["o1"]);
    expect(r.selectedCount).toBe(0);
    expect(r.message).toContain("pelo menos um indicador");
  });

  it("1 KPI aceito já valida aquele objetivo", () => {
    const r = validateKpiSelection(["o1"], [sel("k1", "o1", "accepted")], KPIS);
    expect(r.valid).toBe(true);
    expect(r.selectedCount).toBe(1);
  });

  it("KPI descartado não conta", () => {
    const r = validateKpiSelection(["o1"], [sel("k1", "o1", "discarded")], KPIS);
    expect(r.valid).toBe(false);
    expect(r.selectedCount).toBe(0);
  });

  it("KPI de outro objetivo não satisfaz o objetivo atual", () => {
    const r = validateKpiSelection(["o1"], [sel("k3", "o2", "accepted")], KPIS);
    expect(r.valid).toBe(false);
    expect(r.missingObjectiveIds).toEqual(["o1"]);
  });

  it("decisão com objetivo trocado é ignorada (KPI não pertence ao objetivo)", () => {
    const r = validateKpiSelection(["o1"], [sel("k3", "o1", "accepted")], KPIS);
    expect(r.valid).toBe(false);
  });

  it("seleção múltipla retorna apenas aceitos", () => {
    const r = validateKpiSelection(
      ["o1", "o2"],
      [sel("k1", "o1", "accepted"), sel("k2", "o1", "discarded"), sel("k3", "o2", "accepted")],
      KPIS,
    );
    expect(r.valid).toBe(true);
    expect(r.selectedCount).toBe(2);
    expect(
      acceptedKpiIds("o1", [sel("k1", "o1", "accepted"), sel("k2", "o1", "discarded")], KPIS),
    ).toEqual(["k1"]);
  });

  it("source_hint segue apenas sugestão: nada no modelo deriva fonte oficial", () => {
    // A F12 não produz `kpis.source`; o único dado de fonte é a dica da biblioteca.
    const model = KPIS[0];
    expect(model.sourceHint).toBe("Planilha do financeiro");
    expect(Object.keys(model)).not.toContain("source");
  });
});
