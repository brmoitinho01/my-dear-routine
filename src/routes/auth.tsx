import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Gauge, Layers, ListChecks, ShieldCheck, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GmosBrand } from "@/components/gmos/gmos-brand";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — GMOS · Grupo Moitinho" },
      {
        name: "description",
        content:
          "Acesso restrito ao GMOS, sistema operacional de gestão do Grupo Moitinho. Contas são provisionadas por convite interno.",
      },
      { property: "og:title", content: "Entrar — GMOS · Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Acesso restrito ao GMOS, sistema operacional de gestão do Grupo Moitinho. Contas são provisionadas por convite interno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const BENEFITS = [
  {
    icon: Compass,
    title: "Método em cinco etapas",
    description: "Direcionar, diagnosticar, planejar, executar, controlar e aprender.",
  },
  {
    icon: Target,
    title: "Núcleo universal de gestão",
    description: "Ciclo, objetivos, indicadores, metas e ações em qualquer empresa.",
  },
  {
    icon: Layers,
    title: "Modular e evolutivo",
    description: "Módulos setoriais por empresa e evolução por maturidade.",
  },
  {
    icon: ListChecks,
    title: "Execução com evidência",
    description: "Planos de ação, rotinas e indicadores com origem declarada.",
  },
];

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/apresentacao" });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/apresentacao" });
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.1fr_minmax(0,28rem)]">
      <section className="flex flex-col justify-center bg-sidebar px-6 py-10 text-sidebar-foreground sm:px-10 lg:px-14">
        <GmosBrand tone="inverted" size="lg" subtitle="Grupo Moitinho" />
        <h1 className="mt-7 max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
          Plataforma de governança modular do Grupo Moitinho
        </h1>
        <p className="mt-3 max-w-lg text-sm text-sidebar-foreground/80 sm:text-base">
          Um único núcleo de planejamento e gestão para todas as empresas, com módulos ativados
          conforme a maturidade de cada operação.
        </p>
        <ul className="mt-8 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex gap-3">
              <b.icon className="mt-0.5 h-5 w-5 shrink-0 text-sidebar-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{b.title}</span>
                <span className="block text-xs text-sidebar-foreground/70">{b.description}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-center gap-2 text-xs text-sidebar-foreground/70">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sidebar-primary" aria-hidden />
          Acesso restrito, permissões por escopo e registro de auditoria.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>Acessar o GMOS</CardTitle>
              <CardDescription>
                Ambiente corporativo restrito. O cadastro público está desativado — as contas são
                provisionadas por convite interno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail corporativo</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Uso interno do Grupo Moitinho. Em caso de dúvida, procure o administrador do sistema.
          </p>
        </div>
      </section>
    </div>
  );
}
