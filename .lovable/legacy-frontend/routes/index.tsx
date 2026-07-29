import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, SECTOR_LABEL } from "@/lib/auth-context";
import { MOMENT_LABEL, todayISO } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PlayCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Hoje — Meu Querido" }] }),
  component: HomePage,
});

type ChecklistRow = {
  id: string;
  title: string;
  moment: "abertura" | "fechamento";
  sector_id: string;
  active: boolean;
  sectors: { name: string; kind: "salao" | "cozinha" | "bar" } | null;
};

type ExecRow = {
  id: string;
  checklist_id: string;
  status: "em_andamento" | "finalizada";
  scheduled_date: string;
};

function HomePage() {
  const { user, profile, sectors, isManager } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();

  const sectorIds = isManager
    ? sectors.map((s) => s.id)
    : (profile?.primary_sector_id ? [profile.primary_sector_id] : []);

  const { data, isLoading } = useQuery({
    queryKey: ["today-checklists", today, sectorIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("checklists")
        .select("id, title, moment, sector_id, active, sectors(name, kind)")
        .eq("active", true);
      if (!isManager && sectorIds.length) q = q.in("sector_id", sectorIds);
      const { data: lists, error } = await q;
      if (error) throw error;
      const ids = (lists ?? []).map((l) => l.id);
      let execs: ExecRow[] = [];
      if (ids.length) {
        const { data: e } = await supabase
          .from("checklist_executions")
          .select("id, checklist_id, status, scheduled_date")
          .in("checklist_id", ids)
          .eq("scheduled_date", today);
        execs = (e ?? []) as ExecRow[];
      }
      return { lists: (lists ?? []) as unknown as ChecklistRow[], execs };
    },
    enabled: !!user,
  });

  async function openExecution(checklist: ChecklistRow) {
    const existing = data?.execs.find((e) => e.checklist_id === checklist.id);
    if (existing) { navigate({ to: "/checklist/$executionId", params: { executionId: existing.id } }); return; }
    const { data: created, error } = await supabase
      .from("checklist_executions")
      .insert({
        checklist_id: checklist.id,
        sector_id: checklist.sector_id,
        executed_by: user!.id,
        scheduled_date: today,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["today-checklists"] });
    navigate({ to: "/checklist/$executionId", params: { executionId: created.id } });
  }

  const grouped = (data?.lists ?? []).reduce<Record<string, ChecklistRow[]>>((acc, c) => {
    const k = c.sectors?.kind ?? "salao";
    (acc[k] = acc[k] ?? []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Checklists de hoje</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && data && data.lists.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum checklist disponível para você hoje.
          {!isManager && !profile?.primary_sector_id && (
            <div className="mt-2 text-xs">Peça ao Admin para vincular seu setor principal.</div>
          )}
        </CardContent></Card>
      )}

      {Object.entries(grouped).map(([kind, items]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {SECTOR_LABEL[kind as keyof typeof SECTOR_LABEL]}
          </h2>
          <div className="grid gap-2">
            {items.sort((a, b) => a.moment.localeCompare(b.moment)).map((c) => {
              const exec = data?.execs.find((e) => e.checklist_id === c.id);
              const done = exec?.status === "finalizada";
              const inProg = exec?.status === "em_andamento";
              return (
                <Card key={c.id} className="overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={c.moment === "abertura" ? "secondary" : "outline"}>
                          {MOMENT_LABEL[c.moment]}
                        </Badge>
                        {done && <Badge className="bg-[color:var(--success)] text-[color:var(--success-foreground)]"><CheckCircle2 className="h-3 w-3 mr-1" />Finalizado</Badge>}
                        {inProg && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Em andamento</Badge>}
                      </div>
                      <div className="mt-1 font-medium truncate">{c.title}</div>
                    </div>
                    <Button size="sm" onClick={() => openExecution(c)} variant={done ? "outline" : "default"}>
                      <PlayCircle className="h-4 w-4 mr-1" />
                      {done ? "Ver" : inProg ? "Continuar" : "Iniciar"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}