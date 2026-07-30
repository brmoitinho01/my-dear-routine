import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AlertTriangle, CheckCircle2, CircleSlash, ListChecks, Repeat } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HEALTH_LABEL, pickTrendKpis, type ExecutivePanel, type PanelKpi } from "@/lib/gmos/demo";
import { DIRECTION, fmtNumber } from "@/lib/gmos/f2";

const HEALTH_TONE: Record<string, string> = {
  on_target: "border-brand-accent/50 bg-accent/40 text-accent-foreground",
  attention: "border-chart-4/50 bg-chart-4/15 text-foreground",
  critical: "border-destructive/40 bg-destructive/10 text-foreground",
  no_data: "border-border bg-muted/40 text-muted-foreground",
};

function TrendChart({ kpi }: { kpi: PanelKpi }) {
  const unit = kpi.unit ?? "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm leading-snug">{kpi.name}</CardTitle>
        <CardDescription className="text-xs">
          Unidade: {unit || "—"} · {DIRECTION[kpi.direction] ?? kpi.direction}
          {kpi.series.length
            ? ` · ${kpi.series[0].label} a ${kpi.series[kpi.series.length - 1].label}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpi.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v: number) => v.toLocaleString("pt-BR")}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--foreground)",
                }}
                formatter={(v: number, name: string) => [fmtNumber(Number(v), unit), name]}
                labelFormatter={(l: string) => `Competência ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="value"
                name={`Realizado${unit ? ` (${unit})` : ""}`}
                stroke="var(--brand-accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              {kpi.target !== null ? (
                <Line
                  type="monotone"
                  dataKey={() => kpi.target}
                  name={`Meta${unit ? ` (${unit})` : ""}`}
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExecutiveDemoPanel({ panel }: { panel: ExecutivePanel }) {
  const trends = pickTrendKpis(panel.kpis);

  const buckets = [
    { key: "on_target", icon: CheckCircle2, value: panel.onTarget },
    { key: "attention", icon: AlertTriangle, value: panel.attention },
    { key: "critical", icon: CircleSlash, value: panel.critical },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {buckets.map((b) => (
          <Card key={b.key} className={HEALTH_TONE[b.key]}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-medium">
                <b.icon className="h-4 w-4 shrink-0" aria-hidden />
                {HEALTH_LABEL[b.key]}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{b.value}</p>
              <p className="text-[11px] opacity-80">de {panel.kpis.length} indicadores</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
              Progresso médio das ações
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {panel.actionsAvgProgress === null ? "—" : `${panel.actionsAvgProgress}%`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {panel.actionsConcluded} de {panel.actionsTotal} concluídos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Repeat className="h-4 w-4 shrink-0" aria-hidden />
              Execuções concluídas
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {panel.routineAdherence === null ? "—" : `${panel.routineAdherence}%`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {panel.executionsCompleted} de {panel.executionsTotal} execuções · taxa de conclusão do
              conjunto exibido
            </p>
          </CardContent>
        </Card>
      </div>

      {panel.periodLabel ? (
        <p className="text-xs text-muted-foreground">
          Período das medições validadas: {panel.periodLabel}. Última competência validada:{" "}
          {panel.lastValidatedPeriodLabel}. Semáforo, gráficos e leitura usam somente medições
          validadas; medições pendentes são excluídas.
        </p>
      ) : null}

      {panel.pendingMeasurements > 0 ? (
        <p className="text-xs text-muted-foreground">
          {panel.pendingMeasurements} medições aguardando validação e não consideradas no semáforo.
        </p>
      ) : null}

      {trends.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {trends.map((k) => (
            <TrendChart key={k.id} kpi={k} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ainda não há histórico suficiente de medições validadas para exibir tendências.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {panel.kpis.map((k) => (
          <Badge key={k.id} variant="outline" className="font-normal">
            {k.name}: {fmtNumber(k.latestValue, k.unit)} · meta {fmtNumber(k.target, k.unit)} ·{" "}
            {HEALTH_LABEL[k.health]}
          </Badge>
        ))}
      </div>
    </div>
  );
}
