import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_LABEL, NC_STATUS_LABEL, formatDate } from "@/lib/labels";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/nao-conformidades")({
  head: () => ({ meta: [{ title: "Não conformidades — Meu Querido" }] }),
  component: NCList,
});

const SEV_COLOR: Record<string, string> = {
  baixa: "bg-muted text-foreground",
  media: "bg-[color:var(--warning)] text-[color:var(--warning-foreground)]",
  alta: "bg-orange-500 text-white",
  critica: "bg-destructive text-destructive-foreground",
};

function NCList() {
  const [status, setStatus] = useState<string>("aberta");
  const { data, isLoading } = useQuery({
    queryKey: ["ncs", status],
    queryFn: async () => {
      let q = supabase
        .from("non_conformities")
        .select("id, title, severity, status, due_date, created_at, sectors(name)")
        .order("created_at", { ascending: false });
      if (status !== "todas") q = q.eq("status", status as "aberta");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Não conformidades</h1>
          <p className="text-sm text-muted-foreground">Acompanhe, trate e encerre.</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="em_tratamento">Em tratamento</SelectItem>
            <SelectItem value="resolvida">Resolvidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma NC encontrada.</CardContent></Card>
      )}

      <div className="grid gap-2">
        {(data ?? []).map((nc) => (
          <Link key={nc.id} to="/nao-conformidades/$id" params={{ id: nc.id }}>
            <Card className="hover:bg-accent transition">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 flex-wrap mb-1">
                    <Badge className={SEV_COLOR[nc.severity]}>{SEVERITY_LABEL[nc.severity as keyof typeof SEVERITY_LABEL]}</Badge>
                    <Badge variant="outline">{NC_STATUS_LABEL[nc.status as keyof typeof NC_STATUS_LABEL]}</Badge>
                    {(nc.sectors as { name: string } | null)?.name && <Badge variant="secondary">{(nc.sectors as { name: string }).name}</Badge>}
                  </div>
                  <p className="text-sm font-medium truncate">{nc.title}</p>
                  <p className="text-xs text-muted-foreground">Prazo: {formatDate(nc.due_date)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}