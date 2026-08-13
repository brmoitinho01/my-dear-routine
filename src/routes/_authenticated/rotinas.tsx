// Rota antiga preservada (fora do menu): reutiliza o mesmo painel do módulo Plano de Ação.
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/gmos/page-header";
import { RequirePermission } from "@/components/gmos/permission-gate";
import { RoutinesPanel } from "@/components/gmos/routines-panel";

export const Route = createFileRoute("/_authenticated/rotinas")({
  head: () => ({
    meta: [
      { title: "Rotinas e rituais — GMOS Grupo Moitinho" },
      {
        name: "description",
        content: "Modelos de rotina e execuções da filial selecionada, com evidência e observação.",
      },
      { property: "og:title", content: "Rotinas e rituais — GMOS Grupo Moitinho" },
      {
        property: "og:description",
        content: "Modelos de rotina e execuções da filial selecionada, com evidência e observação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="routine.read" area="visualizar rotinas">
      <div className="space-y-6">
        <PageHeader title="Rotinas e rituais" description="Rotinas da filial selecionada." />
        <RoutinesPanel />
      </div>
    </RequirePermission>
  ),
});
