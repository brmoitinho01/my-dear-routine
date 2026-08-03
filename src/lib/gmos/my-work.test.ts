import { describe, expect, it } from "vitest";
import { groupExecutions, isActionLate, type MyAction, type MyExecution } from "./my-work";

const exec = (id: string, dueDate: string, status: string): MyExecution => ({
  id,
  businessUnitId: "u1",
  businessUnitName: "Filial",
  templateId: "t1",
  templateName: `Rotina ${id}`,
  frequency: "daily",
  requiresEvidence: false,
  competenceDate: dueDate,
  dueDate,
  status,
  completedAt: null,
  evidence: null,
  notes: null,
});

describe("groupExecutions", () => {
  it("classifica atraso, hoje, próximas e registradas", () => {
    const groups = groupExecutions(
      [
        exec("a", "2026-03-01", "pending"),
        exec("b", "2026-03-10", "pending"),
        exec("c", "2026-03-20", "in_progress"),
        exec("d", "2026-03-05", "completed"),
      ],
      "2026-03-10",
    );
    expect(groups.late.map((e) => e.id)).toEqual(["a"]);
    expect(groups.today.map((e) => e.id)).toEqual(["b"]);
    expect(groups.upcoming.map((e) => e.id)).toEqual(["c"]);
    expect(groups.done.map((e) => e.id)).toEqual(["d"]);
  });
});

describe("isActionLate", () => {
  const action = (dueDate: string | null, status: string): MyAction => ({
    id: "a",
    businessUnitId: "u1",
    businessUnitName: "Filial",
    title: "Ação",
    why: null,
    how: null,
    dueDate,
    status,
    progress: 0,
  });

  it("considera atraso apenas em ações abertas com prazo vencido", () => {
    expect(isActionLate(action("2026-01-01", "in_progress"), "2026-03-10")).toBe(true);
    expect(isActionLate(action("2026-01-01", "completed"), "2026-03-10")).toBe(false);
    expect(isActionLate(action(null, "in_progress"), "2026-03-10")).toBe(false);
  });
});