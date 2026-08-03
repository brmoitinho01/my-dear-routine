// FASE F7-D — blocos visuais reutilizados pelos painéis do grupo e da equipe.
// Apenas apresentação: nenhum número é calculado ou inventado aqui.
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KPI_HEALTH_LABEL, type KpiHealth, type KpiSummary } from "@/lib/gmos/group-dashboard";

export function MetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default: "text-foreground",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
    success: "text-brand-accent",
  }[tone];
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold tabular-nums", toneClass)}>{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

const HEALTH_VARIANT: Record<KpiHealth, "default" | "secondary" | "destructive" | "outline"> = {
  on_target: "default",
  attention: "secondary",
  critical: "destructive",
  no_measurement: "outline",
};

export function KpiHealthBadge({ health }: { health: KpiHealth }) {
  return <Badge variant={HEALTH_VARIANT[health]}>{KPI_HEALTH_LABEL[health]}</Badge>;
}

export function KpiHealthBar({ summary }: { summary: KpiSummary }) {
  const total =
    summary.on_target + summary.attention + summary.critical + summary.no_measurement || 1;
  const segments: Array<{ key: KpiHealth; className: string }> = [
    { key: "on_target", className: "bg-brand-accent" },
    { key: "attention", className: "bg-amber-500" },
    { key: "critical", className: "bg-destructive" },
    { key: "no_measurement", className: "bg-muted-foreground/30" },
  ];
  return (
    <div className="space-y-1">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={segments.map((s) => `${KPI_HEALTH_LABEL[s.key]}: ${summary[s.key]}`).join(", ")}
      >
        {segments.map((s) =>
          summary[s.key] > 0 ? (
            <span
              key={s.key}
              className={s.className}
              style={{ width: `${(summary[s.key] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.on_target} no alvo · {summary.attention} em atenção · {summary.critical} crítico ·{" "}
        {summary.no_measurement} sem medição validada
      </p>
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
