// FASE F8 — assistente do ciclo estratégico (interface).
// Não decide permissão: recebe de quem já consultou o banco.
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import { StateCard } from "@/components/gmos/states";
import {
  REVIEW_STATUS,
  type Completeness,
  type Diagnostic,
  type DiagnosticInput,
  type IdentityInput,
  type Pending,
  type StageId,
  type StageProgress,
  type StrategicIdentity,
  type WorkflowActions,
} from "@/lib/gmos/strategy";

/* ---------- passos ---------- */

export function StrategyStepper({
  progress,
  active,
  onSelect,
}: {
  progress: StageProgress;
  active: StageId;
  onSelect: (id: StageId) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Progress value={progress.percent} className="h-2" />
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {progress.percent}%
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {progress.stages.map((s, i) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={current ? "step" : undefined}
                className={`w-full rounded-lg border p-2 text-left transition ${
                  current ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Etapa {i + 1}
                  {s.complete ? <Check className="h-3 w-3 text-emerald-600" /> : null}
                </span>
                <span className="mt-0.5 block text-xs font-semibold leading-tight">{s.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {s.done}/{s.total}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function CycleStatusBar({
  identity,
  planStatus,
  completeness,
}: {
  identity: StrategicIdentity | null;
  planStatus: string;
  completeness: Completeness;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={completeness.ready ? "default" : "secondary"}>
        {completeness.ready ? "Planejamento completo" : "Planejamento em construção"}
      </Badge>
      <Badge variant="outline">
        Revisão: {REVIEW_STATUS[identity?.reviewStatus ?? "draft"] ?? identity?.reviewStatus}
      </Badge>
      <Badge variant="outline">Versão {identity?.version ?? 1}</Badge>
      {planStatus === "active" ? <Badge>Ciclo ativo</Badge> : null}
      {completeness.pendings.length > 0 ? (
        <span className="text-xs text-muted-foreground">
          {completeness.pendings.length} pendência(s)
        </span>
      ) : null}
    </div>
  );
}

export function PendingList({ items, title }: { items: Pending[]; title?: string }) {
  if (items.length === 0) return null;
  return (
    <Card className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
      <CardContent className="space-y-1 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {title ?? "Pendências desta etapa"}
        </p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {items.map((p) => (
            <li key={p.code}>{p.message}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ---------- formulários ---------- */

function LongField({
  label,
  help,
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  rows?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold">{label}</span>
      {help ? <span className="block text-xs text-muted-foreground">{help}</span> : null}
      <Textarea
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function IdentityForm({
  identity,
  canEdit,
  saving,
  onSave,
}: {
  identity: StrategicIdentity | null;
  canEdit: boolean;
  saving: boolean;
  onSave: (v: IdentityInput) => void;
}) {
  const [form, setForm] = useState<IdentityInput>({
    mission: identity?.mission ?? "",
    vision: identity?.vision ?? "",
    valuesText: identity?.valuesText ?? "",
    strategicNorth: identity?.strategicNorth ?? "",
  });

  useEffect(() => {
    setForm({
      mission: identity?.mission ?? "",
      vision: identity?.vision ?? "",
      valuesText: identity?.valuesText ?? "",
      strategicNorth: identity?.strategicNorth ?? "",
    });
  }, [identity]);

  const set = (k: keyof IdentityInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Direcionamento estratégico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LongField
          label="Missão"
          help="Por que a unidade existe."
          value={form.mission}
          onChange={set("mission")}
          disabled={!canEdit}
        />
        <LongField
          label="Visão"
          help="Onde a unidade quer chegar ao fim do ciclo."
          value={form.vision}
          onChange={set("vision")}
          disabled={!canEdit}
        />
        <LongField
          label="Valores"
          help="Comportamentos não negociáveis."
          value={form.valuesText}
          onChange={set("valuesText")}
          disabled={!canEdit}
        />
        <LongField
          label="Norte estratégico"
          help="A prioridade única que orienta as escolhas do ciclo."
          value={form.strategicNorth}
          onChange={set("strategicNorth")}
          disabled={!canEdit}
        />
        {canEdit ? (
          <Button size="sm" disabled={saving} onClick={() => onSave(form)}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar direcionamento
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Você tem acesso de leitura a esta etapa.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DiagnosisForm({
  diagnostic,
  canEdit,
  saving,
  onSave,
}: {
  diagnostic: Diagnostic | null;
  canEdit: boolean;
  saving: boolean;
  onSave: (v: DiagnosticInput) => void;
}) {
  const initial = (d: Diagnostic | null): DiagnosticInput => ({
    contextSummary: d?.contextSummary ?? "",
    strengths: d?.strengths ?? "",
    weaknesses: d?.weaknesses ?? "",
    opportunities: d?.opportunities ?? "",
    threats: d?.threats ?? "",
    strategicPriorities: d?.strategicPriorities ?? "",
    assumptions: d?.assumptions ?? "",
  });
  const [form, setForm] = useState<DiagnosticInput>(() => initial(diagnostic));
  useEffect(() => setForm(initial(diagnostic)), [diagnostic]);
  const set = (k: keyof DiagnosticInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Diagnóstico do ciclo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <LongField
          label="Resumo do contexto"
          help="Situação atual da unidade em poucas linhas."
          value={form.contextSummary}
          onChange={set("contextSummary")}
          disabled={!canEdit}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <LongField
            label="Forças"
            value={form.strengths}
            onChange={set("strengths")}
            disabled={!canEdit}
          />
          <LongField
            label="Fraquezas"
            value={form.weaknesses}
            onChange={set("weaknesses")}
            disabled={!canEdit}
          />
          <LongField
            label="Oportunidades"
            value={form.opportunities}
            onChange={set("opportunities")}
            disabled={!canEdit}
          />
          <LongField
            label="Ameaças"
            value={form.threats}
            onChange={set("threats")}
            disabled={!canEdit}
          />
        </div>
        <LongField
          label="Prioridades estratégicas"
          help="O que precisa ser resolvido neste ciclo, em ordem."
          value={form.strategicPriorities}
          onChange={set("strategicPriorities")}
          disabled={!canEdit}
        />
        <LongField
          label="Premissas e restrições (opcional)"
          value={form.assumptions}
          onChange={set("assumptions")}
          disabled={!canEdit}
        />
        {canEdit ? (
          <Button size="sm" disabled={saving} onClick={() => onSave(form)}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar diagnóstico
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Você tem acesso de leitura a esta etapa.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- revisão e ativação ---------- */

export function ReviewPanel({
  identity,
  completeness,
  actions,
  busy,
  onSubmit,
  onApprove,
  onActivate,
}: {
  identity: StrategicIdentity | null;
  completeness: Completeness;
  actions: WorkflowActions;
  busy: boolean;
  onSubmit: () => void;
  onApprove: (notes: string) => void;
  onActivate: () => void;
}) {
  const [notes, setNotes] = useState("");
  const c = completeness.counts;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Consistência do planejamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <Item label="Objetivos ativos" value={c.objectives} />
            <Item label="Objetivos sem responsável" value={c.objectivesWithoutOwner} />
            <Item label="Objetivos sem indicador" value={c.objectivesWithoutKpi} />
            <Item label="Indicadores ativos" value={c.kpis} />
            <Item label="Indicadores sem objetivo" value={c.kpisWithoutObjective} />
            <Item label="Indicadores incompletos" value={c.kpisIncomplete} />
          </dl>
          {completeness.pendings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Nenhuma pendência de completude.
            </p>
          ) : (
            <PendingList items={completeness.pendings} title="Pendências do ciclo" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fluxo de aprovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Rascunho → Em revisão → Aprovado → Ciclo ativo. A validação final é feita pelo banco:
            botões visíveis não substituem permissão.
          </p>
          {identity?.approvalNotes ? (
            <p className="rounded-md bg-muted p-2 text-sm">
              Parecer registrado: {identity.approvalNotes}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {actions.canSubmit ? (
              <ConfirmAction
                trigger={
                  <Button size="sm" disabled={busy}>
                    Enviar para revisão
                  </Button>
                }
                title="Enviar o planejamento para revisão?"
                description="A liderança poderá aprovar o ciclo. A edição continua liberada até a aprovação."
                actionLabel="Enviar"
                onConfirm={onSubmit}
              />
            ) : null}

            {actions.canApprove ? (
              <ConfirmAction
                trigger={
                  <Button size="sm" disabled={busy}>
                    Aprovar planejamento
                  </Button>
                }
                title="Aprovar o planejamento estratégico?"
                description="A aprovação é registrada com autoria, data e parecer na auditoria."
                actionLabel="Aprovar"
                onConfirm={() => onApprove(notes)}
              />
            ) : null}

            {actions.canActivate ? (
              <ConfirmAction
                trigger={
                  <Button size="sm" variant="outline" disabled={busy}>
                    Ativar ciclo
                  </Button>
                }
                title="Ativar o ciclo estratégico?"
                description="O ciclo passa a orientar planos de ação e rotinas da unidade."
                actionLabel="Ativar"
                onConfirm={onActivate}
              />
            ) : null}
          </div>

          {actions.canApprove ? (
            <LongField
              label="Parecer da aprovação (opcional)"
              value={notes}
              onChange={setNotes}
              disabled={busy}
              rows={2}
            />
          ) : null}

          {!actions.canSubmit && !actions.canApprove && !actions.canActivate ? (
            <StateCard
              title="Nenhuma ação disponível agora"
              description={
                actions.activateBlockedReason ??
                "Conclua as etapas anteriores ou aguarde a decisão da liderança."
              }
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
