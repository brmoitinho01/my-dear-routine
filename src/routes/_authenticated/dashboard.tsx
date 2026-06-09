import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayISO, SEVERITY_LABEL } from "@/lib/labels";
import { AlertTriangle, CheckCircle2, ClipboardList, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Meu Querido" }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = todayISO();
  const { data } = useQuery({
    queryKey: ["dashboard", today],
    queryFn: async () => {
      const [{ data: execs }, { data: ncs }, { data: lists }] = await Promise.all([
        supabase.from("checklist_executions").select("status").eq("scheduled_date", today),
        supabase.from("non_conformities").select("severity, status, sector_id, sectors(name, kind)"),
        supabase.from("checklists").select("id").eq("active", true),
      ]);
      const totalChecklists = lists?.length ?? 0;
      const todayDone = (execs ?? []).filter((e) => e.status === "finalizada").length;
      const todayInProg = (execs ?? []).filter((e) => e.status === "em_andamento").length;
      const completion = totalChecklists ? Math.round((todayDone / totalChecklists) * 100) : 0;
      const open = (ncs ?? []).filter((n) => n.status === "aberta" || n.status === "em_tratamento");
      const bySev = open.reduce<Record<string, number>>((a, n) => { a[n.severity] = (a[n.severity] ?? 0) + 1; return a; }, {});
      const bySector = open.reduce<Record<string, number>>((a, n) => {
        const name = (n.sectors as { name: string } | null)?.name ?? "—";
        a[name] = (a[name] ?? 0) + 1; return a;
      }, {});
      return { todayDone, todayInProg, completion, totalChecklists, openCount: open.length, bySev, bySector };
    },
  });

  const d = data ?? { todayDone: 0, todayInProg: 0, completion: 0, totalChecklists: 0, openCount: 0, bySev: {}, bySector: {} };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="text-sm text-muted-foreground">Visão operacional do dia.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<ClipboardList className="h-4 w-4" />} label="Checklists ativos" value={d.totalChecklists} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" />} label="Concluídos hoje" value={d.todayDone} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Em andamento" value={d.todayInProg} />
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="NCs abertas" value={d.openCount} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Conclusão de hoje</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold">{d.completion}%</span>
            <span className="text-xs text-muted-foreground pb-1">{d.todayDone}/{d.totalChecklists}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${d.completion}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">NCs abertas por severidade</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(SEVERITY_LABEL).map((k) => (
            <Row key={k} label={SEVERITY_LABEL[k as keyof typeof SEVERITY_LABEL]} value={d.bySev[k] ?? 0} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">NCs abertas por setor</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(d.bySector).length === 0 && <p className="text-sm text-muted-foreground">Sem NCs abertas.</p>}
          {Object.entries(d.bySector).map(([name, v]) => <Row key={name} label={name} value={v} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}
function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}