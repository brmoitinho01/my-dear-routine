// FASE F7-C — "Meu trabalho": rotinas e ações atribuídas ao usuário autenticado.
// Somente dados reais retornados pela RLS. Nenhum item é simulado.
import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, Clock, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gmos/page-header";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { RequirePermission } from "@/components/gmos/permission-gate";
import { ExecutionCard } from "@/components/gmos/execution-card";
import { useAuth } from "@/lib/auth-context";
import { PLAN_STATUS, fmtDate, type RoutineTemplate } from "@/lib/gmos/f2";
import {
  DONE_ACTION_STATUS,
  DONE_EXECUTION_STATUS,
  bucketByDue,
  fetchMyWork,
  todayIso,
  type MyAction,
  type MyExecution,
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
        content:
          "Rotinas e planos de ação atribuídos a você, com registro de execução e evidência.",
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
    () => bucketByDue(work.data?.executions ?? [], today, DONE_EXECUTION_STATUS),
    [work.data, today],
  );
  const actions = useMemo(
    () => bucketByDue(work.data?.actions ?? [], today, DONE_ACTION_STATUS),
    [work.data, today],
  );
  const templates = useMemo(
    () => new Map((work.data?.templates ?? []).map((t) => [t.id, t])),
    [work.data],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gmos", "my-work"] });
  const canExecuteOwn = can("routine.execute_own");

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

  const total = (work.data?.executions.length ?? 0) + (work.data?.actions.length ?? 0);

  const group = (
    title: string,
    icon: React.ReactNode,
    items: MyExecution[],
    emptyLabel: string,
  ) => (
    <RoutineGroup
      key={title}
      title={title}
      icon={icon}
      items={items}
      templates={templates}
      canExecuteOwn={canExecuteOwn}
      meUserId={meUserId}
      onDone={invalidate}
      emptyLabel={emptyLabel}
    />
  );

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

      {group(
        "Rotinas em atraso",
        <Clock className="h-4 w-4 text-destructive" aria-hidden />,
        routines.late,
        "Nenhuma rotina em atraso.",
      )}
      {group(
        "Rotinas de hoje",
        <CalendarClock className="h-4 w-4 text-brand-accent" aria-hidden />,
        routines.today,
        "Nenhuma rotina com prazo hoje.",
      )}
      {group(
        "Próximas rotinas",
        <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />,
        routines.upcoming.slice(0, 12),
        "Nenhuma rotina futura gerada.",
      )}
      {group(
        "Concluídas recentemente",
        <CheckCircle2 className="h-4 w-4 text-brand-accent" aria-hidden />,
        routines.recentlyDone.slice(0, 8),
        "Nenhuma conclusão registrada ainda.",
      )}

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
            {[...actions.late, ...actions.today, ...actions.upcoming, ...actions.recentlyDone].map(
              (a) => (
                <ActionRowCard key={a.id} action={a} late={actions.late.includes(a)} />
              ),
            )}
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

function ActionRowCard({ action, late }: { action: MyAction; late: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{action.title}</p>
          <p className="text-xs text-muted-foreground">
            {action.businessUnitName} · Prazo {fmtDate(action.dueDate)} · {action.progress}%
            concluído
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
  templates,
  canExecuteOwn,
  meUserId,
  onDone,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: MyExecution[];
  templates: Map<string, RoutineTemplate>;
  canExecuteOwn: boolean;
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
            <ExecutionCard
              key={item.id}
              exec={item}
              template={templates.get(item.templateId)}
              meUserId={meUserId}
              canManage={false}
              canExecuteOwn={canExecuteOwn}
              contextLabel={item.businessUnitName}
              onDone={onDone}
            />
          ))}
        </div>
      )}
    </section>
  );
}
