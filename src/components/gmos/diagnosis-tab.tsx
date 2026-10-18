// F13 — Aba Diagnóstico: Negócio, Missão, Visão, SWOT e ferramentas de análise (1 a 5).
// A interface só reflete: gravação protegida por RLS (strategy.manage).
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ErrorBlock, LoadingBlock } from "@/components/gmos/states";
import {
  ANALYSIS_TOOLS,
  computeToolResult,
  scoreKey,
  type AnalysisData,
  type AnalysisTool,
  type ToolCode,
} from "@/lib/gmos/strategic-analysis";

type Ctx = { organizationId: string; businessUnitId: string; planId: string; canEdit: boolean };

type Foundation = {
  mission: string;
  vision: string;
  diagnosisId: string | null;
  business: string;
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
};

type AnalysisRow = {
  id: string;
  tool_code: ToolCode;
  data: AnalysisData;
  conclusion: string | null;
};

async function fetchDiagnosis(planId: string) {
  const [plan, diag, an] = await Promise.all([
    supabase.from("strategic_plans").select("mission, vision").eq("id", planId).maybeSingle(),
    supabase
      .from("plan_diagnostics")
      .select("id, context_summary, strengths, weaknesses, opportunities, threats")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("strategic_analyses")
      .select("id, tool_code, data, conclusion")
      .eq("plan_id", planId),
  ]);
  for (const r of [plan, diag, an]) if (r.error) throw new Error(r.error.message);
  const d = diag.data;
  const foundation: Foundation = {
    mission: plan.data?.mission ?? "",
    vision: plan.data?.vision ?? "",
    diagnosisId: d?.id ?? null,
    business: d?.context_summary ?? "",
    strengths: d?.strengths ?? "",
    weaknesses: d?.weaknesses ?? "",
    opportunities: d?.opportunities ?? "",
    threats: d?.threats ?? "",
  };
  return { foundation, analyses: (an.data ?? []) as unknown as AnalysisRow[] };
}

export function DiagnosisTab(ctx: Ctx) {
  const q = useQuery({
    queryKey: ["gmos", "diagnosis", ctx.planId],
    queryFn: () => fetchDiagnosis(ctx.planId),
    retry: false,
  });
  if (q.isPending) return <LoadingBlock rows={3} />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const byCode = new Map(q.data.analyses.map((a) => [a.tool_code, a]));
  return (
    <div className="space-y-6">
      <FoundationCard ctx={ctx} initial={q.data.foundation} />
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Ferramentas de análise</h2>
          <p className="text-sm text-muted-foreground">
            Dê notas de 1 a 5. As médias são calculadas automaticamente; itens sem nota não entram
            na conta.
          </p>
        </div>
        <Accordion type="multiple" className="space-y-2">
          {ANALYSIS_TOOLS.map((tool) => (
            <ToolCard key={tool.code} ctx={ctx} tool={tool} row={byCode.get(tool.code) ?? null} />
          ))}
        </Accordion>
      </section>
    </div>
  );
}

function FoundationCard({ ctx, initial }: { ctx: Ctx; initial: Foundation }) {
  const qc = useQueryClient();
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [initial]);
  const set = (k: keyof Foundation) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const n = (v: string) => (v.trim() ? v.trim() : null);
      const p = await supabase
        .from("strategic_plans")
        .update({ mission: n(f.mission), vision: n(f.vision) })
        .eq("id", ctx.planId);
      if (p.error) throw new Error(p.error.message);
      const diag = {
        context_summary: n(f.business),
        strengths: n(f.strengths),
        weaknesses: n(f.weaknesses),
        opportunities: n(f.opportunities),
        threats: n(f.threats),
      };
      const r = f.diagnosisId
        ? await supabase.from("plan_diagnostics").update(diag).eq("id", f.diagnosisId)
        : await supabase.from("plan_diagnostics").insert({
            ...diag,
            organization_id: ctx.organizationId,
            business_unit_id: ctx.businessUnitId,
            plan_id: ctx.planId,
          });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmos", "diagnosis", ctx.planId] });
      toast.success("Diagnóstico salvo.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const field = (k: keyof Foundation, label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Textarea
        id={`f-${k}`}
        value={String(f[k] ?? "")}
        onChange={set(k)}
        placeholder={hint}
        disabled={!ctx.canEdit}
        rows={3}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Negócio, missão e visão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {field("business", "Negócio", "Qual é o negócio da empresa, visto pelos olhos do cliente?")}
        <div className="grid gap-4 md:grid-cols-2">
          {field("mission", "Missão", "Por que a empresa existe e para quem.")}
          {field("vision", "Visão", "Onde a empresa quer chegar e em quanto tempo.")}
        </div>
        <h3 className="pt-2 text-sm font-semibold">Análise SWOT</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {field("strengths", "Forças", "Pontos fortes internos.")}
          {field("weaknesses", "Fraquezas", "Pontos fracos internos.")}
          {field("opportunities", "Oportunidades", "Fatores externos favoráveis.")}
          {field("threats", "Ameaças", "Fatores externos desfavoráveis.")}
        </div>
        {ctx.canEdit ? (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Perfil somente leitura.</p>
        )}
      </CardContent>
    </Card>
  );
}

const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));

function ToolCard({ ctx, tool, row }: { ctx: Ctx; tool: AnalysisTool; row: AnalysisRow | null }) {
  const qc = useQueryClient();
  const initial = useMemo<AnalysisData>(
    () => ({ scores: {}, notes: {}, labels: {}, ...(row?.data ?? {}) }),
    [row],
  );
  const [data, setData] = useState<AnalysisData>(initial);
  const [conclusion, setConclusion] = useState(row?.conclusion ?? "");
  useEffect(() => {
    setData(initial);
    setConclusion(row?.conclusion ?? "");
  }, [initial, row]);

  const result = useMemo(() => computeToolResult(tool, data), [tool, data]);

  const setScore = (k: string, v: string) =>
    setData((d) => {
      const scores = { ...(d.scores ?? {}) };
      if (v) scores[k] = Number(v);
      else delete scores[k];
      return { ...d, scores };
    });
  const setLabel = (k: string, v: string) =>
    setData((d) => ({ ...d, labels: { ...(d.labels ?? {}), [k]: v } }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = { data: data as never, conclusion: conclusion.trim() || null };
      const r = row
        ? await supabase.from("strategic_analyses").update(payload).eq("id", row.id)
        : await supabase.from("strategic_analyses").insert({
            ...payload,
            tool_code: tool.code,
            organization_id: ctx.organizationId,
            business_unit_id: ctx.businessUnitId,
            plan_id: ctx.planId,
          });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmos", "diagnosis", ctx.planId] });
      toast.success(`${tool.title} salva.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const colLabel = (c: AnalysisTool["columns"][number]) =>
    (c.editable && data.labels?.[`col:${c.key}`]) || c.label;
  const multi = tool.columns.length > 1;

  return (
    <AccordionItem value={tool.code} className="rounded-md border px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-3 text-left">
          <span className="text-sm font-medium">{tool.title}</span>
          <span className="text-xs text-muted-foreground">
            {result.answered}/{result.total} notas · média {fmt(result.average)}
            {result.verdict ? ` · ${result.verdict.title}` : ""}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tool.description}</p>
        <p className="text-xs text-muted-foreground">
          Escala: {tool.scale.map((s, i) => `${i + 1} ${s}`).join(" · ")}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Item</th>
                {tool.columns.map((c) => (
                  <th key={c.key} className="w-28 px-1 py-2 font-medium">
                    {c.editable && ctx.canEdit ? (
                      <Input
                        aria-label={`Nome da coluna ${c.label}`}
                        className="h-7 text-xs"
                        value={data.labels?.[`col:${c.key}`] ?? ""}
                        placeholder={c.label}
                        onChange={(e) => setLabel(`col:${c.key}`, e.target.value)}
                      />
                    ) : (
                      colLabel(c)
                    )}
                  </th>
                ))}
                {multi ? <th className="w-16 px-1 py-2 font-medium">Média</th> : null}
              </tr>
            </thead>
            {tool.groups.map((grp, gi) => (
              <tbody key={grp.key}>
                {tool.groups.length > 1 ? (
                  <tr>
                    <td
                      colSpan={tool.columns.length + 2}
                      className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide"
                    >
                      {grp.title}
                    </td>
                  </tr>
                ) : null}
                {grp.items.map((item) => (
                  <tr key={item.key} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      {tool.editableRows && ctx.canEdit ? (
                        <Input
                          aria-label={`Nome de ${item.label}`}
                          className="h-8"
                          value={data.labels?.[item.key] ?? ""}
                          placeholder={item.label}
                          onChange={(e) => setLabel(item.key, e.target.value)}
                        />
                      ) : (
                        (tool.editableRows && data.labels?.[item.key]) || item.label
                      )}
                    </td>
                    {tool.columns.map((c) => {
                      const k = scoreKey(item.key, c.key);
                      return (
                        <td key={c.key} className="px-1 py-1.5">
                          <select
                            aria-label={`${item.label} — ${c.label}`}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                            value={data.scores?.[k] ?? ""}
                            disabled={!ctx.canEdit}
                            onChange={(e) => setScore(k, e.target.value)}
                          >
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    {multi ? (
                      <td className="px-1 py-1.5 tabular-nums text-muted-foreground">
                        {fmt(result.rows[item.key] ?? null)}
                      </td>
                    ) : null}
                  </tr>
                ))}
                <tr className="bg-muted/50 text-xs font-medium">
                  <td className="py-1.5 pr-2">Média — {grp.title}</td>
                  {tool.columns.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 tabular-nums">
                      {fmt(result.groups[gi].columns[c.key])}
                    </td>
                  ))}
                  {multi ? (
                    <td className="px-1 py-1.5 tabular-nums">{fmt(result.groups[gi].average)}</td>
                  ) : null}
                </tr>
              </tbody>
            ))}
          </table>
        </div>

        <div className="rounded-md border p-3 text-sm">
          <span className="font-medium">Resultado: </span>
          média geral {fmt(result.average)}
          {multi
            ? ` (${tool.columns.map((c) => `${colLabel(c)} ${fmt(result.columns[c.key])}`).join(" · ")})`
            : ""}
          {result.verdict ? (
            <>
              {" "}
              — maior média: <strong>{result.verdict.title}</strong> ({fmt(result.verdict.average)})
            </>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`c-${tool.code}`}>Conclusões</Label>
          <Textarea
            id={`c-${tool.code}`}
            rows={2}
            value={conclusion}
            disabled={!ctx.canEdit}
            onChange={(e) => setConclusion(e.target.value)}
          />
        </div>
        {ctx.canEdit ? (
          <div className="flex justify-end pb-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
