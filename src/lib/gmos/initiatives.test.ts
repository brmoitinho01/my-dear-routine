// FASE F9 — testes das regras puras de iniciativas e rastreabilidade de origem.
import { describe, expect, it } from "vitest";
import {
  filterInitiatives,
  hasActiveDerivation,
  initiativeIndicators,
  initiativeReadiness,
  initiativesByObjective,
  isLiveInitiative,
  originChain,
  originLabel,
  validateManualOrigin,
  workflowActions,
  type Initiative,
  type InitiativeStatus,
} from "./initiatives";

function initiative(over: Partial<Initiative> = {}): Initiative {
  return {
    id: "i1",
    organizationId: "org",
    businessUnitId: "bu",
    planId: "plan",
    objectiveId: "obj1",
    pillarId: "pil1",
    kpiId: null,
    riskId: null,
    title: "Reduzir retrabalho",
    description: null,
    expectedResult: "Retrabalho abaixo de 3%",
    ownerUserId: "user1",
    sponsorUserId: null,
    startDate: null,
    dueDate: "2026-06-30",
    priority: "medium",
    status: "draft",
    progress: 0,
    estimatedCost: null,
    submittedAt: null,
    approvedAt: null,
    approvalNotes: null,
    ...over,
  };
}

const FULL = { canManage: true, canApprove: true, canManageActions: true };
const READER = { canManage: false, canApprove: false, canManageActions: false };

describe("initiativeReadiness", () => {
  it("aceita revisão com resultado e prazo, mesmo sem responsável", () => {
    const r = initiativeReadiness(initiative({ ownerUserId: null }));
    expect(r.reviewReady).toBe(true);
    expect(r.activationReady).toBe(false);
    expect(r.missing).toEqual(["initiative.owner"]);
  });

  it("bloqueia revisão sem resultado esperado ou prazo", () => {
    expect(initiativeReadiness(initiative({ expectedResult: "  " })).reviewReady).toBe(false);
    expect(initiativeReadiness(initiative({ dueDate: null })).reviewReady).toBe(false);
  });

  it("está pronta quando tudo está registrado", () => {
    const r = initiativeReadiness(initiative());
    expect(r.activationReady).toBe(true);
    expect(r.missing).toHaveLength(0);
  });
});

describe("workflowActions", () => {
  it("perfil somente leitura não executa nenhuma transição", () => {
    const a = workflowActions(initiative(), READER, false);
    expect([a.canEdit, a.canSubmit, a.canApprove, a.canActivate, a.canDerive]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("rascunho completo pode ser enviado e aprovado", () => {
    const a = workflowActions(initiative(), FULL, false);
    expect(a.canSubmit).toBe(true);
    expect(a.canApprove).toBe(true);
    expect(a.canDerive).toBe(false);
    expect(a.deriveBlockedReason).toContain("Aprove a iniciativa");
  });

  it("aprovada permite derivar plano de ação uma única vez", () => {
    const approved = initiative({ status: "approved" });
    expect(workflowActions(approved, FULL, false).canDerive).toBe(true);
    const already = workflowActions(approved, FULL, true);
    expect(already.canDerive).toBe(false);
    expect(already.deriveBlockedReason).toContain("já possui plano de ação");
  });

  it("sem permissão de planos de ação a derivação é bloqueada com motivo", () => {
    const a = workflowActions(
      initiative({ status: "active" }),
      { ...FULL, canManageActions: false },
      false,
    );
    expect(a.canDerive).toBe(false);
    expect(a.deriveBlockedReason).toContain("não permite derivar");
  });

  it("cancelada ou arquivada não deriva nem edita", () => {
    for (const status of ["cancelled", "archived"] as InitiativeStatus[]) {
      const a = workflowActions(initiative({ status }), FULL, false);
      expect(a.canEdit).toBe(false);
      expect(a.canDerive).toBe(false);
    }
  });

  it("ativação exige responsável definido", () => {
    const noOwner = initiative({ status: "approved", ownerUserId: null });
    expect(workflowActions(noOwner, FULL, false).canActivate).toBe(false);
    expect(workflowActions(initiative({ status: "approved" }), FULL, false).canActivate).toBe(true);
  });
});

describe("originChain", () => {
  it("monta a cadeia somente com elos conhecidos", () => {
    const chain = originChain({
      originType: "initiative",
      cycleTitle: "Ciclo 2026",
      pillarTitle: "Eficiência",
      objectiveTitle: "Reduzir custo",
      kpiName: "Custo por tonelada",
      initiativeTitle: "Programa de manutenção",
    });
    expect(chain.map((c) => c.kind)).toEqual(["cycle", "pillar", "objective", "kpi", "initiative"]);
  });

  it("não inventa iniciativa em plano antigo sem vínculo", () => {
    const chain = originChain({
      originType: "objective",
      cycleTitle: "Ciclo 2026",
      objectiveTitle: "Reduzir custo",
      initiativeTitle: "Programa de manutenção",
    });
    expect(chain.some((c) => c.kind === "initiative")).toBe(false);
  });

  it("mostra a justificativa em plano avulso", () => {
    const chain = originChain({
      originType: "standalone_justified",
      originNote: "Demanda emergencial de segurança",
    });
    expect(chain).toEqual([
      {
        kind: "justification",
        label: "Justificativa",
        value: "Demanda emergencial de segurança",
      },
    ]);
  });

  it("rotula origem ausente sem esconder o problema", () => {
    expect(originLabel(null)).toBe("Origem não classificada");
  });
});

describe("validateManualOrigin", () => {
  it("exige origem", () => {
    expect(validateManualOrigin({ originType: null, originNote: null })).toContain(
      "Selecione a origem",
    );
  });
  it("exige justificativa em plano avulso", () => {
    expect(validateManualOrigin({ originType: "standalone_justified", originNote: " " })).toContain(
      "Justifique",
    );
    expect(
      validateManualOrigin({ originType: "standalone_justified", originNote: "Urgência legal" }),
    ).toBeNull();
  });
  it("exige o vínculo correspondente", () => {
    expect(validateManualOrigin({ originType: "objective", originNote: null })).toContain(
      "objetivo",
    );
    expect(
      validateManualOrigin({ originType: "objective", originNote: null, objectiveId: "o1" }),
    ).toBeNull();
    expect(validateManualOrigin({ originType: "kpi", originNote: null })).toContain("indicador");
  });
  it("não permite criar manualmente plano derivado de iniciativa", () => {
    expect(validateManualOrigin({ originType: "initiative", originNote: null })).toContain(
      "criados pela própria iniciativa",
    );
  });
});

describe("indicadores e filtros", () => {
  const list = [
    initiative({ id: "a", status: "approved" }),
    initiative({ id: "b", status: "approved", ownerUserId: null }),
    initiative({ id: "c", status: "cancelled" }),
    initiative({ id: "d", objectiveId: "obj2", status: "active" }),
  ];
  const plans = [
    { initiativeId: "a", status: "in_progress" },
    { initiativeId: "d", status: "cancelled" },
  ];

  it("conta apenas iniciativas vivas nos indicadores", () => {
    const ind = initiativeIndicators(list, plans);
    expect(ind.live).toBe(3);
    expect(ind.withoutOwner).toBe(1);
    expect(ind.approvedWithoutActionPlan).toBe(2);
    expect(ind.byStatus["cancelled"]).toBe(1);
  });

  it("derivação cancelada não bloqueia nova derivação", () => {
    expect(hasActiveDerivation("d", plans)).toBe(false);
    expect(hasActiveDerivation("a", plans)).toBe(true);
  });

  it("filtra por objetivo e status", () => {
    expect(initiativesByObjective(list, "obj2").map((i) => i.id)).toEqual(["d"]);
    expect(filterInitiatives(list, { status: "approved" }).map((i) => i.id)).toEqual(["a", "b"]);
    expect(filterInitiatives(list, { status: "all" })).toHaveLength(4);
  });

  it("classifica status vivo", () => {
    expect(isLiveInitiative({ status: "active" })).toBe(true);
    expect(isLiveInitiative({ status: "archived" })).toBe(false);
  });
});
