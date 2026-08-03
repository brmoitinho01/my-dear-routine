// FASE F9 — iniciativas estratégicas de um objetivo, com workflow e derivação rastreável.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, GitBranch, Info } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import {
  RecordDialog,
  toNumeric,
  type Field,
  type FormValues,
} from "@/components/gmos/record-dialog";
import { fmtDate, fmtMoney, ownerLabel } from "@/lib/gmos/f2";
import {
  INITIATIVE_PRIORITY,
  INITIATIVE_STATUS,
  activateInitiative,
  approveInitiative,
  createInitiative,
  deriveActionPlan,
  fetchDerivedActionPlans,
  fetchInitiativesByPlan,
  hasActiveDerivation,
  initiativeReadiness,
  initiativesByObjective,
  readinessLabel,
  submitInitiativeForReview,
  updateInitiative,
  workflowActions,
  type Initiative,
  type InitiativeInput,
  type InitiativePriority,
} from "@/lib/gmos/initiatives";

type Opt = { value: string; label: string };

export function InitiativesSection({
  organizationId,
  businessUnitId,
  planId,
  objectiveId,
  pillarId,
  kpiOpts,
  riskOpts,
  ownerOpts,
  canManage,
  canApprove,
  canManageActions,
}: {
  organizationId: string;
  businessUnitId: string;
  planId: string;
  objectiveId: string;
  pillarId: string | null;
  kpiOpts: Opt[];
  riskOpts: Opt[];
  ownerOpts: Opt[];
  canManage: boolean;
  canApprove: boolean;
  canManageActions: boolean;
}) {
  const qc = useQueryClient();
  const initiatives = useQuery({
    queryKey: ["gmos", "initiatives", planId],
    queryFn: () => fetchInitiativesByPlan(planId),
    retry: false,
  });
  const derived = useQuery({
    queryKey: ["gmos", "derived-actions", businessUnitId],
    queryFn: () => fetchDerivedActionPlans(businessUnitId),
    retry: false,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["gmos", "initiatives"] });
    qc.invalidateQueries({ queryKey: ["gmos", "derived-actions"] });
    qc.invalidateQueries({ queryKey: ["gmos", "actions"] });
  }

  const workflow = useMutation({
    mutationFn: async (op: { kind: "submit" | "approve" | "activate" | "derive"; id: string }) => {
      if (op.kind === "submit") return submitInitiativeForReview(op.id);
      if (op.kind === "approve") return approveInitiative(op.id);
      if (op.kind === "activate") return activateInitiative(op.id);
      return deriveActionPlan(op.id);
    },
    onSuccess: (_r, op) => {
      invalidate();
      toast.success(
        op.kind === "submit"
          ? "Iniciativa enviada para revisão."
          : op.kind === "approve"
            ? "Iniciativa aprovada."
            : op.kind === "activate"
              ? "Iniciativa ativada."
              : "Plano de ação derivado da iniciativa.",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação."),
  });

  const list = initiativesByObjective(initiatives.data ?? [], objectiveId);
  const plans = derived.data ?? [];
  const fields = initiativeFields(kpiOpts, riskOpts, ownerOpts);

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Iniciativas estratégicas ({list.length})
        </h4>
        {canManage ? (
          <NewInitiative
            fields={fields}
            onSubmit={async (v) =>
              createInitiative(organizationId, businessUnitId, planId, {
                ...toInput(v),
                objectiveId,
                pillarId,
              })
            }
            onDone={invalidate}
          />
        ) : null}
      </div>

      {initiatives.isPending ? (
        <p className="text-xs text-muted-foreground">Carregando iniciativas…</p>
      ) : initiatives.error ? (
        <p className="text-xs text-destructive">
          Não foi possível carregar as iniciativas deste objetivo.
        </p>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma iniciativa registrada para este objetivo. Iniciativas não são criadas
          automaticamente.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((i) => (
            <InitiativeCard
              key={i.id}
              initiative={i}
              fields={fields}
              alreadyDerived={hasActiveDerivation(i.id, plans)}
              derivedTitles={plans.filter((p) => p.initiativeId === i.id).map((p) => p.title)}
              canManage={canManage}
              canApprove={canApprove}
              canManageActions={canManageActions}
              busy={workflow.isPending}
              onWorkflow={(kind) => workflow.mutate({ kind, id: i.id })}
              onEdit={async (v) =>
                updateInitiative(i.id, organizationId, businessUnitId, planId, {
                  ...toInput(v),
                  objectiveId,
                  pillarId,
                })
              }
              onDone={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InitiativeCard({
  initiative,
  fields,
  alreadyDerived,
  derivedTitles,
  canManage,
  canApprove,
  canManageActions,
  busy,
  onWorkflow,
  onEdit,
  onDone,
}: {
  initiative: Initiative;
  fields: Field[];
  alreadyDerived: boolean;
  derivedTitles: string[];
  canManage: boolean;
  canApprove: boolean;
  canManageActions: boolean;
  busy: boolean;
  onWorkflow: (kind: "submit" | "approve" | "activate" | "derive") => void;
  onEdit: (v: FormValues) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const readiness = initiativeReadiness(initiative);
  const actions = workflowActions(
    initiative,
    { canManage, canApprove, canManageActions },
    alreadyDerived,
  );

  return (
    <Card className="bg-muted/30">
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{initiative.title}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{INITIATIVE_PRIORITY[initiative.priority]}</Badge>
            <Badge>{INITIATIVE_STATUS[initiative.status] ?? initiative.status}</Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Prazo: {fmtDate(initiative.dueDate)} · Responsável: {ownerLabel(initiative.ownerUserId)} ·
          Custo previsto: {fmtMoney(initiative.estimatedCost)}
        </p>
        {initiative.expectedResult ? (
          <p className="text-xs">
            <span className="text-muted-foreground">Resultado esperado: </span>
            {initiative.expectedResult}
          </p>
        ) : null}
        {readiness.missing.length ? (
          <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-500">
            {readiness.missing.map((m) => (
              <li key={m} className="flex items-center gap-1">
                <Info className="h-3 w-3" /> {readinessLabel(m)}
              </li>
            ))}
          </ul>
        ) : null}
        {derivedTitles.length ? (
          <p className="text-xs text-muted-foreground">
            Plano(s) derivado(s): {derivedTitles.join(", ")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {actions.canEdit ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
              <RecordDialog
                open={open}
                onOpenChange={setOpen}
                title="Editar iniciativa"
                fields={fields}
                initial={initialValues(initiative)}
                onSubmit={async (v) => {
                  await onEdit(v);
                  onDone();
                  toast.success("Iniciativa atualizada.");
                }}
              />
            </>
          ) : null}
          {actions.canSubmit ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onWorkflow("submit")}
            >
              Enviar para revisão
            </Button>
          ) : null}
          {actions.canApprove ? (
            <ConfirmAction
              trigger={
                <Button size="sm" variant="secondary" disabled={busy}>
                  Aprovar
                </Button>
              }
              title="Aprovar iniciativa?"
              description="A aprovação é registrada em auditoria e habilita a derivação do plano de ação."
              actionLabel="Aprovar"
              onConfirm={() => onWorkflow("approve")}
            />
          ) : null}
          {actions.canActivate ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onWorkflow("activate")}
            >
              Ativar
            </Button>
          ) : null}
          {actions.canDerive ? (
            <ConfirmAction
              trigger={
                <Button size="sm" disabled={busy}>
                  <GitBranch className="mr-1.5 h-3.5 w-3.5" /> Derivar plano de ação
                </Button>
              }
              title="Derivar plano de ação?"
              description="Será criado um plano 5W2H vinculado a esta iniciativa, com origem rastreável. Nenhum dado existente é alterado."
              actionLabel="Derivar"
              onConfirm={() => onWorkflow("derive")}
            />
          ) : (
            <span className="text-xs text-muted-foreground">{actions.deriveBlockedReason}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NewInitiative({
  fields,
  onSubmit,
  onDone,
}: {
  fields: Field[];
  onSubmit: (v: FormValues) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova iniciativa
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Nova iniciativa estratégica"
        description="A iniciativa liga o objetivo à execução. O plano de ação só é criado depois, por derivação."
        fields={fields}
        onSubmit={async (v) => {
          await onSubmit(v);
          onDone();
          toast.success("Iniciativa criada.");
        }}
      />
    </>
  );
}

function initiativeFields(kpiOpts: Opt[], riskOpts: Opt[], ownerOpts: Opt[]): Field[] {
  return [
    { name: "title", label: "Título da iniciativa", type: "text", required: true },
    { name: "description", label: "Descrição", type: "textarea" },
    {
      name: "expected_result",
      label: "Resultado esperado",
      type: "textarea",
      help: "Obrigatório para enviar a iniciativa à revisão.",
    },
    {
      name: "kpi_id",
      label: "Indicador relacionado",
      type: "select",
      options: [{ value: "none", label: "Sem indicador" }, ...kpiOpts],
    },
    {
      name: "risk_id",
      label: "Risco relacionado",
      type: "select",
      options: [{ value: "none", label: "Sem risco" }, ...riskOpts],
    },
    { name: "owner_user_id", label: "Responsável", type: "select", options: ownerOpts },
    { name: "sponsor_user_id", label: "Patrocinador", type: "select", options: ownerOpts },
    { name: "start_date", label: "Início", type: "date" },
    { name: "due_date", label: "Prazo", type: "date" },
    {
      name: "priority",
      label: "Prioridade",
      type: "select",
      options: Object.entries(INITIATIVE_PRIORITY).map(([value, label]) => ({ value, label })),
    },
    { name: "estimated_cost", label: "Custo previsto", type: "number", step: "any" },
  ];
}

function text(v: FormValues, key: string): string | null {
  const s = String(v[key] ?? "").trim();
  return s === "" ? null : s;
}

function pick(v: FormValues, key: string) {
  const raw = String(v[key] ?? "");
  return raw && raw !== "none" ? raw : null;
}

function toInput(v: FormValues): InitiativeInput {
  return {
    objectiveId: "",
    pillarId: null,
    kpiId: pick(v, "kpi_id"),
    riskId: pick(v, "risk_id"),
    title: String(v["title"] ?? ""),
    description: text(v, "description"),
    expectedResult: text(v, "expected_result"),
    ownerUserId: pick(v, "owner_user_id"),
    sponsorUserId: pick(v, "sponsor_user_id"),
    startDate: text(v, "start_date"),
    dueDate: text(v, "due_date"),
    priority: (String(v["priority"] ?? "medium") as InitiativePriority) || "medium",
    estimatedCost: toNumeric(v["estimated_cost"]),
  };
}

function initialValues(i: Initiative): FormValues {
  return {
    title: i.title,
    description: i.description ?? "",
    expected_result: i.expectedResult ?? "",
    kpi_id: i.kpiId ?? "none",
    risk_id: i.riskId ?? "none",
    owner_user_id: i.ownerUserId ?? "none",
    sponsor_user_id: i.sponsorUserId ?? "none",
    start_date: i.startDate ?? "",
    due_date: i.dueDate ?? "",
    priority: i.priority,
    estimated_cost: i.estimatedCost === null ? "" : String(i.estimatedCost),
  };
}
