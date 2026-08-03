// FASE F6 — página do Método GMOS. Conteúdo metodológico, sem dados operacionais.
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Compass,
  Layers,
  Network,
  Presentation,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gmos/page-header";
import {
  CORE_CHAIN,
  CORE_DOMAINS,
  MATURITY_STAGES,
  METHOD_STAGES,
  OFFICIAL_COMPANIES,
  ORG_LEVELS,
  PILLARS,
  STATE_LABEL,
} from "@/lib/gmos/method";

const TITLE = "Método GMOS — plataforma universal de planejamento e gestão";
const DESC =
  "Método GMOS em cinco etapas, cadeia central de gestão, níveis organizacionais, maturidade, doze domínios centrais e módulos setoriais por empresa.";

export const Route = createFileRoute("/_authenticated/metodo")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetodoPage,
});

const STATE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  available: "default",
  partial: "secondary",
  planned: "outline",
};

function MetodoPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Método GMOS" }]}
        title="Método GMOS"
        description="Modelo universal, modular e evolutivo de planejamento e gestão do Grupo Moitinho."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/apresentacao">
              <Presentation className="mr-2 h-4 w-4" aria-hidden />
              Apresentação
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="pilares" className="space-y-3">
        <h2 id="pilares" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Visão resumida
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <Card key={p.title}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
                  <h3 className="text-base font-semibold tracking-tight">{p.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="etapas" className="space-y-3">
        <h2 id="etapas" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          As cinco etapas
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {METHOD_STAGES.map((s) => (
            <li key={s.key}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2 p-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold text-secondary-foreground">
                        {s.order}
                      </span>
                      <h3 className="truncate text-base font-semibold tracking-tight">{s.title}</h3>
                    </div>
                    <Compass className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
                  </div>
                  <p className="text-sm text-muted-foreground">{s.purpose}</p>
                  <p className="text-xs italic text-muted-foreground">{s.question}</p>
                  <div className="mt-auto pt-1">
                    <Badge variant={STATE_VARIANT[s.state]}>{STATE_LABEL[s.state]}</Badge>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Estado honesto desta versão: Planejar e Executar já possuem funcionalidades, e Controlar
          está parcialmente disponível pelo acompanhamento de indicadores, medições validadas e
          execuções. Direcionar, Diagnosticar, reuniões e decisões, orçamento e configuração de
          maturidade serão implementados nas próximas fases.
        </p>
      </section>

      <section aria-labelledby="cadeia" className="space-y-3">
        <h2 id="cadeia" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cadeia central de gestão
        </h2>
        <Card>
          <CardContent className="p-5">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {CORE_CHAIN.map((item, i) => (
                <li key={item} className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {item}
                  </Badge>
                  {i < CORE_CHAIN.length - 1 ? (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">
              Toda empresa segue a mesma cadeia, independentemente do setor. O que muda são as
              categorias e os módulos, nunca o núcleo.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="niveis" className="space-y-3">
          <h2 id="niveis" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quatro níveis organizacionais
          </h2>
          <ol className="space-y-2">
            {ORG_LEVELS.map((l) => (
              <li key={l.title}>
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold text-secondary-foreground">
                      {l.order}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{l.title}</p>
                      <p className="text-xs text-muted-foreground">{l.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="maturidade" className="space-y-3">
          <h2
            id="maturidade"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Quatro estágios de maturidade
          </h2>
          <ol className="space-y-2">
            {MATURITY_STAGES.map((m) => (
              <li key={m.key}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Layers className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
                      <p className="text-sm font-semibold">{m.title}</p>
                      <Badge variant="outline" className="ml-auto font-normal">
                        Etapa {m.order}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.unlocks.map((u) => (
                        <Badge key={u} variant="secondary" className="font-normal">
                          {u}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            A configuração de maturidade e a ativação de recursos avançados por empresa serão
            persistidas em fase posterior.
          </p>
        </section>
      </div>

      <section aria-labelledby="dominios" className="space-y-3">
        <h2 id="dominios" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Doze domínios centrais
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_DOMAINS.map((d) => (
            <Card key={d.order}>
              <CardContent className="flex items-start gap-3 p-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold tabular-nums text-secondary-foreground">
                  {d.order}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="empresas" className="space-y-3">
        <h2 id="empresas" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Empresas do Grupo e módulos setoriais
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICIAL_COMPANIES.map((c) => (
            <Card key={c.key} className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
                  <CardTitle className="text-base">{c.name}</CardTitle>
                </div>
                <CardDescription className="text-xs">{c.role}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{c.purpose}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.modules.map((m) => (
                    <Badge key={m} variant="outline" className="font-normal">
                      {m}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="atalhos" className="space-y-3">
        <h2 id="atalhos" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          O que já é possível fazer agora
        </h2>
        <Card>
          <CardContent className="flex flex-wrap gap-3 p-5">
            {[
              { to: "/planejamento", label: "Planejamento, objetivos e KPIs" },
              { to: "/planos-de-acao", label: "Planos de ação 5W2H" },
              { to: "/rotinas", label: "Rotinas e execuções" },
              { to: "/apresentacao", label: "Apresentação executiva" },
              { to: "/estrutura", label: "Estrutura organizacional" },
              { to: "/acessos", label: "Acessos e escopos" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {l.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ))}
          </CardContent>
        </Card>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
          Ativar módulos ou etapas do método não concede privilégios: leitura e escrita continuam
          sob permissões por escopo.
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
          Modelo preparado para uso interno do Grupo e futura replicação em consultoria.
        </p>
      </section>
    </div>
  );
}
