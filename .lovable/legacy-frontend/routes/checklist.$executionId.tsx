import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, MinusCircle, Camera, ArrowLeft, Loader2, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { MOMENT_LABEL, RESPONSE_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/checklist/$executionId")({
  head: () => ({ meta: [{ title: "Checklist — Meu Querido" }] }),
  component: ExecPage,
});

type Item = {
  id: string; position: number; question: string; help_text: string | null;
  is_critical: boolean; requires_photo: boolean;
};
type Response = {
  id?: string; item_id: string; response: "conforme" | "nao_conforme" | "na" | null;
  observation: string; photo_urls: string[]; dirty?: boolean;
};

function ExecPage() {
  const { executionId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: async () => {
      const { data: exec, error } = await supabase
        .from("checklist_executions")
        .select("id, status, scheduled_date, checklist_id, sector_id, checklists(title, moment, sectors(name))")
        .eq("id", executionId)
        .single();
      if (error) throw error;
      const { data: items } = await supabase
        .from("checklist_items")
        .select("id, position, question, help_text, is_critical, requires_photo")
        .eq("checklist_id", exec.checklist_id)
        .order("position");
      const { data: resp } = await supabase
        .from("checklist_item_responses")
        .select("id, item_id, response, observation, photo_urls")
        .eq("execution_id", executionId);
      const map: Record<string, Response> = {};
      (items ?? []).forEach((i) => {
        const r = (resp ?? []).find((x) => x.item_id === i.id);
        map[i.id] = r
          ? { id: r.id, item_id: i.id, response: r.response, observation: r.observation ?? "", photo_urls: r.photo_urls ?? [] }
          : { item_id: i.id, response: null, observation: "", photo_urls: [] };
      });
      setResponses(map);
      return { exec, items: (items ?? []) as Item[] };
    },
  });

  function updateResp(itemId: string, patch: Partial<Response>) {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch, dirty: true } }));
  }

  async function uploadPhoto(itemId: string, file: File) {
    if (!user) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${executionId}/${itemId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("checklist-evidence").upload(path, file, { upsert: false });
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("checklist-evidence").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? path;
    updateResp(itemId, { photo_urls: [...(responses[itemId]?.photo_urls ?? []), url] });
  }

  async function saveProgress() {
    setSaving(true);
    try {
      const toUpsert = Object.values(responses)
        .filter((r) => r.dirty && r.response)
        .map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          execution_id: executionId,
          item_id: r.item_id,
          response: r.response!,
          observation: r.observation || null,
          photo_urls: r.photo_urls,
          answered_by: user!.id,
        }));
      if (toUpsert.length) {
        const { error } = await supabase
          .from("checklist_item_responses")
          .upsert(toUpsert, { onConflict: "execution_id,item_id" });
        if (error) throw error;
        setResponses((prev) => {
          const out = { ...prev };
          Object.keys(out).forEach((k) => { out[k] = { ...out[k], dirty: false }; });
          return out;
        });
        qc.invalidateQueries({ queryKey: ["execution", executionId] });
        qc.invalidateQueries({ queryKey: ["today-checklists"] });
      }
      toast.success("Progresso salvo.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function finalize() {
    if (!data) return;
    const missing = data.items.filter((i) => !responses[i.id]?.response);
    if (missing.length) return toast.error(`Responda todos os itens (${missing.length} pendente).`);
    const photoMissing = data.items.filter((i) => {
      const r = responses[i.id];
      if (!r) return true;
      const needs = (i.requires_photo && r.response !== "na") || (i.is_critical && r.response === "nao_conforme");
      return needs && (r.photo_urls?.length ?? 0) === 0;
    });
    if (photoMissing.length) return toast.error(`Foto obrigatória em ${photoMissing.length} item(ns).`);

    setFinalizing(true);
    try {
      await saveProgress();
      const { error } = await supabase
        .from("checklist_executions")
        .update({ status: "finalizada", finished_at: new Date().toISOString() })
        .eq("id", executionId);
      if (error) throw error;
      const ncCount = data.items.filter((i) => responses[i.id]?.response === "nao_conforme").length;
      toast.success(ncCount ? `Checklist finalizado. ${ncCount} NC criada(s).` : "Checklist finalizado.");
      qc.invalidateQueries();
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setFinalizing(false); }
  }

  if (isLoading || !data) {
    return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  }

  const exec = data.exec as { status: string; checklists: { title: string; moment: "abertura" | "fechamento"; sectors: { name: string } } };
  const finalized = exec.status === "finalizada";
  const answered = Object.values(responses).filter((r) => r.response).length;
  const total = data.items.length;

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{MOMENT_LABEL[exec.checklists.moment]}</Badge>
            <span>{exec.checklists.sectors.name}</span>
          </div>
          <h1 className="text-lg font-semibold truncate">{exec.checklists.title}</h1>
        </div>
        <Badge variant="outline">{answered}/{total}</Badge>
      </div>

      <div className="space-y-3">
        {data.items.map((item) => {
          const r = responses[item.id];
          const needsPhoto = (item.requires_photo && r?.response !== "na") || (item.is_critical && r?.response === "nao_conforme");
          return (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground mt-0.5">{item.position}.</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-snug">{item.question}</p>
                      {item.help_text && <p className="text-xs text-muted-foreground mt-1">{item.help_text}</p>}
                      <div className="flex gap-1 mt-1.5">
                        {item.is_critical && <Badge variant="destructive" className="text-[10px]">Crítico</Badge>}
                        {item.requires_photo && <Badge variant="outline" className="text-[10px]">Foto obrigatória</Badge>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <RespBtn active={r?.response === "conforme"} onClick={() => updateResp(item.id, { response: "conforme" })}
                    color="success" icon={<CheckCircle2 className="h-4 w-4" />} label={RESPONSE_LABEL.conforme} disabled={finalized} />
                  <RespBtn active={r?.response === "nao_conforme"} onClick={() => updateResp(item.id, { response: "nao_conforme" })}
                    color="destructive" icon={<XCircle className="h-4 w-4" />} label={RESPONSE_LABEL.nao_conforme} disabled={finalized} />
                  <RespBtn active={r?.response === "na"} onClick={() => updateResp(item.id, { response: "na" })}
                    color="muted" icon={<MinusCircle className="h-4 w-4" />} label={RESPONSE_LABEL.na} disabled={finalized} />
                </div>

                {r?.response && r.response !== "na" && (
                  <>
                    <Textarea
                      placeholder="Observação (opcional)"
                      value={r.observation}
                      onChange={(e) => updateResp(item.id, { observation: e.target.value })}
                      rows={2}
                      disabled={finalized}
                    />
                    <PhotoUploader
                      photos={r.photo_urls}
                      required={!!needsPhoto}
                      disabled={finalized}
                      onAdd={(file) => uploadPhoto(item.id, file)}
                      onRemove={(url) => updateResp(item.id, { photo_urls: r.photo_urls.filter((u) => u !== url) })}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!finalized && (
        <div className="fixed bottom-16 inset-x-0 z-20 border-t bg-card/95 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-3 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={saveProgress} disabled={saving}>
              {saving ? "Salvando..." : "Salvar progresso"}
            </Button>
            <Button className="flex-1" onClick={finalize} disabled={finalizing}>
              {finalizing ? "Finalizando..." : "Finalizar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RespBtn({ active, onClick, color, icon, label, disabled }: {
  active: boolean; onClick: () => void; color: "success" | "destructive" | "muted";
  icon: React.ReactNode; label: string; disabled: boolean;
}) {
  const cls = active
    ? color === "success" ? "bg-[color:var(--success)] text-[color:var(--success-foreground)] border-transparent"
    : color === "destructive" ? "bg-destructive text-destructive-foreground border-transparent"
    : "bg-muted text-foreground border-transparent"
    : "bg-background text-foreground hover:bg-accent";
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={"border rounded-md py-2 text-xs font-medium flex flex-col items-center gap-1 transition disabled:opacity-50 " + cls}>
      {icon}{label}
    </button>
  );
}

function PhotoUploader({ photos, required, disabled, onAdd, onRemove }: {
  photos: string[]; required: boolean; disabled: boolean;
  onAdd: (f: File) => void; onRemove: (u: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          Fotos {required && <span className="text-destructive">*</span>} {photos.length > 0 && `(${photos.length})`}
        </span>
        <Button type="button" size="sm" variant="outline" disabled={disabled || photos.length >= 5} onClick={() => ref.current?.click()}>
          <Camera className="h-4 w-4 mr-1" />Adicionar
        </Button>
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }} />
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((u) => (
            <div key={u} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
              <img src={u} alt="evidência" className="w-full h-full object-cover" />
              {!disabled && (
                <button type="button" onClick={() => onRemove(u)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}