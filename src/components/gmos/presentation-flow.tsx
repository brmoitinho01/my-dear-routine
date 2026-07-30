// FASE F4 — fluxo de gestão: planejar → medir → agir → executar → governar.
// Cada etapa aponta para uma rota real já implementada.
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Gauge, ListChecks, ShieldCheck, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = {
  step: string;
  title: string;
  description: string;
  artifacts: string[];
  to: "/planejamento" | "/planos-de-acao" | "/rotinas" | "/acessos";
  cta: string;
  icon: typeof Target;
};

const STEPS: Step[] = [
  {
    step: "1",
    title: "Planejar",
    description: "Ciclos estratégicos, pilares, objetivos e riscos por empresa e filial.",
    artifacts: ["Objetivo", "Pilar", "Meta"],
    to: "/planejamento",
    cta: "Abrir planejamento",
    icon: Target,
  },
  {
    step: "2",
    title: "Medir",
    description:
      "KPIs com fórmula, unidade, direção, periodicidade, fonte e validação das medições.",
    artifacts: ["KPI", "Fórmula", "Competência", "Fonte"],
    to: "/planejamento",
    cta: "Ver KPIs e medições",
    icon: Gauge,
  },
  {
    step: "3",
    title: "Agir",
    description: "Planos de ação 5W2H com responsável, prazo, custo, progresso e KPI relacionado.",
    artifacts: ["Plano 5W2H", "Prazo", "Custo", "Progresso"],
    to: "/planos-de-acao",
    cta: "Abrir planos de ação",
    icon: ListChecks,
  },
  {
    step: "4",
    title: "Executar",
    description:
      "Rotinas recorrentes, execuções por período, evidências e ocorrências registradas.",
    artifacts: ["Rotina", "Evidência", "Status"],
    to: "/rotinas",
    cta: "Abrir rotinas",
    icon: CalendarClock,
  },
  {
    step: "5",
    title: "Governar",
    description:
      "Isolamento por RLS, permissões por escopo, auditoria das alterações e validação humana.",
    artifacts: ["RLS", "Permissões", "Auditoria", "Validação humana"],
    to: "/acessos",
    cta: "Ver acessos e escopos",
    icon: ShieldCheck,
  },
];

export function PresentationFlow() {
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((s) => (
        <li key={s.title}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold text-secondary-foreground">
                    {s.step}
                  </span>
                  <h3 className="truncate text-base font-semibold tracking-tight">{s.title}</h3>
                </div>
                <s.icon className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">{s.description}</p>
              <div className="flex flex-1 flex-wrap content-start gap-1.5">
                {s.artifacts.map((a) => (
                  <Badge key={a} variant="outline" className="font-normal">
                    {a}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary">Disponível nesta versão</Badge>
                <Link
                  to={s.to}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}
