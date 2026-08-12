// F12.1-A — a faixa 3–7 vale para o TOTAL FINAL do ciclo (existentes + novos).
import { describe, expect, it } from "vitest";
import { validateStrategicDraft } from "./strategy-recommendations";

describe("validateStrategicDraft — capacidade real do ciclo", () => {
  it("4 existentes + 3 novos = 7 final: permitido", () => {
    const r = validateStrategicDraft(3, 4);
    expect(r.valid).toBe(true);
    expect(r.finalCount).toBe(7);
    expect(r.capacityRemaining).toBe(3);
  });

  it("4 existentes + 4 novos = 8 final: bloqueado", () => {
    const r = validateStrategicDraft(4, 4);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("too_many");
  });

  it("ciclo vazio + 2 novos: bloqueado por mínimo", () => {
    const r = validateStrategicDraft(2, 0);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("too_few");
  });

  it("ciclo vazio + 3 novos: permitido", () => {
    expect(validateStrategicDraft(3, 0).valid).toBe(true);
  });

  it("ciclo já acima do limite: bloqueado com status próprio", () => {
    const r = validateStrategicDraft(1, 8);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("over_limit");
    expect(r.capacityRemaining).toBe(0);
  });

  it("1 existente + 2 novos = 3 final: permitido", () => {
    expect(validateStrategicDraft(2, 1).valid).toBe(true);
  });
});
