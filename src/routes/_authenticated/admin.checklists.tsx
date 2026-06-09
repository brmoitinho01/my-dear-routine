import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MOMENT_LABEL } from "@/lib/labels";
import { useAuth } from "@/lib/auth-context";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/checklists")({
  head: () => ({ meta: [{ title: "Admin · Checklists — Meu Querido" }] }),
  component: AdminChecklists,
});

function AdminChecklists() {
  const { isManager, sectors } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [newList, setNewList] = useState({ sector_id: "", moment: "abertura", title: "" });
  const [newItem, setNewItem] = useState<Record<string, { question: string; is_critical: boolean; requires_photo: boolean }>>({});

  const { data } = useQuery({
    queryKey: ["admin-checklists"],
    queryFn: async () => {
      const { data: lists } = await supabase
        .from("checklists")
        .select("id, title, moment, sector_id, active, sectors(name), checklist_items(id, position, question, is_critical, requires_photo)")
        .order("title");
      return lists ?? [];
    },
  });

  if (!isManager) return <p className="text-sm text-muted-foreground">Acesso restrito.</p>;

  async function createChecklist() {
    if (!newList.sector_id || !newList.title.trim()) return toast.error("Setor e título obrigatórios.");
    const { error } = await supabase.from("checklists").insert({
      sector_id: newList.sector_id,
      moment: newList.moment as "abertura",
      title: newList.title,
    });
    if (error) return toast.error(error.message);
    setNewList({ sector_id: "", moment: "abertura", title: "" });
    qc.invalidateQueries({ queryKey: ["admin-checklists"] });
  }

  async function addItem(checklistId: string, currentCount: number) {
    const v = newItem[checklistId];
    if (!v?.question?.trim()) return toast.error("Pergunta obrigatória.");
    const { error } = await supabase.from("checklist_items").insert({
      checklist_id: checklistId, position: currentCount + 1,
      question: v.question, is_critical: v.is_critical, requires_photo: v.requires_photo,
    });
    if (error) return toast.error(error.message);
    setNewItem((p) => ({ ...p, [checklistId]: { question: "", is_critical: false, requires_photo: false } }));
    qc.invalidateQueries({ queryKey: ["admin-checklists"] });
  }

  async function deleteItem(id: string) {
    if (!confirm("Excluir este item?")) return;
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-checklists"] });
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from("checklists").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-checklists"] });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Checklists</h1>
        <p className="text-sm text-muted-foreground">Gerencie templates e itens.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Novo checklist</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          <Select value={newList.sector_id} onValueChange={(v) => setNewList({ ...newList, sector_id: v })}>
            <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={newList.moment} onValueChange={(v) => setNewList({ ...newList, moment: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="abertura">Abertura</SelectItem>
              <SelectItem value="fechamento">Fechamento</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Título" value={newList.title} onChange={(e) => setNewList({ ...newList, title: e.target.value })} className="sm:col-span-1" />
          <Button onClick={createChecklist}><Plus className="h-4 w-4 mr-1" />Criar</Button>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {(data ?? []).map((c: any) => {
          const isOpen = open === c.id;
          const items = (c.checklist_items ?? []).sort((a: any, b: any) => a.position - b.position);
          const draft = newItem[c.id] ?? { question: "", is_critical: false, requires_photo: false };
          return (
            <Card key={c.id}>
              <CardContent className="p-3">
                <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpen(isOpen ? null : c.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Badge variant="secondary">{MOMENT_LABEL[c.moment as keyof typeof MOMENT_LABEL]}</Badge>
                  <Badge variant="outline">{c.sectors?.name}</Badge>
                  <span className="font-medium flex-1 truncate">{c.title}</span>
                  {!c.active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                  <span className="text-xs text-muted-foreground">{items.length} itens</span>
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {items.map((i: any) => (
                      <div key={i.id} className="flex items-center gap-2 text-sm border rounded-md p-2">
                        <span className="text-xs text-muted-foreground w-6">{i.position}.</span>
                        <span className="flex-1">{i.question}</span>
                        {i.is_critical && <Badge variant="destructive" className="text-[10px]">Crítico</Badge>}
                        {i.requires_photo && <Badge variant="outline" className="text-[10px]">Foto</Badge>}
                        <Button size="icon" variant="ghost" onClick={() => deleteItem(i.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <div className="border rounded-md p-2 bg-muted/30 space-y-2">
                      <Input placeholder="Nova pergunta" value={draft.question}
                        onChange={(e) => setNewItem((p) => ({ ...p, [c.id]: { ...draft, question: e.target.value } }))} />
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-2"><Checkbox checked={draft.is_critical}
                          onCheckedChange={(v) => setNewItem((p) => ({ ...p, [c.id]: { ...draft, is_critical: !!v } }))} />Crítico</label>
                        <label className="flex items-center gap-2"><Checkbox checked={draft.requires_photo}
                          onCheckedChange={(v) => setNewItem((p) => ({ ...p, [c.id]: { ...draft, requires_photo: !!v } }))} />Exige foto</label>
                        <Button size="sm" onClick={() => addItem(c.id, items.length)} className="ml-auto">Adicionar item</Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(c.id, c.active)}>
                        {c.active ? "Desativar checklist" : "Ativar checklist"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}