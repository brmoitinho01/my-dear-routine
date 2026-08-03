// FASE F7 — experiência do colaborador: apenas o que está atribuído a ele.
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/gmos/page-header";
import { MyWorkPanel } from "@/components/gmos/my-work-panel";
import { RoleBadge, RouteGuard } from "@/components/gmos/authz-context";

export const Route = createFileRoute("/_authenticated/meu-trabalho")({
  head: () => ({
    meta: [
      { title: "Meu trabalho — GMOS" },
      {
        name: "description",
        content: "Rotinas e planos de ação atribuídos ao usuário autenticado no GMOS.",
      },
      { property: "og:title", content: "Meu trabalho — GMOS" },
      {
        property: "og:description",
        content: "Rotinas e planos de ação atribuídos ao usuário autenticado no GMOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MeuTrabalhoPage,
});

function MeuTrabalhoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Meu trabalho" }]}
        title="Meu trabalho"
        description="Somente rotinas e ações atribuídas ao seu nome, com prazos e registro de execução."
        actions={<RoleBadge />}
      />
      <RouteGuard permission="dashboard.personal" area="ver o painel pessoal">
        <MyWorkPanel />
      </RouteGuard>
    </div>
  );
}