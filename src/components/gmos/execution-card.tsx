// FASE F7-B — cartão único de execução de rotina, usado em /rotinas e /meu-trabalho.
// Evidência é texto ou URL: upload de arquivo não está implementado nesta versão.
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordDialog, toNullable, type Field } from "@/components/gmos/record-dialog";
import {
  EXECUTION_STATUS,
  FREQUENCY,
  fmtDate,
  fmtDateTime,
  updateRow,
  type RoutineExecution,
  type RoutineTemplate,
} from "@/lib/gmos/f2";
import { canExecute, ownerDisplay } from "@/lib/gmos/routine-access";

export function ExecutionCard({
  exec,
  template,
  meUserId,
  canManage,
  canExecuteOwn,
  contextLabel,
  onDone,
}: {
  exec: RoutineExecution;
  template?: RoutineTemplate;
  meUserId: string | null;
  canManage: boolean;
  canExecuteOwn: boolean;
  contextLabel?: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"completed" | "blocked">("completed");

  const allowed = canExecute(
    { executionOwnerId: exec.ownerUserId, templateOwnerId: template?.ownerUserId, meUserId },
    { canManage, canExecuteOwn },
    exec.status,
  );

  const fields: Field[] = [
    {
      name: "evidence",
      label: "Evidência (texto ou link)",
      type: "textarea",
      required: mode === "completed" && Boolean(template?.requiresEvidence),
      help: "Registre a evidência em texto ou informe o link do arquivo. Upload de arquivo não está disponível nesta versão.",
    },
    { name: "notes", label: "Observação", type: "textarea", required: mode === "blocked" },
  ];

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{template?.name ?? "Rotina"}</span>
          </h3>
          <div className="flex shrink-0 gap-2">
            {template ? (
              <Badge variant="secondary">
                {FREQUENCY[template.frequency] ?? template.frequency}
              </Badge>
            ) : null}
            <Badge
              variant={
                exec.status === "completed"
                  ? "default"
                  : exec.status === "blocked"
                    ? "destructive"
                    : "outline"
              }
            >
              {EXECUTION_STATUS[exec.status] ?? exec.status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {contextLabel ? `${contextLabel} · ` : ""}Competência {fmtDate(exec.competenceDate)} ·
          Prazo {fmtDate(exec.dueDate)} · Responsável{" "}
          {ownerDisplay(exec.ownerUserId ?? template?.ownerUserId ?? null, meUserId)}
          {exec.completedAt ? ` · Concluída em ${fmtDateTime(exec.completedAt)}` : ""}
          {template?.requiresEvidence ? " · Evidência obrigatória" : ""}
        </p>
        {exec.evidence ? (
          <p className="text-sm">
            <span className="font-medium">Evidência:</span> {exec.evidence}
          </p>
        ) : null}
        {exec.notes ? <p className="text-sm text-muted-foreground">{exec.notes}</p> : null}

        {allowed ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                setMode("completed");
                setOpen(true);
              }}
            >
              Concluir
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
            mode === "completed" && template?.requiresEvidence
              ? "Esta rotina exige evidência para ser concluída."
              : "Registre observação e evidência quando aplicável."
          }
          fields={fields}
          initial={{ evidence: exec.evidence ?? "", notes: exec.notes ?? "" }}
          submitLabel={mode === "completed" ? "Concluir" : "Registrar"}
          onSubmit={async (v) => {
            await updateRow("routine_executions", exec.id, {
              status: mode,
              evidence: toNullable(v.evidence),
              notes: toNullable(v.notes),
              completed_at: mode === "completed" ? new Date().toISOString() : null,
              completed_by: mode === "completed" ? meUserId : null,
            });
            onDone();
            toast.success(mode === "completed" ? "Execução concluída." : "Impedimento registrado.");
          }}
        />
      </CardContent>
    </Card>
  );
}
