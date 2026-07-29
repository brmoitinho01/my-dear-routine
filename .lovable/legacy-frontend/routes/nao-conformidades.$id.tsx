import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { SEVERITY_LABEL, NC_STATUS_LABEL, ACTION_STATUS_LABEL, formatDate } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/nao-conformidades/$id")({
  head: () => ({ meta: [{ title: "NC — Meu Querido" }] }),
  component: NCDetail,
});

function NCDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [ap, setAp] = useState({ what: "", why: "", how: "", when_due: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["nc", id],
    queryFn: async () => {
      const { data: nc, error } = await supabase
        .from("non_conformities")
        .select("*, sectors(name), checklist_items(question)")
        .eq("id", id).single();
      if (error) throw error;
      const { data: plans } = await supabase
        .from("action_plans")
        .select("*")
        .eq("non_conformity_id", id)
        .order("created_at", { ascending: true });
      return { nc, plans: plans ?? [] };
    },
  });

  async function updateStatus(status: string) {
    const { error } = await supabase.from("non_conformities").update({ status: status as "aberta" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado.");
    qc.invalidateQueries({ queryKey: ["nc", id] });
    qc.invalidateQueries({ queryKey: ["ncs"] });
  }

  async function createActionPlan() {
    if (!ap.what.trim()) return toast.error("Descreva a ação (O quê).");
    const { error } = await supabase.from("action_plans").insert({
      non_conformity_id: id,
      what: ap.what, why: ap.why || null, how: ap.how || null,
      when_due: ap.when_due || null,
      who: user!.id,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Plano de ação criado.");
    setAp({ what: "", why: "", how: "", when_due: "" });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ["nc", id] });
  }

  async function completePlan(planId: string) {
    const { error } = await supabase.from("action_plans")
      .update({ status: "concluida", completed_at: new Date().toISOString() })
      .eq("id", planId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["nc", id] });
  }

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const nc = data.nc as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/nao-conformidades"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <h1 className="text-lg font-semibold flex-1 min-w-0 truncate">{nc.title}</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge>{SEVERITY_LABEL[nc.severity as keyof typeof SEVERITY_LABEL]}</Badge>
            <Badge variant="outline">{NC_STATUS_LABEL[nc.status as keyof typeof NC_STATUS_LABEL]}</Badge>
            {nc.sectors?.name && <Badge variant="secondary">{nc.sectors.name}</Badge>}
          </div>
          {nc.description && <p className="text-sm">{nc.description}</p>}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Prazo: {formatDate(nc.due_date)}</div>
            <div>Criada: {formatDate(nc.created_at)}</div>
          </div>
          {nc.evidence_urls?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {nc.evidence_urls.map((u: string) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="aspect-square rounded-md overflow-hidden border bg-muted">
                  <img src={u} alt="evidência" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Select value={nc.status} onValueChange={updateStatus}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(NC_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Planos de ação</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <div><Label className="text-xs">O quê</Label>
                <Input value={ap.what} onChange={(e) => setAp({ ...ap, what: e.target.value })} /></div>
              <div><Label className="text-xs">Por quê</Label>
                <Textarea rows={2} value={ap.why} onChange={(e) => setAp({ ...ap, why: e.target.value })} /></div>
              <div><Label className="text-xs">Como</Label>
                <Textarea rows={2} value={ap.how} onChange={(e) => setAp({ ...ap, how: e.target.value })} /></div>
              <div><Label className="text-xs">Quando</Label>
                <Input type="date" value={ap.when_due} onChange={(e) => setAp({ ...ap, when_due: e.target.value })} /></div>
              <Button size="sm" onClick={createActionPlan}>Salvar plano</Button>
            </div>
          )}
          {data.plans.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum plano ainda.</p>
          )}
          {data.plans.map((p: any) => (
            <div key={p.id} className="border rounded-md p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{ACTION_STATUS_LABEL[p.status as keyof typeof ACTION_STATUS_LABEL]}</Badge>
                {p.status !== "concluida" && (
                  <Button size="sm" variant="ghost" onClick={() => completePlan(p.id)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />Concluir
                  </Button>
                )}
              </div>
              <p className="text-sm font-medium">{p.what}</p>
              {p.why && <p className="text-xs text-muted-foreground">Por quê: {p.why}</p>}
              {p.how && <p className="text-xs text-muted-foreground">Como: {p.how}</p>}
              {p.when_due && <p className="text-xs text-muted-foreground">Prazo: {formatDate(p.when_due)}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}