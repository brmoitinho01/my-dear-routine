import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — GMOS" },
      {
        name: "description",
        content:
          "Acesso restrito ao Grupo Moitinho Operating System. Contas são criadas por convite interno.",
      },
      { property: "og:title", content: "Entrar — GMOS" },
      {
        property: "og:description",
        content:
          "Acesso restrito ao Grupo Moitinho Operating System. Contas são criadas por convite interno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">GMOS</h1>
          <p className="text-sm text-muted-foreground">Grupo Moitinho Operating System</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acessar</CardTitle>
            <CardDescription>
              Ambiente corporativo restrito. O cadastro público está desativado — as
              contas são provisionadas por convite interno.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Uso interno. <Link to="/" className="underline">Voltar</Link>
        </p>
      </div>
    </div>
  );
}