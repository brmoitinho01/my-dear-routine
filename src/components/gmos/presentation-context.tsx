// FASE F5 — contexto e leitura executiva do cenário apresentado.
// Todo o conteúdo é derivado do workspace selecionado e do ExecutivePanel; nada é hardcoded.
import { Building2, CalendarRange, FlaskConical, Info, Network, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DEMO_DISCLAIMER, type ExecutivePanel } from "@/lib/gmos/demo";

type Ctx = { companyName: string; businessUnitName: string } | null;

function Item({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

export function PresentationContext({
  workspace,
  panel,
}: {
  workspace: Ctx;
  panel: ExecutivePanel | null;
}) {
  const isDemo = panel?.isDemo === true;
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Item icon={Network} label="Organização" value="Grupo Moitinho" />
          <Item
            icon={Building2}
            label="Empresa"
            value={workspace?.companyName ?? "Nenhuma selecionada"}
          />
          <Item
            icon={Building2}
            label="Filial"
            value={workspace?.businessUnitName ?? "Nenhuma selecionada"}
          />
          <Item
            icon={CalendarRange}
            label="Período das medições"
            value={panel?.periodLabel ?? "Sem medições registradas"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isDemo ? "outline" : "secondary"}>
            {isDemo ? (
              <FlaskConical className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            {isDemo ? "Cenário demonstrativo" : "Dados operacionais"}
          </Badge>
          {isDemo ? (
            <span className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {DEMO_DISCLAIMER}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Os números refletem exclusivamente os registros cadastrados nesta filial.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- leitura executiva ---------------- */

export function ExecutiveReading({ panel }: { panel: ExecutivePanel }) {
  const measured = panel.onTarget + panel.attention + panel.critical;
  const lines: string[] = [];

  if (panel.kpis.length === 0) {
    lines.push("Nenhum indicador cadastrado nesta filial.");
  } else {
    lines.push(
      `${panel.kpis.length} ${panel.kpis.length === 1 ? "indicador acompanhado" : "indicadores acompanhados"}: ` +
        `${panel.onTarget} no alvo, ${panel.attention} em atenção e ${panel.critical} ${panel.critical === 1 ? "crítico" : "críticos"}` +
        (measured < panel.kpis.length
          ? `; ${panel.kpis.length - measured} sem medição ou sem meta.`
          : "."),
    );
  }

  lines.push(
    panel.actionsTotal === 0
      ? "Nenhum plano de ação registrado nesta filial."
      : `${panel.actionsTotal} ${panel.actionsTotal === 1 ? "plano de ação registrado" : "planos de ação registrados"}, ` +
          `${panel.actionsConcluded} ${panel.actionsConcluded === 1 ? "concluído" : "concluídos"}` +
          (panel.actionsAvgProgress === null
            ? " (sem progresso informado)."
            : `, com progresso médio de ${panel.actionsAvgProgress}%.`),
  );

  lines.push(
    panel.executionsTotal === 0
      ? "Nenhuma execução de rotina registrada no conjunto exibido."
      : `${panel.executionsCompleted} de ${panel.executionsTotal} execuções concluídas` +
          (panel.routineAdherence === null
            ? "."
            : ` — taxa de conclusão de ${panel.routineAdherence}% no conjunto exibido.`),
  );

  lines.push(
    panel.periodLabel
      ? `Período analisado: ${panel.periodLabel}.`
      : "Ainda não há medições registradas para delimitar o período analisado.",
  );

  const conclusion =
    measured === 0
      ? "Sem indicadores medidos, não há conclusão a apresentar."
      : panel.critical > 0
        ? "Há indicadores críticos que exigem priorização."
        : panel.attention > 0
          ? "Há indicadores em atenção."
          : "Indicadores medidos dentro do alvo.";

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l} className="flex gap-2 text-sm">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent"
                aria-hidden
              />
              <span className="min-w-0">{l}</span>
            </li>
          ))}
        </ul>
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm font-medium">
          {conclusion}
        </p>
        <p className="text-xs text-muted-foreground">
          Leitura automática do cenário; decisão e validação permanecem humanas.
        </p>
      </CardContent>
    </Card>
  );
}
