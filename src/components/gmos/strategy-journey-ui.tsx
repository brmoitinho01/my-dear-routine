// FASE F12 — componentes de apresentação da Jornada Estratégica.
// Nenhuma regra de autorização vive aqui: a UI apenas reflete banco + motor determinístico.
import type { ReactNode } from "react";
import { ArrowRight, Check, Info, Lightbulb, ShieldQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ADHERENCE_LABEL,
  DIMENSION_LABEL,
  JOURNEY_PHASE_LABEL,
  KPI_CLASS_LABEL,
  MATURITY_BAND_LABEL,
  groupKpisByClass,
  type Adherence,
  type DimensionScore,
  type JourneyProgress,
  type JourneyDerivedStatus,
  type JourneyStep,
  type MaturityScore,
  type Recommendation,
} from "@/lib/gmos/strategy-recommendations";

/* ---------------- stepper ---------------- */

export function JourneyStepper({
  progress,
  active,
  onSelect,
}: {
  progress: JourneyProgress;
  active: JourneyStep;
  onSelect: (step: JourneyStep) => void;
}) {
  return (
    <nav aria-label="Etapas da jornada estratégica">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {progress.steps.map((s, i) => {
          const isActive = s.step === active;
          return (
            <li key={s.step}>
              <button
                type="button"
                onClick={() => onSelect(s.step)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition",
                  isActive ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/60",
                )}
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                      s.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background",
                    )}
                  >
                    {s.done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                  </span>
                  Etapa {i + 1}
                </span>
                <span className="text-sm font-medium leading-tight">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={progress.percent} className="h-2" />
        <span className="shrink-0 text-xs text-muted-foreground">
          {progress.completed}/{progress.total} etapas
        </span>
      </div>
    </nav>
  );
}

/* ---------------- blocos auxiliares ---------------- */

export function SectionIntro({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {hint ? (
        <p className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="max-w-prose">{hint}</span>
        </p>
      ) : null}
    </div>
  );
}

export function ReadOnlyNotice() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start gap-2 p-4 text-sm text-muted-foreground">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Você tem acesso de leitura a esta jornada. Para responder, decidir e levar o rascunho ao
          planejamento é necessária a permissão de gestão do planejamento nesta unidade.
        </span>
      </CardContent>
    </Card>
  );
}

/* ---------------- orientação executiva (F12.1-C2A) ---------------- */

const PHASE_LABEL = JOURNEY_PHASE_LABEL;

export function JourneyOrientation({
  derived,
  onContinue,
  onOpenPlanning,
}: {
  derived: JourneyDerivedStatus;
  onContinue: (step: JourneyStep) => void;
  onOpenPlanning: () => void;
}) {
  const { nextAction } = derived;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Onde a jornada está
          </p>
          <p className="text-base font-semibold leading-snug">{PHASE_LABEL[derived.phase]}</p>
          {nextAction.reason ? (
            <p className="max-w-prose text-sm text-muted-foreground">{nextAction.reason}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {derived.percent}% da jornada · {derived.pendingObjectives} objetivo(s) no rascunho ·{" "}
            {derived.appliedObjectives} já no planejamento
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant="outline">
            {derived.completedSteps.length}/{derived.steps.length} etapas concluídas
          </Badge>
          <Button
            size="sm"
            onClick={() => {
              if (nextAction.href) onOpenPlanning();
              else if (nextAction.step) onContinue(nextAction.step);
            }}
          >
            {nextAction.label}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- painel de maturidade ---------------- */

function bandTone(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score < 40) return "bg-destructive";
  if (score < 60) return "bg-amber-500";
  if (score < 80) return "bg-primary";
  return "bg-emerald-600";
}

export function MaturityPanel({ maturity }: { maturity: MaturityScore }) {
  const provisional = !maturity.complete;
  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Maturidade de gestão
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {maturity.overall}
              <span className="text-base font-medium text-muted-foreground">/100</span>
              {provisional ? (
                <span className="ml-2 text-sm font-medium text-muted-foreground">provisório</span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {maturity.answered} de {maturity.total} respostas
            </p>
          </div>
          {provisional ? (
            <Badge variant="outline">Resultado provisório</Badge>
          ) : (
            <Badge variant="secondary">{MATURITY_BAND_LABEL[maturity.band]}</Badge>
          )}
        </div>

        {provisional ? (
          <div className="space-y-2">
            <Progress value={maturity.completionPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Complete o questionário para ver a classificação de maturidade e as principais
              lacunas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {maturity.byDimension.map((d) => (
              <DimensionBar key={d.dimension} item={d} />
            ))}
          </div>
        )}

        {maturity.complete && maturity.gaps.length ? (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Principais lacunas
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {maturity.gaps.map((g) => (
                <li key={g}>• {DIMENSION_LABEL[g]}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          O score não avalia se a empresa é boa ou ruim. Ele mostra o quanto a gestão está
          estruturada para sustentar o próximo estágio.
        </p>
      </CardContent>
    </Card>
  );
}

function DimensionBar({ item }: { item: DimensionScore }) {
  const value = item.score ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{DIMENSION_LABEL[item.dimension]}</span>
        <span className="text-muted-foreground">
          {item.score === null ? "sem resposta" : `${item.score}/100`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", bandTone(item.score))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- card de recomendação ---------------- */

const ADHERENCE_VARIANT: Record<Adherence, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

export function RecommendationCard({
  recommendation,
  state,
  actions,
  selectedKpiIds,
  onToggleKpi,
  kpiDisabled,
  showKpiWarning,
}: {
  recommendation: Recommendation;
  state: "accepted" | "discarded" | "pending";
  actions?: ReactNode;
  /** Ids de KPIs do catálogo com decisão explícita 'accepted'. */
  selectedKpiIds?: Set<string>;
  onToggleKpi?: (templateKpiId: string, selected: boolean) => void;
  kpiDisabled?: boolean;
  /** Objetivo no rascunho e nenhum indicador escolhido. */
  showKpiWarning?: boolean;
}) {
  const { objective, adherence, reasons, relatedKpis } = recommendation;
  const groups = groupKpisByClass(relatedKpis);

  return (
    <Card
      className={cn(
        state === "accepted" && "border-primary/60 bg-primary/[0.03]",
        state === "discarded" && "opacity-60",
      )}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {DIMENSION_LABEL[objective.dimension]}
            </p>
            <h3 className="text-base font-semibold leading-snug">{objective.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {state === "accepted" ? <Badge variant="secondary">No rascunho</Badge> : null}
            {state === "discarded" ? <Badge variant="outline">Descartado</Badge> : null}
            <Badge variant={ADHERENCE_VARIANT[adherence]}>{ADHERENCE_LABEL[adherence]}</Badge>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{objective.description}</p>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden />
            Recomendado porque…
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>

        {objective.rationale.trim() ? (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Por que este objetivo costuma ajudar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{objective.rationale}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Conhecimento curado da biblioteca do método — não é evidência registrada por esta
              empresa.
            </p>
          </div>
        ) : null}

        {groups.length ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escolha os indicadores que vão acompanhar este objetivo
            </p>
            {showKpiWarning ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs font-medium text-destructive">
                Escolha pelo menos 1 indicador para este objetivo antes de levar o rascunho ao
                planejamento.
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              {groups.map((g) => (
                <div key={g.kpiClass} className="rounded-lg border p-3">
                  <p className="text-xs font-semibold">{KPI_CLASS_LABEL[g.kpiClass]}</p>
                  <ul className="mt-2 space-y-2">
                    {g.items.map((k) => {
                      const selected = selectedKpiIds?.has(k.id) ?? false;
                      return (
                        <li key={k.id} className="flex gap-2">
                          {onToggleKpi ? (
                            <Checkbox
                              id={`kpi-${k.id}`}
                              className="mt-0.5"
                              checked={selected}
                              disabled={kpiDisabled}
                              onCheckedChange={(v) => onToggleKpi(k.id, v === true)}
                              aria-label={`Selecionar indicador ${k.name}`}
                            />
                          ) : null}
                          <div className="min-w-0 space-y-0.5">
                            <label
                              htmlFor={`kpi-${k.id}`}
                              className="block text-sm font-medium leading-tight"
                            >
                              {k.name}
                            </label>
                            {selected ? (
                              <Badge variant="secondary" className="text-[10px]">
                                Selecionado para o rascunho
                              </Badge>
                            ) : null}
                            <p className="text-[11px] text-muted-foreground">
                              {[k.unit, `frequência sugerida: ${frequencyLabel(k.frequency)}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {k.sourceHint ? (
                              <p className="text-[11px] text-muted-foreground">
                                Fonte sugerida: {k.sourceHint}
                              </p>
                            ) : null}
                            {k.formula ? (
                              <p className="text-[11px] text-muted-foreground">
                                Fórmula sugerida: {k.formula}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Indicador escolhido entra no planejamento apenas como rascunho: fonte oficial,
              responsável, baseline e meta continuam sendo definidos pela liderança no planejamento.
            </p>
          </div>
        ) : null}

        {actions ? <div className="flex flex-wrap gap-2 pt-1">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "diário",
  weekly: "semanal",
  biweekly: "quinzenal",
  monthly: "mensal",
  quarterly: "trimestral",
  yearly: "anual",
};

export function frequencyLabel(frequency: string): string {
  return FREQUENCY_LABEL[frequency] ?? frequency;
}
