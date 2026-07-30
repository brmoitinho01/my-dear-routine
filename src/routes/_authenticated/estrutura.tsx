import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Network, Layers } from "lucide-react";
import { fetchStructure } from "@/lib/gmos/structure";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";

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
      <header>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Estrutura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hierarquia Grupo &gt; Empresas &gt; Unidades &gt; Departamentos, com dados reais
          da base.
        </p>
      </header>

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
                  A estrutura organizacional já está criada no banco, porém ainda não há
                  empresas, unidades ou departamentos registrados. O cadastro será
                  liberado em uma fase posterior, após a definição das regras de
                  governança e aprovação.
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
    </div>
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