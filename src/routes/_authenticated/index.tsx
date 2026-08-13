// Visão Geral — home executiva enxuta: foco no painel consolidado de KPIs.
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { PageHeader } from "@/components/gmos/page-header";
import { StateCard } from "@/components/gmos/states";
import { ExecutiveKpiDashboard } from "@/components/gmos/executive-kpi-dashboard";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Visão Geral — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content: "Acompanhamento executivo dos indicadores das empresas.",
      },
      { property: "og:title", content: "Visão Geral — GMOS · Grupo Moitinho" },
      {
        property: "og:description",
        content: "Acompanhamento executivo dos indicadores das empresas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { can } = useAuth();
  const { workspace } = useWorkspace();
  const canGroup = can("dashboard.group");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral"
        description="Acompanhamento executivo dos indicadores das empresas."
        context={
          workspace
            ? `Contexto atual: ${workspace.companyName} › ${workspace.businessUnitName}`
            : null
        }
      />

      {canGroup ? (
        <ExecutiveKpiDashboard />
      ) : (
        <StateCard
          title="Sem acesso ao painel consolidado"
          description="Seu perfil não possui permissão para acompanhar os indicadores consolidados das empresas."
        />
      )}
    </div>
  );
}
