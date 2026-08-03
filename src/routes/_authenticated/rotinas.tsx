// FASE F3 — rotinas recorrentes e execuções da empresa/filial selecionada no contexto.
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { PageHeader } from "@/components/gmos/page-header";
import { DemoBanner } from "@/components/gmos/demo-banner";
import { RequirePermission } from "@/components/gmos/permission-gate";
import { ExecutionCard } from "@/components/gmos/execution-card";
import { useAuth } from "@/lib/auth-context";
import { useIsDemoUnit } from "@/lib/gmos/use-demo";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import {
  RecordDialog,
  toNullable,
  toNumeric,
  type Field,
  type FormValues,
} from "@/components/gmos/record-dialog";
import {
  FREQUENCY,
  ROUTINE_STATUS,
  WEEKDAYS,
  fetchRoutines,
  fmtDate,
  generateExecutions,
  insertRow,
  ownerLabel,
  updateRow,
  type RoutineExecution,
  type RoutineTemplate,
} from "@/lib/gmos/f2";

export const Route = createFileRoute("/_authenticated/rotinas")({
  head: () => ({
    meta: [
      { title: "Rotinas e rituais — GMOS Grupo Moitinho" },
      {
        name: "description",
        content: "Modelos de rotina e execuções da filial selecionada, com evidência e observação.",
      },
      { property: "og:title", content: "Rotinas e rituais — GMOS Grupo Moitinho" },
      {
        property: "og:description",
        content: "Modelos de rotina e execuções da filial selecionada, com evidência e observação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="routine.read" area="visualizar rotinas">
      <RotinasPage />
    </RequirePermission>
  ),
});

function RotinasPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const wsCtx = useWorkspace();
  const isDemo = useIsDemoUnit(wsCtx.selectedBusinessUnitId);
  const ws = {
    isPending: wsCtx.isPending,
    error: wsCtx.error,
    data: wsCtx.workspace,
    refetch: wsCtx.refetch,
  };
  const bu = ws.data?.businessUnitId;
  const routines = useQuery({
    queryKey: ["gmos", "routines", bu],
    queryFn: () => fetchRoutines(bu!),
    enabled: Boolean(bu),
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gmos", "routines"] });

  const act = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      invalidate();
      toast.success("Rotina atualizada.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const gen = useMutation({
    mutationFn: (id: string) => generateExecutions(id),
    onSuccess: (n) => {
      invalidate();
      toast.success(
        n > 0 ? `${n} execução(ões) gerada(s).` : "Nenhuma execução nova. Competências já geradas.",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao gerar execuções."),
  });

  const templates = routines.data?.templates ?? [];
  const executions = routines.data?.executions ?? [];
  const tplById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  if (ws.isPending || (ws.data && routines.isPending)) return <LoadingBlock rows={3} />;
  if (ws.error) return <ErrorBlock error={ws.error} onRetry={() => ws.refetch()} />;
  if (!ws.data)
    return (
      <StateCard
        title="Nenhuma filial disponível"
        description="Seu perfil não possui permissão de leitura em nenhuma filial do Grupo. Solicite acesso ao administrador."
      />
    );
  if (routines.error)
    return <ErrorBlock error={routines.error} onRetry={() => routines.refetch()} />;

  const w = ws.data!;
  // A decisão de UI vem de can() no scope_id real da filial em contexto.
  // w.canRoutine é apenas o resultado agregado de has_permission no servidor.
  const canManage = can("routine.manage", w.scopeId) || w.canRoutine;
  const canExecuteOwn = can("routine.execute_own", w.scopeId);
  const canEdit = canManage;
  const ownerOpts = [
    { value: "none", label: "Sem responsável definido" },
    ...(w.meUserId ? [{ value: w.meUserId, label: `Eu (${w.meEmail ?? "usuário atual"})` }] : []),
  ];

  const tplFields: Field[] = [
    { name: "name", label: "Nome da rotina", type: "text", required: true },
    { name: "description", label: "Descrição", type: "textarea" },
    {
      name: "frequency",
      label: "Frequência",
      type: "select",
      required: true,
      options: Object.entries(FREQUENCY)
        .filter(([v]) => v !== "yearly")
        .map(([value, label]) => ({ value, label })),
    },
    { name: "owner_user_id", label: "Responsável", type: "select", options: ownerOpts },
    {
      name: "start_date",
      label: "Data de início",
      type: "date",
      help: "Obrigatória para ativar a rotina.",
    },
    {
      name: "weekday",
      label: "Dia da semana (semanal)",
      type: "select",
      options: [
        { value: "none", label: "Não se aplica" },
        ...WEEKDAYS.map((d, i) => ({ value: String(i), label: d })),
      ],
    },
    { name: "day_of_month", label: "Dia do mês (mensal, 1–28)", type: "number", min: 1, max: 28 },
    {
      name: "custom_interval_days",
      label: "Intervalo em dias (personalizada)",
      type: "number",
      min: 1,
    },
    { name: "scheduled_time", label: "Horário", type: "time" },
    { name: "requires_evidence", label: "Exigir evidência na conclusão", type: "switch" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: Object.entries(ROUTINE_STATUS).map(([value, label]) => ({ value, label })),
    },
  ];

  const tplPayload = (v: FormValues) => ({
    name: v.name,
    description: toNullable(v.description),
    frequency: v.frequency,
    owner_user_id: v.owner_user_id && v.owner_user_id !== "none" ? v.owner_user_id : null,
    start_date: toNullable(v.start_date),
    weekday: v.weekday && v.weekday !== "none" ? toNumeric(v.weekday) : null,
    day_of_month: toNumeric(v.day_of_month),
    custom_interval_days: toNumeric(v.custom_interval_days),
    scheduled_time: toNullable(v.scheduled_time),
    requires_evidence: Boolean(v.requires_evidence),
    status: v.status || "draft",
  });

  const pending = executions.filter((e) => e.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Rotinas" }]}
        title="Rotinas e rituais"
        description={`${templates.length} modelo(s), ${executions.length} execução(ões), ${pending} pendente(s).`}
        context={`${w.companyName} › ${w.businessUnitName}`}
      />

      {isDemo ? <DemoBanner /> : null}

      <Tabs defaultValue="modelos">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="space-y-3 pt-4">
          {canEdit ? (
            <DialogButton
              label="Nova rotina"
              title="Nova rotina"
              fields={tplFields}
              onSubmit={async (v) =>
                insertRow("routine_templates", {
                  organization_id: w.organizationId,
                  company_id: w.companyId,
                  business_unit_id: w.businessUnitId,
                  ...tplPayload(v),
                })
              }
              onDone={invalidate}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Perfil somente leitura.</p>
          )}

          {templates.length === 0 ? (
            <StateCard
              title="Nenhuma rotina cadastrada"
              description="Cadastre modelos de rotina para gerar execuções recorrentes."
            />
          ) : (
            templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{t.name}</h2>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{FREQUENCY[t.frequency] ?? t.frequency}</Badge>
                      <Badge variant="outline">{ROUTINE_STATUS[t.status] ?? t.status}</Badge>
                    </div>
                  </div>
                  {t.description ? (
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <Info label="Início" value={fmtDate(t.startDate)} />
                    <Info
                      label="Dia da semana"
                      value={t.weekday === null ? "—" : WEEKDAYS[t.weekday]}
                    />
                    <Info label="Dia do mês" value={t.dayOfMonth ? String(t.dayOfMonth) : "—"} />
                    <Info
                      label="Horário"
                      value={t.scheduledTime ? t.scheduledTime.slice(0, 5) : "—"}
                    />
                    <Info label="Responsável" value={ownerLabel(t.ownerUserId)} />
                    <Info
                      label="Evidência"
                      value={t.requiresEvidence ? "Obrigatória" : "Opcional"}
                    />
                    <Info
                      label="Execuções"
                      value={String(executions.filter((e) => e.templateId === t.id).length)}
                    />
                  </dl>
                  {t.status === "draft" ? (
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      Rotina em rascunho não gera execuções. Defina a data de início e a
                      configuração da frequência para ativar.
                    </p>
                  ) : null}
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <DialogButton
                        variant="edit"
                        label="Editar"
                        title="Editar rotina"
                        fields={tplFields}
                        initial={{
                          name: t.name,
                          description: t.description ?? "",
                          frequency: t.frequency,
                          owner_user_id: t.ownerUserId ?? "none",
                          start_date: t.startDate ?? "",
                          weekday: t.weekday === null ? "none" : String(t.weekday),
                          day_of_month: t.dayOfMonth === null ? "" : String(t.dayOfMonth),
                          custom_interval_days:
                            t.customIntervalDays === null ? "" : String(t.customIntervalDays),
                          scheduled_time: t.scheduledTime ? t.scheduledTime.slice(0, 5) : "",
                          requires_evidence: t.requiresEvidence,
                          status: t.status,
                        }}
                        onSubmit={async (v) => updateRow("routine_templates", t.id, tplPayload(v))}
                        onDone={invalidate}
                      />
                      {t.status === "active" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => gen.mutate(t.id)}
                            disabled={gen.isPending}
                          >
                            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Gerar execuções devidas
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              act.mutate(() =>
                                updateRow("routine_templates", t.id, { status: "paused" }),
                              )
                            }
                          >
                            Pausar
                          </Button>
                        </>
                      ) : t.status === "paused" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            act.mutate(() =>
                              updateRow("routine_templates", t.id, { status: "active" }),
                            )
                          }
                        >
                          Reativar
                        </Button>
                      ) : null}
                      {t.status !== "archived" ? (
                        <ConfirmAction
                          trigger={
                            <Button size="sm" variant="ghost">
                              Arquivar
                            </Button>
                          }
                          title="Arquivar rotina?"
                          description="A rotina e suas execuções permanecem no histórico. Nada é excluído."
                          actionLabel="Arquivar"
                          onConfirm={() =>
                            act.mutate(() =>
                              updateRow("routine_templates", t.id, { status: "archived" }),
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

        <TabsContent value="execucoes" className="space-y-3 pt-4">
          {executions.length === 0 ? (
            <StateCard
              title="Nenhuma execução gerada"
              description="Ative uma rotina e use “Gerar execuções devidas”. A geração é idempotente: a mesma competência nunca é duplicada."
            />
          ) : (
            executions.map((e) => (
              <ExecutionCard
                key={e.id}
                exec={e}
                template={tplById.get(e.templateId)}
                canManage={canEdit}
                canExecuteOwn={canExecuteOwn}
                meUserId={w.meUserId}
                onDone={invalidate}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DialogButton({
  label,
  title,
  fields,
  initial,
  onSubmit,
  onDone,
  variant = "new",
}: {
  label: string;
  title: string;
  fields: Field[];
  initial?: FormValues;
  onSubmit: (v: FormValues) => Promise<void>;
  onDone: () => void;
  variant?: "new" | "edit";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant={variant === "edit" ? "outline" : "default"}
        onClick={() => setOpen(true)}
      >
        {variant === "edit" ? (
          <Pencil className="mr-2 h-3.5 w-3.5" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        {label}
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
          toast.success("Registro salvo.");
        }}
      />
    </>
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
