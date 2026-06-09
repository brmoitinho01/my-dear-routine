import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ACTION_STATUS_LABEL, formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/planos-acao")({
  head: () => ({ meta: [{ title: "Planos de ação — Meu Querido" }] }),
  component: Plans,
});

function Plans() {
  const { data, isLoading } = useQuery({
    queryKey: ["action_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("id, what, status, when_due, non_conformity_id, non_conformities(title)")
        .order("when_due", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Planos de ação</h1>
        <p className="text-sm text-muted-foreground">Ações vinculadas às não conformidades.</p>
      </header>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum plano cadastrado.</CardContent></Card>
      )}
      <div className="grid gap-2">
        {(data ?? []).map((p) => (
          <Link key={p.id} to="/nao-conformidades/$id" params={{ id: p.non_conformity_id }}>
            <Card className="hover:bg-accent transition">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ACTION_STATUS_LABEL[p.status as keyof typeof ACTION_STATUS_LABEL]}</Badge>
                  {p.when_due && <span className="text-xs text-muted-foreground">Prazo: {formatDate(p.when_due)}</span>}
                </div>
                <p className="text-sm font-medium">{p.what}</p>
                {(p.non_conformities as { title: string } | null)?.title && (
                  <p className="text-xs text-muted-foreground">NC: {(p.non_conformities as { title: string }).title}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}