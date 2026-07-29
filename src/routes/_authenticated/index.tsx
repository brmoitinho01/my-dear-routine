// FASE M0 — tela temporaria de Fundacao.
// Nao consulta nenhuma tabela de dominio; apenas a sessao autenticada.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Layers, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "GMOS — Fundação em implantação" },
      {
        name: "description",
        content:
          "Ambiente corporativo do Grupo Moitinho Operating System em preparação da Fundação técnica.",
      },
      { property: "og:title", content: "GMOS — Fundação em implantação" },
      {
        property: "og:description",
        content:
          "Ambiente corporativo do Grupo Moitinho Operating System em preparação da Fundação técnica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FoundationPage,
});

function FoundationPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              GM
            </div>
            <span className="truncate text-sm font-semibold">GMOS</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <Badge variant="secondary" className="mb-4">
          Preparação da Fundação
        </Badge>

        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          GMOS — Grupo Moitinho Operating System
        </h1>
        <p className="mt-1 text-base text-muted-foreground sm:text-lg">
          Fundação em implantação
        </p>

        <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted-foreground">
          O ambiente corporativo do GMOS está sendo preparado. Os módulos de
          estratégia, planos de ação e rotinas serão disponibilizados
          progressivamente.
        </p>

        <Card className="mt-8">
          <CardContent className="divide-y p-0">
            <Row label="Usuário autenticado" value={user?.email ?? "—"} />
            <Row label="Estado do ambiente" value="Preparação da Fundação" />
            <Row
              label="Etapa atual"
              value="M0 — Fundação técnica, RBAC e auditoria"
              icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            />
            <Row
              label="Próxima etapa"
              value="M1 — Estrutura organizacional"
              icon={<Layers className="h-4 w-4 text-muted-foreground" />}
            />
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          <span>
            Nenhum módulo operacional está ativo nesta etapa. Nenhuma consulta ao
            domínio legado é realizada.
          </span>
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2 break-all text-sm font-medium">
        {icon}
        {value}
      </span>
    </div>
  );
}