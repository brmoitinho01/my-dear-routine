// FASE F7-C — "Meu trabalho": rotinas e ações atribuídas ao usuário autenticado.
// Somente dados reais retornados pela RLS. Nenhum item é simulado.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, Clock, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gmos/page-header";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { RequirePermission } from "@/components/gmos/permission-gate";
import { RecordDialog, toNullable, type Field, type FormValues } from "@/components/gmos/record-dialog";
import { useAuth } from "@/lib/auth-context";
import { EXECUTION_STATUS, FREQUENCY, PLAN_STATUS, fmtDate } from "@/lib/gmos/f2";
import {
  DONE_ACTION_STATUS,
  DONE_EXECUTION_STATUS,
  bucketByDue,
  fetchMyWork,
  recordMyExecution,
  todayIso,
  type MyActionItem,
  type MyRoutineItem,
} from "@/lib/gmos/my-work";

export const Route = createFileRoute("/_authenticated/meu-trabalho")({
  head: () => ({
    meta: [
      { title: "Meu trabalho — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Rotinas e planos de ação atribuídos a você no GMOS: atrasados, de hoje, próximos e concluídos.",
      },
      { property: "og:title", content: "Meu trabalho — GMOS · Grupo Moitinho" },
      {
        property: "og:description",
        content: "Rotinas e planos de ação atribuídos a você, com registro de execução e evidência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="dashboard.personal" area="acessar o painel pessoal">
      <MyWorkPage />
    </RequirePermission>
  ),
});

function MyWorkPage() {
  const { internalUser, can } = useAuth();
  const meUserId = internalUser?.id ?? null;
  const qc = useQueryClient();
  const today = todayIso();

  const work = useQuery({
    queryKey: ["gmos", "my-work", meUserId],
    queryFn: () => fetchMyWork(meUserId!),
    enabled: Boolean(meUserId),
    retry: false,
  });

  const routines = useMemo(
    () => bucketByDue(work.data?.routines ?? [], today, DONE_EXECUTION_STATUS),
    [work.data, today],
  );
  const actions = useMemo(
    () => bucketByDue(work.data?.actions ?? [], today, DONE_ACTION_STATUS),
    [work.data, today],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gmos", "my-work"] });

  if (!meUserId) {
    return (
      <StateCard
        title="Cadastro interno não encontrado"
        description="Seu login está ativo, mas não há cadastro interno vinculado. Solicite o provisionamento ao administrador do Grupo."
      />
    );
  }
  if (work.isPending) return <LoadingBlock rows={3} />;
  if (work.error) return <ErrorBlock error={work.error} onRetry={() => work.refetch()} />;

  const total = (work.data?.routines.length ?? 0) + (work.data?.actions.length ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Meu trabalho" }]}
        title="Meu trabalho"
        description="Somente o que está atribuído a você: rotinas a executar e planos de ação sob sua responsabilidade."
        context={`${routines.late.length} rotina(s) em atraso · ${routines.today.length} para hoje`}
      />

      {total === 0 ? (
        <StateCard
          title="Nada atribuído a você neste momento"
          description="Quando uma rotina ou um plano de ação for atribuído ao seu usuário, ele aparece aqui automaticamente."
        />
      ) : null}

      <RoutineGroup
        title="Rotinas em atraso"
        icon={<Clock className="h-4 w-4 text-destructive" aria-hidden />}
        items={routines.late}
        canExecute={can("routine.execute_own")}
        meUserId={meUserId}
        onDone={invalidate}
        emptyLabel="Nenhuma rotina em atraso."
      />
      <RoutineGroup
        title="Rotinas de hoje"
        icon={<CalendarClock className="h-4 w-4 text-brand-accent" aria-hidden />}
        items={routines.today}
        canExecute={can("routine.execute_own")}
        meUserId={meUserId}
        onDone={invalidate}
        emptyLabel="Nenhuma rotina com prazo hoje."
      />
      <RoutineGroup
        title="Próximas rotinas"
        icon={<CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />}
        items={routines.upcoming.slice(0, 12)}
        canExecute={can("routine.execute_own")}
        meUserId={meUserId}
        onDone={invalidate}
        emptyLabel="Nenhuma rotina futura gerada."
      />
      <RoutineGroup
        title="Concluídas recentemente"
        icon={<CheckCircle2 className="h-4 w-4 text-brand-accent" aria-hidden />}
        items={routines.done.slice(0, 8)}
        canExecute={false}
        meUserId={meUserId}
        onDone={invalidate}
        emptyLabel="Nenhuma conclusão registrada ainda."
      />

      <section aria-labelledby="minhas-acoes" className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-brand-accent" aria-hidden />
          <h2 id="minhas-acoes" className="text-sm font-semibold">
            Planos de ação sob sua responsabilidade
          </h2>
        </div>
        {work.data?.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum plano de ação atribuído ao seu usuário.
          </p>
        ) : (
          <div className="space-y-2">
            {[...actions.late, ...actions.today, ...actions.upcoming, ...actions.done].map((a) => (
              <ActionRowCard key={a.id} action={a} late={actions.late.includes(a)} />
            ))}
          </div>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/planos-de-acao">
            <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
            Abrir planos de ação
          </Link>
        </Button>
      </section>
    </div>
  );
}

function ActionRowCard({ action, late }: { action: MyActionItem; late: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{action.title}</p>
          <p className="text-xs text-muted-foreground">
            {action.businessUnitName} · Prazo {fmtDate(action.dueDate)} · {action.progress}% concluído
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {late ? <Badge variant="destructive">Em atraso</Badge> : null}
          <Badge variant="outline">{PLAN_STATUS[action.status] ?? action.status}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RoutineGroup({
  title,
  icon,
  items,
  canExecute,
  meUserId,
  onDone,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: MyRoutineItem[];
  canExecute: boolean;
  meUserId: string;
  onDone: () => void;
  emptyLabel: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="secondary" className="ml-auto font-normal">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <MyExecutionCard
              key={item.id}
              item={item}
              canExecute={canExecute}
              meUserId={meUserId}
              onDone={onDone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MyExecutionCard({
  item,
  canExecute,
  meUserId,
  onDone,
}: {
  item: MyRoutineItem;
  canExecute: boolean;
  meUserId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"completed" | "blocked">("completed");

  const record = useMutation({
    mutationFn: (values: FormValues) =>
      recordMyExecution({
        executionId: item.id,
        status: mode,
        evidence: toNullable(values.evidence) as string | null,
        notes: toNullable(values.notes) as string | null,
        meUserId,
      }),
    onSuccess: () => {
      toast.success(mode === "completed" ? "Execução concluída." : "Execução bloqueada.");
      onDone();
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a execução."),
  });

  const fields: Field[] = [
    {
      name: "evidence",
      label: "Evidência",
      type: "textarea",
      required: mode === "completed" && item.requiresEvidence,
      help: "Registre a evidência em texto ou informe o link do arquivo comprobatório.",
    },
    { name: "notes", label: "Observação", type: "textarea", required: mode === "blocked" },
  ];

  const finished = DONE_EXECUTION_STATUS.includes(item.status);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{item.templateName}</span>
          </h3>
          <div className="flex shrink-0 gap-2">
            <Badge variant="secondary">{FREQUENCY[item.frequency] ?? item.frequency}</Badge>
            <Badge variant={item.status === "completed" ? "default" : "outline"}>
              {EXECUTION_STATUS[item.status] ?? item.status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {item.businessUnitName} · Competência {fmtDate(item.competenceDate)} · Prazo{" "}
          {fmtDate(item.dueDate)}
          {item.requiresEvidence ? " · Evidência obrigatória" : ""}
        </p>
        {item.evidence ? (
          <p className="text-sm">
            <span className="font-medium">Evidência:</span> {item.evidence}
          </p>
        ) : null}
        {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}

        {canExecute && !finished ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                setMode("completed");
                setOpen(true);
              }}
            >
              Registrar conclusão
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMode("blocked");
                setOpen(true);
              }}
            >
              Registrar impedimento
            </Button>
          </div>
        ) : null}

        <RecordDialog
          open={open}
          onOpenChange={setOpen}
          title={mode === "completed" ? "Concluir execução" : "Registrar impedimento"}
          description={
            mode === "completed" && item.requiresEvidence
              ? "Esta rotina exige evidência para ser concluída."
              : "Registre observação e evidência quando aplicável."
          }
          fields={fields}
          initial={{ evidence: item.evidence ?? "", notes: item.notes ?? "" }}
          submitLabel="Salvar"
          onSubmit={async (values) => {
            await record.mutateAsync(values);
          }}
        />
      </CardContent>
    </Card>
  );
}
