// FASE F2 — planos de ação 5W2H da Filial RM Mineração.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import { RecordDialog, toNullable, toNumeric, type Field, type FormValues } from "@/components/gmos/record-dialog";
import {
  ACTION_STATUS,
  fetchActionPlans,
  fetchPlanning,
  fmtDate,
  fmtMoney,
  insertRow,
  isLate,
  updateRow,
  type ActionPlan,
} from "@/lib/gmos/f2";

export const Route = createFileRoute("/_authenticated/planos-de-acao")({
  head: () => ({
    meta: [
      { title: "Planos de ação — GMOS RM Mineração" },
      { name: "description", content: "Planos de ação 5W2H da Filial RM Mineração com prazos, custos e progresso reais." },
      { property: "og:title", content: "Planos de ação — GMOS RM Mineração" },
      { property: "og:description", content: "Planos de ação 5W2H da Filial RM Mineração com prazos, custos e progresso reais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanosAcaoPage,
});

function PlanosAcaoPage() {
  const qc = useQueryClient();
  const [fStatus, setFStatus] = useState("all");
  const [fObjective, setFObjective] = useState("all");
  const [fDue, setFDue] = useState("all");

  const wsCtx = useWorkspace();
  const ws = {
    isPending: wsCtx.isPending,
    error: wsCtx.error,
    data: wsCtx.workspace,
    refetch: wsCtx.refetch,
  };
  const bu = ws.data?.businessUnitId;
  const planning = useQuery({
    queryKey: ["gmos", "planning", bu],
    queryFn: () => fetchPlanning(bu!),
    enabled: Boolean(bu),
    retry: false,
  });
  const actions = useQuery({
    queryKey: ["gmos", "actions", bu],
    queryFn: () => fetchActionPlans(bu!),
    enabled: Boolean(bu),
    retry: false,
  });

  const save = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmos", "actions"] });
      toast.success("Plano atualizado.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const all = actions.data ?? [];
  const objectives = planning.data?.objectives ?? [];
  const pillars = planning.data?.pillars ?? [];
  const kpis = planning.data?.kpis ?? [];
  const objectiveById = useMemo(() => new Map(objectives.map((o) => [o.id, o])), [objectives]);
  const pillarById = useMemo(() => new Map(pillars.map((p) => [p.id, p])), [pillars]);

  const filtered = all.filter((a) => {
    if (fStatus !== "all" && a.status !== fStatus) return false;
    if (fObjective !== "all") {
      if (fObjective === "none" ? a.objectiveId !== null : a.objectiveId !== fObjective) return false;
    }
    if (fDue === "late" && !isLate(a)) return false;
    if (fDue === "open" && (!a.dueDate || isLate(a) || ["completed", "cancelled"].includes(a.status))) return false;
    return true;
  });

  if (ws.isPending || actions.isPending) return <LoadingBlock rows={3} />;
  if (ws.error) return <ErrorBlock error={ws.error} onRetry={() => ws.refetch()} />;
  if (actions.error) return <ErrorBlock error={actions.error} onRetry={() => actions.refetch()} />;

  const w = ws.data!;
  const canEdit = w.canAction;
  const lateCount = all.filter(isLate).length;

  const fields: Field[] = [
    { name: "title", label: "O quê (título da ação)", type: "text", required: true },
    { name: "why", label: "Por quê", type: "textarea" },
    { name: "how", label: "Como", type: "textarea" },
    { name: "where_place", label: "Onde", type: "text" },
    {
      name: "owner_user_id",
      label: "Quem (responsável)",
      type: "select",
      options: [
        { value: "none", label: "Sem responsável definido" },
        ...(w.meUserId ? [{ value: w.meUserId, label: `Eu (${w.meEmail ?? "usuário atual"})` }] : []),
      ],
    },
    { name: "objective_id", label: "Objetivo relacionado", type: "select", options: [{ value: "none", label: "Sem objetivo" }, ...objectives.map((o) => ({ value: o.id, label: o.title }))] },
    { name: "kpi_id", label: "KPI relacionado", type: "select", options: [{ value: "none", label: "Sem KPI" }, ...kpis.map((k) => ({ value: k.id, label: k.name }))] },
    { name: "start_date", label: "Início", type: "date" },
    { name: "due_date", label: "Quando (prazo)", type: "date" },
    { name: "estimated_cost", label: "Quanto custa (previsto)", type: "number", step: "any" },
    { name: "actual_cost", label: "Custo realizado", type: "number", step: "any" },
    { name: "expected_result", label: "Resultado esperado", type: "textarea" },
    { name: "status", label: "Status", type: "select", options: Object.entries(ACTION_STATUS).map(([value, label]) => ({ value, label })) },
    { name: "progress", label: "Progresso (%)", type: "number", min: 0, max: 100 },
  ];

  const payload = (v: FormValues) => ({
    title: v.title,
    why: toNullable(v.why),
    how: toNullable(v.how),
    where_place: toNullable(v.where_place),
    owner_user_id: v.owner_user_id && v.owner_user_id !== "none" ? v.owner_user_id : null,
    objective_id: v.objective_id && v.objective_id !== "none" ? v.objective_id : null,
    kpi_id: v.kpi_id && v.kpi_id !== "none" ? v.kpi_id : null,
    start_date: toNullable(v.start_date),
    due_date: toNullable(v.due_date),
    estimated_cost: toNumeric(v.estimated_cost),
    actual_cost: toNumeric(v.actual_cost),
    expected_result: toNullable(v.expected_result),
    status: v.status || "draft",
    progress: toNumeric(v.progress) ?? 0,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Badge variant="secondary">Fase 2</Badge>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Planos de ação</h1>
        <p className="text-sm text-muted-foreground">
          {w.companyName} › {w.businessUnitName} · {all.length} plano(s), {lateCount} em atraso
        </p>
      </header>

      {canEdit ? (
        <NewAction fields={fields} onSubmit={async (v) => insertRow("action_plans", { organization_id: w.organizationId, business_unit_id: w.businessUnitId, plan_id: planning.data?.plan?.id ?? null, ...payload(v) })} onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "actions"] })} />
      ) : (
        <p className="text-xs text-muted-foreground">Perfil somente leitura.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={[{ value: "all", label: "Todos" }, ...Object.entries(ACTION_STATUS).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect
          label="Objetivo"
          value={fObjective}
          onChange={setFObjective}
          options={[{ value: "all", label: "Todos" }, { value: "none", label: "Sem objetivo" }, ...objectives.map((o) => ({ value: o.id, label: o.title }))]}
        />
        <FilterSelect
          label="Prazo"
          value={fDue}
          onChange={setFDue}
          options={[
            { value: "all", label: "Todos" },
            { value: "late", label: "Em atraso" },
            { value: "open", label: "No prazo" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <StateCard
          title={all.length === 0 ? "Nenhum plano de ação cadastrado" : "Nenhum plano no filtro selecionado"}
          description={
            all.length === 0
              ? "Cadastre planos 5W2H ligados aos objetivos e KPIs do ciclo. Nada é criado automaticamente."
              : "Ajuste os filtros para visualizar outros planos."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const obj = a.objectiveId ? objectiveById.get(a.objectiveId) : null;
            const pillar = obj ? pillarById.get(obj.pillarId) : null;
            const late = isLate(a);
            return (
              <Card key={a.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{a.title}</h2>
                    <div className="flex flex-wrap gap-2">
                      {late ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Em atraso
                        </Badge>
                      ) : null}
                      <Badge variant="outline">{ACTION_STATUS[a.status] ?? a.status}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pillar ? `${pillar.title} · ` : ""}
                    {obj ? obj.title : "Sem objetivo vinculado"} · Prazo: {fmtDate(a.dueDate)}
                  </p>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {a.why ? <Field2 label="Por quê" value={a.why} /> : null}
                    {a.how ? <Field2 label="Como" value={a.how} /> : null}
                    {a.wherePlace ? <Field2 label="Onde" value={a.wherePlace} /> : null}
                    {a.expectedResult ? <Field2 label="Resultado esperado" value={a.expectedResult} /> : null}
                    <Field2 label="Custo previsto" value={fmtMoney(a.estimatedCost)} />
                    <Field2 label="Custo realizado" value={fmtMoney(a.actualCost)} />
                  </dl>
                  <div className="flex items-center gap-2">
                    <Progress value={a.progress} className="h-2" />
                    <span className="text-xs tabular-nums text-muted-foreground">{a.progress}%</span>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <EditAction plan={a} fields={fields} payload={payload} onDone={() => qc.invalidateQueries({ queryKey: ["gmos", "actions"] })} />
                      {a.status !== "cancelled" && a.status !== "completed" ? (
                        <ConfirmAction
                          trigger={<Button size="sm" variant="ghost">Cancelar plano</Button>}
                          title="Cancelar plano de ação?"
                          description="O plano permanece no histórico com status cancelado. Nada é excluído."
                          actionLabel="Cancelar plano"
                          onConfirm={() => save.mutate(() => updateRow("action_plans", a.id, { status: "cancelled" }))}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = `filtro-${label}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NewAction({ fields, onSubmit, onDone }: { fields: Field[]; onSubmit: (v: FormValues) => Promise<void>; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Novo plano de ação
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Novo plano de ação"
        description="Estrutura 5W2H: o quê, por quê, como, onde, quem, quando e quanto custa."
        fields={fields}
        onSubmit={async (v) => {
          await onSubmit(v);
          onDone();
          toast.success("Plano criado.");
        }}
      />
    </>
  );
}

function EditAction({
  plan,
  fields,
  payload,
  onDone,
}: {
  plan: ActionPlan;
  fields: Field[];
  payload: (v: FormValues) => Record<string, unknown>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Editar plano de ação"
        fields={fields}
        initial={{
          title: plan.title,
          why: plan.why ?? "",
          how: plan.how ?? "",
          where_place: plan.wherePlace ?? "",
          owner_user_id: plan.ownerUserId ?? "none",
          objective_id: plan.objectiveId ?? "none",
          kpi_id: plan.kpiId ?? "none",
          start_date: plan.startDate ?? "",
          due_date: plan.dueDate ?? "",
          estimated_cost: plan.estimatedCost === null ? "" : String(plan.estimatedCost),
          actual_cost: plan.actualCost === null ? "" : String(plan.actualCost),
          expected_result: plan.expectedResult ?? "",
          status: plan.status,
          progress: String(plan.progress),
        }}
        onSubmit={async (v) => {
          await updateRow("action_plans", plan.id, payload(v));
          onDone();
          toast.success("Plano atualizado.");
        }}
      />
    </>
  );
}
