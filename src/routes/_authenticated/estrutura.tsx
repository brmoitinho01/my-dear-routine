import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Network, Layers, Compass } from "lucide-react";
import { fetchStructure } from "@/lib/gmos/structure";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { PageHeader } from "@/components/gmos/page-header";
import { OFFICIAL_COMPANIES, matchOfficialCompany } from "@/lib/gmos/method";

export const Route = createFileRoute("/_authenticated/estrutura")({
  head: () => ({
    meta: [
      { title: "Estrutura organizacional — GMOS" },
      {
        name: "description",
        content:
          "Árvore organizacional do Grupo Moitinho: empresas, unidades de negócio e departamentos.",
      },
      { property: "og:title", content: "Estrutura organizacional — GMOS" },
      {
        property: "og:description",
        content:
          "Árvore organizacional do Grupo Moitinho: empresas, unidades de negócio e departamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EstruturaPage,
});

function EstruturaPage() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["gmos", "structure"],
    queryFn: fetchStructure,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Estrutura" }]}
        title="Estrutura organizacional"
        description="Hierarquia Grupo › Empresas › Unidades › Departamentos, com dados reais da base."
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/organograma">Abrir organograma funcional</Link>
        </Button>
      </div>

      {isPending ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}

      {data ? (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">
                {data.organization?.name ?? "Grupo Moitinho"}
              </span>
              <Badge variant="secondary" className="ml-auto">
                Organização
              </Badge>
            </div>

            {data.companies.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed p-5">
                <p className="text-sm font-medium">Nenhuma empresa cadastrada</p>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                  A estrutura organizacional já está criada no banco, porém ainda não há empresas,
                  unidades ou departamentos registrados. O cadastro será liberado em uma fase
                  posterior, após a definição das regras de governança e aprovação.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3 border-l pl-4">
                {data.companies.map((company) => (
                  <li key={company.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{company.name}</span>
                      <StatusBadge status={company.status} />
                    </div>
                    {company.businessUnits.length === 0 ? (
                      <p className="ml-6 mt-1 text-xs text-muted-foreground">
                        Sem unidades cadastradas.
                      </p>
                    ) : (
                      <ul className="ml-6 mt-2 space-y-2 border-l pl-4">
                        {company.businessUnits.map((unit) => (
                          <li key={unit.id}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{unit.name}</span>
                              <StatusBadge status={unit.status} />
                            </div>
                            {unit.departments.length > 0 ? (
                              <ul className="ml-6 mt-1 space-y-1 border-l pl-4">
                                {unit.departments.map((dept) => (
                                  <li
                                    key={dept.id}
                                    className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                                  >
                                    {dept.name}
                                    <StatusBadge status={dept.status} />
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <StateCard
          title="Somente leitura nesta fase"
          description="A Fase 1 entrega apenas a visualização da estrutura. Criação e edição de empresas, unidades e departamentos não estão habilitadas no aplicativo."
        />
      ) : null}

      {data ? <OfficialStructure registeredNames={data.companies.map((c) => c.name)} /> : null}
    </div>
  );
}

function OfficialStructure({ registeredNames }: { registeredNames: string[] }) {
  return (
    <section aria-labelledby="estrutura-oficial" className="space-y-3">
      <h2
        id="estrutura-oficial"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Estrutura oficial do Grupo
      </h2>
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Compass className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
            Comparação somente leitura entre a estrutura oficial definida no Método GMOS e as
            empresas visíveis no cadastro atual. Nenhum registro é criado ou alterado aqui.
          </p>
          <ul className="space-y-2">
            {OFFICIAL_COMPANIES.map((c) => {
              const registered = matchOfficialCompany(c, registeredNames);
              return (
                <li
                  key={c.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.purpose}</p>
                  </div>
                  <Badge variant={registered ? "secondary" : "outline"}>
                    {registered ? "Cadastrada" : "Pendente de cadastro"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  archived: "Arquivado",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "active" ? "secondary" : "outline"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
