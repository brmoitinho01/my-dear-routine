// Planejamento Estratégico simplificado: Objetivos, KPIs e Medições.
// Funções, tabelas e RPCs anteriores permanecem intactas; apenas saíram da interface.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { PageHeader } from "@/components/gmos/page-header";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import { planningTabs, type PlanningTabKey } from "@/lib/gmos/module-tabs";
import {
  RecordDialog,
  toNullable,
  toNumeric,
  type Field,
  type FormValues,
} from "@/components/gmos/record-dialog";
import {
  DIRECTION,
  DRAFT_PLAN_NOTE,
  FREQUENCY,
  KPI_STATUS,
  MEASUREMENT_STATUS,
  OBJECTIVE_STATUS,
  PLAN_STATUS,
  fetchPlanning,
  fmtDate,
  fmtNumber,
  insertRow,
  isKpiIncomplete,
  ownerLabel,
  updateRow,
  type Kpi,
  type Measurement,
  type Plan,
  type Workspace,
} from "@/lib/gmos/f2";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento Estratégico — GMOS Grupo Moitinho" },
      {
        name: "description",
        content: "Objetivos, KPIs e medições do ciclo estratégico da filial selecionada.",
      },
      { property: "og:title", content: "Planejamento Estratégico — GMOS Grupo Moitinho" },
      {
        property: "og:description",
        content: "Objetivos, KPIs e medições do ciclo estratégico da filial selecionada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanejamentoPage,
});

const selectOpts = (map: Record<string, string>) =>
  Object.entries(map).map(([value, label]) => ({ value, label }));

function PlanejamentoPage() {
  const qc = useQueryClient();
  const wsCtx = useWorkspace();
  const [tab, setTab] = useState<PlanningTabKey>("objetivos");
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

  const save = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmos", "planning"] });
      toast.success("Registro salvo.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  function invalidatePlanning(businessUnitId: string) {
    qc.invalidateQueries({ queryKey: ["gmos", "planning", businessUnitId] });
    qc.invalidateQueries({ queryKey: ["gmos", "unit-summary", businessUnitId] });
  }
  const refreshPlanning = () => qc.invalidateQueries({ queryKey: ["gmos", "planning"] });

  if (ws.isPending || (ws.data && planning.isPending)) return <LoadingBlock rows={3} />;
  if (ws.error) return <ErrorBlock error={ws.error} onRetry={() => ws.refetch()} />;
  if (!ws.data)
    return (
      <StateCard
        title="Nenhuma filial disponível"
        description="Seu perfil não possui permissão de leitura em nenhuma filial do Grupo. Solicite acesso ao administrador."
      />
    );
  if (planning.error)
    return <ErrorBlock error={planning.error} onRetry={() => planning.refetch()} />;

  const w = ws.data as Workspace;
  const data = planning.data!;
  const canEdit = w.canStrategy;

  if (!data.plan) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Planejamento Estratégico"
          description="Ciclo estratégico da filial selecionada."
          context={`${w.companyName} › ${w.businessUnitName}`}
        />
        <StateCard
          title="Nenhum planejamento cadastrado"
          description={
            canEdit
              ? "Esta filial ainda não possui um ciclo de planejamento. Crie o ciclo informando título, início e fim."
              : "Ainda não existe um ciclo de planejamento para a filial selecionada ou seu perfil não tem permissão de leitura."
          }
        >
          {canEdit ? (
            <CreatePlan workspace={w} onDone={() => invalidatePlanning(w.businessUnitId)} />
          ) : null}
        </StateCard>
      </div>
    );
  }

  const plan = data.plan;
  const pillarById = new Map(data.pillars.map((p) => [p.id, p]));
  const kpiById = new Map(data.kpis.map((k) => [k.id, k]));
  const pendingMeasurements = data.measurements.filter((m) => m.status === "pending").length;

  const pillarOpts = data.pillars.map((p) => ({ value: p.id, label: p.title }));
  const objectiveOpts = data.objectives.map((o) => ({ value: o.id, label: o.title }));
  const ownerOpts = [
    { value: "none", label: "Sem responsável definido" },
    ...(w.meUserId ? [{ value: w.meUserId, label: `Eu (${w.meEmail ?? "usuário atual"})` }] : []),
  ];
  const base = {
    organization_id: w.organizationId,
    business_unit_id: w.businessUnitId,
    plan_id: plan.id,
  };
  const owner = (v: FormValues, key = "owner_user_id") => {
    const raw = String(v[key] ?? "");
    return raw && raw !== "none" ? raw : null;
  };

  const tabs = planningTabs();

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.title}
        description={`Ciclo de ${fmtDate(plan.cycleStart)} a ${fmtDate(plan.cycleEnd)}.`}
        context={`${w.companyName} › ${w.businessUnitName}`}
        actions={
          <>
            <Badge>{PLAN_STATUS[plan.status] ?? plan.status}</Badge>
            {plan.status === "draft" ? (
              <span className="text-xs text-muted-foreground">{DRAFT_PLAN_NOTE}</span>
            ) : null}
            {canEdit ? (
              <PlanEditor
                plan={plan}
                onSave={(vals) => save.mutate(() => updateRow("strategic_plans", plan.id, vals))}
              />
            ) : (
              <span className="text-xs text-muted-foreground">Perfil somente leitura.</span>
            )}
          </>
        }
      />

      <p className="text-sm text-muted-foreground">
        {data.objectives.length} objetivo(s) · {data.kpis.length} KPI(s) ·{" "}
        {data.measurements.length} medição(ões), {pendingMeasurements} pendente(s).
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PlanningTabKey)}>
        <TabsList className="w-full justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="objetivos" className="space-y-3 pt-4">
          {canEdit ? (
            <NewButton
              label="Cadastrar objetivo"
              title="Cadastrar objetivo"
              fields={objectiveFields(pillarOpts, ownerOpts)}
              onSubmit={async (v) =>
                insertRow("strategic_objectives", {
                  ...base,
                  pillar_id: v.pillar_id,
                  title: v.title,
                  description: toNullable(v.description),
                  owner_user_id: owner(v),
                  due_date: toNullable(v.due_date),
                  status: v.status || "draft",
                  progress: toNumeric(v.progress) ?? 0,
                })
              }
              onDone={refreshPlanning}
            />
          ) : null}

          {data.objectives.length === 0 ? (
            <StateCard
              title="Nenhum objetivo cadastrado"
              description="Os objetivos deste ciclo ainda não foram definidos. Nada é preenchido automaticamente."
            />
          ) : (
            data.objectives.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{o.title}</h3>
                    <Badge variant="outline">{OBJECTIVE_STATUS[o.status] ?? o.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pillarById.get(o.pillarId)?.title ?? "—"} · Prazo: {fmtDate(o.dueDate)} ·
                    Responsável: {ownerLabel(o.ownerUserId)}
                  </p>
                  {o.description ? (
                    <p className="text-sm text-muted-foreground">{o.description}</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Progress value={o.progress} className="h-2" />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {o.progress}%
                    </span>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <EditButton
                        title="Editar objetivo"
                        fields={objectiveFields(pillarOpts, ownerOpts)}
                        initial={{
                          pillar_id: o.pillarId,
                          title: o.title,
                          description: o.description ?? "",
                          owner_user_id: o.ownerUserId ?? "none",
                          due_date: o.dueDate ?? "",
                          status: o.status,
                          progress: String(o.progress),
                        }}
                        onSubmit={async (v) =>
                          updateRow("strategic_objectives", o.id, {
                            pillar_id: v.pillar_id,
                            title: v.title,
                            description: toNullable(v.description),
                            owner_user_id: owner(v),
                            due_date: toNullable(v.due_date),
                            status: v.status,
                            progress: toNumeric(v.progress) ?? 0,
                          })
                        }
                        onDone={refreshPlanning}
                      />
                      {o.status !== "cancelled" ? (
                        <ConfirmAction
                          trigger={
                            <Button size="sm" variant="ghost">
                              Cancelar objetivo
                            </Button>
                          }
                          title="Cancelar objetivo?"
                          description="O objetivo permanece no histórico com status cancelado. Nada é excluído."
                          actionLabel="Cancelar objetivo"
                          onConfirm={() =>
                            save.mutate(() =>
                              updateRow("strategic_objectives", o.id, { status: "cancelled" }),
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="kpis" className="space-y-3 pt-4">
          {canEdit ? (
            <NewButton
              label="Cadastrar KPI"
              title="Cadastrar KPI"
              description="Fórmula, fonte e responsável são exigidos para o indicador ser considerado configurado."
              fields={kpiFields(pillarOpts, objectiveOpts, ownerOpts)}
              onSubmit={async (v) => insertRow("kpis", { ...base, ...kpiPayload(v, owner) })}
              onDone={refreshPlanning}
            />
          ) : null}

          {data.kpis.length === 0 ? (
            <StateCard
              title="Nenhum KPI cadastrado"
              description="Nenhum indicador é exibido sem origem e regra de cálculo. Cadastre KPIs com fórmula, fonte e responsável."
            />
          ) : (
            data.kpis.map((k) => (
              <KpiCard
                key={k.id}
                kpi={k}
                canEdit={canEdit}
                pillarOpts={pillarOpts}
                objectiveOpts={objectiveOpts}
                ownerOpts={ownerOpts}
                owner={owner}
                onDone={refreshPlanning}
                save={(fn) => save.mutate(fn)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="medicoes" className="space-y-3 pt-4">
          {canEdit && data.kpis.length > 0 ? (
            <NewButton
              label="Registrar medição"
              title="Registrar medição"
              fields={measurementFields(data.kpis)}
              onSubmit={async (v) =>
                insertRow("kpi_measurements", {
                  organization_id: w.organizationId,
                  business_unit_id: w.businessUnitId,
                  kpi_id: v.kpi_id,
                  period_start: v.period_start,
                  period_end: v.period_end,
                  value: toNumeric(v.value),
                  source_evidence: toNullable(v.source_evidence),
                  notes: toNullable(v.notes),
                  status: "pending",
                })
              }
              onDone={refreshPlanning}
            />
          ) : null}

          {data.measurements.length === 0 ? (
            <StateCard
              title="Nenhuma medição registrada"
              description="As medições aparecem aqui após serem lançadas para um KPI existente. Nenhum valor é estimado pelo sistema."
            />
          ) : (
            data.measurements.map((m) => (
              <MeasurementCard
                key={m.id}
                m={m}
                kpiName={kpiById.get(m.kpiId)?.name ?? "—"}
                unit={kpiById.get(m.kpiId)?.unit ?? null}
                canEdit={canEdit}
                onValidate={(status) =>
                  save.mutate(() =>
                    updateRow("kpi_measurements", m.id, {
                      status,
                      validated_by: w.meUserId,
                      validated_at: new Date().toISOString(),
                    }),
                  )
                }
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Opt = { value: string; label: string };

function objectiveFields(pillars: Opt[], owners: Opt[]): Field[] {
  return [
    { name: "pillar_id", label: "Pilar", type: "select", required: true, options: pillars },
    { name: "title", label: "Título do objetivo", type: "text", required: true },
    { name: "description", label: "Descrição", type: "textarea" },
    { name: "owner_user_id", label: "Responsável", type: "select", options: owners },
    { name: "due_date", label: "Prazo", type: "date" },
    { name: "status", label: "Status", type: "select", options: selectOpts(OBJECTIVE_STATUS) },
    { name: "progress", label: "Progresso (%)", type: "number", min: 0, max: 100 },
  ];
}

function kpiFields(pillars: Opt[], objectives: Opt[], owners: Opt[]): Field[] {
  return [
    { name: "name", label: "Nome do KPI", type: "text", required: true },
    {
      name: "pillar_id",
      label: "Pilar",
      type: "select",
      options: [{ value: "none", label: "Sem pilar" }, ...pillars],
    },
    {
      name: "objective_id",
      label: "Objetivo",
      type: "select",
      options: [{ value: "none", label: "Sem objetivo" }, ...objectives],
    },
    { name: "unit", label: "Unidade", type: "text", placeholder: "t, R$, %, h…" },
    {
      name: "formula",
      label: "Fórmula de cálculo",
      type: "textarea",
      help: "Obrigatória para o KPI ser considerado configurado.",
    },
    {
      name: "source",
      label: "Fonte do dado",
      type: "text",
      help: "Obrigatória para o KPI ser considerado configurado.",
    },
    {
      name: "frequency",
      label: "Periodicidade",
      type: "select",
      options: selectOpts(FREQUENCY).filter((o) => o.value !== "custom"),
    },
    { name: "direction", label: "Direção da meta", type: "select", options: selectOpts(DIRECTION) },
    { name: "baseline_value", label: "Baseline", type: "number", step: "any" },
    { name: "target_value", label: "Meta", type: "number", step: "any" },
    { name: "owner_user_id", label: "Responsável", type: "select", options: owners },
    { name: "status", label: "Status", type: "select", options: selectOpts(KPI_STATUS) },
  ];
}

function kpiPayload(v: FormValues, owner: (v: FormValues, k?: string) => string | null) {
  return {
    name: v.name,
    pillar_id: v.pillar_id && v.pillar_id !== "none" ? v.pillar_id : null,
    objective_id: v.objective_id && v.objective_id !== "none" ? v.objective_id : null,
    unit: toNullable(v.unit),
    formula: toNullable(v.formula),
    source: toNullable(v.source),
    frequency: v.frequency || "monthly",
    direction: v.direction || "higher_better",
    baseline_value: toNumeric(v.baseline_value),
    target_value: toNumeric(v.target_value),
    owner_user_id: owner(v),
    status: v.status || "draft",
  };
}

function measurementFields(kpis: Kpi[]): Field[] {
  return [
    {
      name: "kpi_id",
      label: "KPI",
      type: "select",
      required: true,
      options: kpis.map((k) => ({ value: k.id, label: k.name })),
    },
    { name: "period_start", label: "Início do período", type: "date", required: true },
    { name: "period_end", label: "Fim do período", type: "date", required: true },
    { name: "value", label: "Valor realizado", type: "number", step: "any", required: true },
    { name: "source_evidence", label: "Fonte / evidência", type: "text" },
    { name: "notes", label: "Observação", type: "textarea" },
  ];
}

function NewButton({
  label,
  title,
  description,
  fields,
  initial,
  onSubmit,
  onDone,
}: {
  label: string;
  title: string;
  description?: string;
  fields: Field[];
  initial?: FormValues;
  onSubmit: (v: FormValues) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          await onSubmit(v);
          onDone();
          toast.success("Registro criado.");
        }}
      />
    </>
  );
}

function EditButton({
  title,
  fields,
  initial,
  onSubmit,
  onDone,
}: {
  title: string;
  fields: Field[];
  initial: FormValues;
  onSubmit: (v: FormValues) => Promise<void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        fields={fields}
        initial={initial}
        onSubmit={async (v) => {
          await onSubmit(v);
          onDone();
          toast.success("Registro atualizado.");
        }}
      />
    </>
  );
}

function PlanEditor({
  plan,
  onSave,
}: {
  plan: Plan;
  onSave: (v: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Editar ciclo
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Editar planejamento"
        fields={[
          { name: "title", label: "Título", type: "text", required: true },
          { name: "description", label: "Descrição", type: "textarea" },
          { name: "cycle_start", label: "Início do ciclo", type: "date", required: true },
          { name: "cycle_end", label: "Fim do ciclo", type: "date", required: true },
          { name: "status", label: "Status", type: "select", options: selectOpts(PLAN_STATUS) },
        ]}
        initial={{
          title: plan.title,
          description: plan.description ?? "",
          cycle_start: plan.cycleStart,
          cycle_end: plan.cycleEnd,
          status: plan.status,
        }}
        onSubmit={async (v) => {
          onSave({
            title: v.title,
            description: toNullable(v.description),
            cycle_start: v.cycle_start,
            cycle_end: v.cycle_end,
            status: v.status,
          });
        }}
      />
    </>
  );
}

function KpiCard({
  kpi,
  canEdit,
  pillarOpts,
  objectiveOpts,
  ownerOpts,
  owner,
  onDone,
  save,
}: {
  kpi: Kpi;
  canEdit: boolean;
  pillarOpts: Opt[];
  objectiveOpts: Opt[];
  ownerOpts: Opt[];
  owner: (v: FormValues, k?: string) => string | null;
  onDone: () => void;
  save: (fn: () => Promise<void>) => void;
}) {
  const incomplete = isKpiIncomplete(kpi);
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{kpi.name}</h3>
          <div className="flex gap-2">
            {incomplete ? (
              <Badge variant="destructive">Configuração incompleta</Badge>
            ) : (
              <Badge variant="outline">Configurado</Badge>
            )}
            <Badge variant="secondary">{KPI_STATUS[kpi.status] ?? kpi.status}</Badge>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          <Info label="Periodicidade" value={FREQUENCY[kpi.frequency] ?? kpi.frequency} />
          <Info label="Direção" value={DIRECTION[kpi.direction] ?? kpi.direction} />
          <Info label="Unidade" value={kpi.unit ?? "—"} />
          <Info label="Baseline" value={fmtNumber(kpi.baselineValue, kpi.unit)} />
          <Info label="Meta" value={fmtNumber(kpi.targetValue, kpi.unit)} />
          <Info label="Responsável" value={ownerLabel(kpi.ownerUserId)} />
          <Info label="Fórmula" value={kpi.formula ?? "Não informada"} />
          <Info label="Fonte" value={kpi.source ?? "Não informada"} />
        </dl>
        {canEdit ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <EditButton
              title="Editar KPI"
              fields={kpiFields(pillarOpts, objectiveOpts, ownerOpts)}
              initial={{
                name: kpi.name,
                pillar_id: kpi.pillarId ?? "none",
                objective_id: kpi.objectiveId ?? "none",
                unit: kpi.unit ?? "",
                formula: kpi.formula ?? "",
                source: kpi.source ?? "",
                frequency: kpi.frequency,
                direction: kpi.direction,
                baseline_value: kpi.baselineValue === null ? "" : String(kpi.baselineValue),
                target_value: kpi.targetValue === null ? "" : String(kpi.targetValue),
                owner_user_id: kpi.ownerUserId ?? "none",
                status: kpi.status,
              }}
              onSubmit={async (v) => updateRow("kpis", kpi.id, kpiPayload(v, owner))}
              onDone={onDone}
            />
            {kpi.status !== "archived" ? (
              <ConfirmAction
                trigger={
                  <Button size="sm" variant="ghost">
                    Arquivar
                  </Button>
                }
                title="Arquivar KPI?"
                description="O KPI e seu histórico permanecem registrados; apenas deixa de ser acompanhado."
                actionLabel="Arquivar"
                onConfirm={() => save(() => updateRow("kpis", kpi.id, { status: "archived" }))}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MeasurementCard({
  m,
  kpiName,
  unit,
  canEdit,
  onValidate,
}: {
  m: Measurement;
  kpiName: string;
  unit: string | null;
  canEdit: boolean;
  onValidate: (status: "validated" | "rejected") => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{kpiName}</h3>
          <Badge
            variant={
              m.status === "validated"
                ? "default"
                : m.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            {MEASUREMENT_STATUS[m.status] ?? m.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Período de {fmtDate(m.periodStart)} a {fmtDate(m.periodEnd)}
        </p>
        <p className="text-lg font-bold tabular-nums">{fmtNumber(m.value, unit)}</p>
        {m.sourceEvidence ? (
          <p className="text-xs text-muted-foreground">Fonte: {m.sourceEvidence}</p>
        ) : null}
        {m.notes ? <p className="text-sm text-muted-foreground">{m.notes}</p> : null}
        {canEdit && m.status === "pending" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => onValidate("validated")}>
              Validar
            </Button>
            <ConfirmAction
              trigger={
                <Button size="sm" variant="outline">
                  Rejeitar
                </Button>
              }
              title="Rejeitar medição?"
              description="A medição permanece registrada com status rejeitada."
              actionLabel="Rejeitar"
              onConfirm={() => onValidate("rejected")}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

/**
 * Criação do ciclo de planejamento da filial selecionada.
 * organization_id, company_id e business_unit_id vêm exclusivamente do WorkspaceProvider
 * e não são campos editáveis. As constraints e a RLS revalidam tudo no servidor.
 */

function CreatePlan({ workspace, onDone }: { workspace: Workspace; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Criar planejamento
      </Button>
      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title="Criar planejamento"
        description={`Ciclo estratégico de ${workspace.companyName} › ${workspace.businessUnitName}. Pilares, objetivos, KPIs e rotinas não são criados automaticamente.`}
        submitLabel="Criar planejamento"
        fields={[
          {
            name: "title",
            label: "Título do ciclo",
            type: "text",
            required: true,
            placeholder: "Ex.: Planejamento estratégico 2027",
          },
          { name: "description", label: "Descrição (opcional)", type: "textarea" },
          { name: "cycle_start", label: "Início do ciclo", type: "date", required: true },
          { name: "cycle_end", label: "Fim do ciclo", type: "date", required: true },
          { name: "status", label: "Status", type: "select", options: selectOpts(PLAN_STATUS) },
        ]}
        initial={{ title: "", description: "", cycle_start: "", cycle_end: "", status: "draft" }}
        onSubmit={async (v) => {
          const title = String(v.title ?? "").trim();
          const start = String(v.cycle_start ?? "").trim();
          const end = String(v.cycle_end ?? "").trim();
          if (title.length > 200) throw new Error("O título deve ter no máximo 200 caracteres.");
          if (!start || !end) throw new Error("Informe o início e o fim do ciclo.");
          if (end <= start) throw new Error("O fim do ciclo deve ser posterior ao início.");

          await insertRow("strategic_plans", {
            organization_id: workspace.organizationId,
            company_id: workspace.companyId,
            business_unit_id: workspace.businessUnitId,
            title,
            description: toNullable(v.description),
            cycle_start: start,
            cycle_end: end,
            status: String(v.status ?? "") || "draft",
          });
          onDone();
          toast.success("Planejamento criado.");
        }}
      />
    </>
  );
}

/** Cadeia visual objetivo → KPI (histórico e meta) → plano de ação, sem dados inventados. */
