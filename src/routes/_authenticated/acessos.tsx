import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { fetchMyAccess, scopeTypeLabel } from "@/lib/gmos/structure";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { PageHeader } from "@/components/gmos/page-header";

export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Meus acessos — GMOS" },
      {
        name: "description",
        content:
          "Papéis, escopos e vigências atribuídos ao usuário autenticado no GMOS.",
      },
      { property: "og:title", content: "Meus acessos — GMOS" },
      {
        property: "og:description",
        content:
          "Papéis, escopos e vigências atribuídos ao usuário autenticado no GMOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcessosPage,
});

const USER_STATUS: Record<string, string> = {
  invited: "Convidado",
  active: "Ativo",
  suspended: "Suspenso",
  disabled: "Desativado",
};

const ASSIGNMENT_STATUS: Record<string, string> = {
  pending: "Pendente",
  active: "Ativa",
  revoked: "Revogada",
  expired: "Expirada",
};

function formatDate(value: string | null) {
  if (!value) return "sem término";
  return new Date(value).toLocaleDateString("pt-BR");
}

function AcessosPage() {
  const { user } = useAuth();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["gmos", "my-access"],
    queryFn: fetchMyAccess,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Acessos" }]}
        title="Acessos"
        description="Informações do seu próprio acesso. Dados de outros usuários não são exibidos."
      />

      {isPending ? <LoadingBlock rows={2} /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}

      {data ? (
        <>
          <Card>
            <CardContent className="divide-y p-0">
              <Row label="Usuário autenticado" value={user?.email ?? "—"} />
              <Row
                label="Organização"
                value={data.organizationName ?? "Não vinculada"}
              />
              <Row
                label="Situação do cadastro"
                value={data.status ? (USER_STATUS[data.status] ?? data.status) : "—"}
              />
              <Row label="Idioma preferido" value={data.preferredLocale ?? "—"} />
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Papéis e escopos</h2>
            {data.assignments.length === 0 ? (
              <StateCard
                title="Nenhum papel atribuído"
                description="Seu usuário ainda não possui papéis ativos. Solicite atribuição ao administrador do Grupo."
              />
            ) : (
              data.assignments.map((a) => (
                <Card key={a.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{a.roleName}</span>
                      <Badge variant="outline">{a.roleCode}</Badge>
                      <Badge
                        variant={a.status === "active" ? "secondary" : "outline"}
                        className="ml-auto"
                      >
                        {ASSIGNMENT_STATUS[a.status] ?? a.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Escopo: {scopeTypeLabel(a.scopeType)} — {a.scopeLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vigência: {formatDate(a.effectiveFrom)} até{" "}
                      {formatDate(a.effectiveTo)}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-all text-sm font-medium">{value}</span>
    </div>
  );
}