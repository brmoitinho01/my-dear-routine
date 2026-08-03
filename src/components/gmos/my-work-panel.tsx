// FASE F7 — painel pessoal: somente rotinas e ações atribuídas ao usuário autenticado.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ListChecks, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { ExecutiveMetric } from "@/components/gmos/executive-metric";
import {
  fetchMyWork,
  groupExecutions,
  isActionLate,
  registerExecution,
  type MyExecution,
} from "@/lib/gmos/my-work";
import { useAuthz } from "@/components/gmos/authz-context";
import { useWorkspace } from "@/components/gmos/workspace-context";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  blocked: "Bloqueada",
  completed: "Concluída",
  skipped: "Não aplicável",
  cancelled: "Cancelada",
  planned: "Planejado",
  draft: "Rascunho",
};

function fmt(date: string | null) {
  if (!date) return "sem prazo";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export function MyWorkPanel() {
  const { authz } = useAuthz();
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const meUserId = authz?.userId ?? workspace?.meUserId ?? null;
  const canExecute = Boolean(authz?.can("routine.execute_own") || authz?.can("routine.manage"));
  const [target, setTarget] = useState<MyExecution | null>(null);

  const query = useQuery({
    queryKey: ["gmos", "my-work", meUserId],
    queryFn: () => fetchMyWork(meUserId!),
    enabled: Boolean(meUserId),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (values: { status: "completed" | "blocked"; evidence: string; notes: string }) =>
      registerExecution(target!.id, meUserId!, values),
    onSuccess: () => {
      toast.success("Execução registrada.");
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ["gmos", "my-work"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a execução."),
  });

  if (!meUserId)
    return (
      <StateCard
        title="Usuário sem cadastro interno"
        description="Seu login está ativo, mas ainda não há cadastro interno vinculado. Solicite provisionamento ao administrador do Grupo."
      />
    );
  if (query.isPending) return <LoadingBlock rows={3} />;
  if (query.error) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;

  const groups = groupExecutions(query.data?.executions ?? []);
  const actions = query.data?.actions ?? [];
  const lateActions = actions.filter((a) => isActionLate(a));
  const nothing =
    groups.late.length + groups.today.length + groups.upcoming.length + actions.length === 0;

  if (nothing)
    return (
      <StateCard
        title="Nada atribuído a você neste momento"
        description="Quando uma rotina ou plano de ação for atribuído ao seu nome, ele aparecerá aqui automaticamente."
      />
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ExecutiveMetric
          label="Rotinas em atraso"
          value={groups.late.length}
          tone={groups.late.length > 0 ? "alert" : undefined}
          icon={<TriangleAlert className="h-4 w-4 text-brand-accent" />}
        />
        <ExecutiveMetric
          label="Rotinas de hoje"
          value={groups.today.length}
          icon={<CalendarClock className="h-4 w-4 text-brand-accent" />}
        />
        <ExecutiveMetric
          label="Próximas rotinas"
          value={groups.upcoming.length}
          icon={<CalendarClock className="h-4 w-4 text-brand-accent" />}
        />
        <ExecutiveMetric
          label="Ações sob sua responsabilidade"
          value={actions.length}
          hint={`${lateActions.length} em atraso`}
          icon={<ListChecks className="h-4 w-4 text-brand-accent" />}
        />
      </div>

      <ExecutionGroup
        title="Em atraso"
        items={groups.late}
        canExecute={canExecute}
        onRegister={setTarget}
        tone="alert"
      />
      <ExecutionGroup
        title="Para hoje"
        items={groups.today}
        canExecute={canExecute}
        onRegister={setTarget}
      />
      <ExecutionGroup
        title="Próximas"
        items={groups.upcoming}
        canExecute={canExecute}
        onRegister={setTarget}
      />

      {groups.done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Registradas recentemente
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {groups.done.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{e.templateName}</span>
                  <span className="text-xs text-muted-foreground">{fmt(e.dueDate)}</span>
                  <Badge variant="outline">{STATUS_LABEL[e.status] ?? e.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Planos de ação sob sua responsabilidade
          </h2>
          {actions.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium">{a.title}</span>
                  <Badge variant={isActionLate(a) ? "destructive" : "outline"}>
                    {isActionLate(a) ? "Em atraso" : (STATUS_LABEL[a.status] ?? a.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.businessUnitName} · Prazo: {fmt(a.dueDate)} · Progresso: {a.progress}%
                </p>
                {a.why ? <p className="text-sm text-muted-foreground">Por quê: {a.why}</p> : null}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <RegisterDialog
        execution={target}
        pending={mutation.isPending}
        onClose={() => setTarget(null)}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </div>
  );
}

function ExecutionGroup({
  title,
  items,
  canExecute,
  onRegister,
  tone,
}: {
  title: string;
  items: MyExecution[];
  canExecute: boolean;
  onRegister: (e: MyExecution) => void;
  tone?: "alert";
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {items.map((e) => (
        <Card key={e.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm font-medium">{e.templateName}</span>
              <Badge variant={tone === "alert" ? "destructive" : "secondary"}>
                {tone === "alert" ? "Em atraso" : (STATUS_LABEL[e.status] ?? e.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {e.businessUnitName} · Competência {fmt(e.competenceDate)} · Prazo {fmt(e.dueDate)}
              {e.requiresEvidence ? " · exige evidência" : ""}
            </p>
            {canExecute ? (
              <Button size="sm" onClick={() => onRegister(e)}>
                Registrar execução
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Você não possui permissão para registrar esta execução.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function RegisterDialog({
  execution,
  pending,
  onClose,
  onSubmit,
}: {
  execution: MyExecution | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: { status: "completed" | "blocked"; evidence: string; notes: string }) => void;
}) {
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");
  const needsEvidence = Boolean(execution?.requiresEvidence);
  const blockedSubmit = needsEvidence && evidence.trim().length === 0;

  return (
    <Dialog
      open={Boolean(execution)}
      onOpenChange={(open) => {
        if (!open) {
          setEvidence("");
          setNotes("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar execução</DialogTitle>
          <DialogDescription>
            {execution
              ? `${execution.templateName} — prazo ${fmt(execution.dueDate)}`
              : "Rotina atribuída a você."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="evidencia">
              Evidência {needsEvidence ? "(obrigatória)" : "(opcional)"}
            </Label>
            <Input
              id="evidencia"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Link ou descrição objetiva da evidência"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onSubmit({ status: "blocked", evidence, notes })}
          >
            Registrar impedimento
          </Button>
          <Button
            disabled={pending || blockedSubmit}
            onClick={() => onSubmit({ status: "completed", evidence, notes })}
          >
            Concluir
          </Button>
        </DialogFooter>
        {blockedSubmit ? (
          <p className="text-xs text-muted-foreground">
            Esta rotina exige evidência para ser concluída.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}