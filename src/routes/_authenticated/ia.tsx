import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runIaMock } from "@/lib/ia-mock.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileSearch, Lightbulb, BookText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ia")({
  head: () => ({ meta: [{ title: "IA Operacional — Meu Querido" }] }),
  component: IaPage,
});

const ACTIONS = [
  { kind: "gerar_checklist", label: "Gerar checklist", desc: "Cria sugestão de itens com base no setor e momento.", icon: Sparkles },
  { kind: "revisar_checklist", label: "Revisar checklist", desc: "Analisa um checklist existente e sugere melhorias.", icon: FileSearch },
  { kind: "sugerir_plano", label: "Sugerir plano de ação", desc: "Propõe 5W2H a partir de uma não conformidade.", icon: Lightbulb },
  { kind: "resumo_diario", label: "Resumo diário", desc: "Gera o resumo operacional do dia.", icon: BookText },
] as const;

function IaPage() {
  const run = useServerFn(runIaMock);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ kind: string; data: unknown } | null>(null);

  async function go(kind: typeof ACTIONS[number]["kind"]) {
    setLoading(kind);
    try {
      const data = await run({ data: { kind } });
      setResult({ kind, data });
    } finally { setLoading(null); }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IA Operacional</h1>
          <p className="text-sm text-muted-foreground">Apoio inteligente para padronizar a rotina.</p>
        </div>
        <Badge variant="outline">Beta — respostas simuladas</Badge>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Card key={a.kind}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><a.icon className="h-4 w-4 text-primary" />{a.label}</CardTitle>
              <CardDescription className="text-xs">{a.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="w-full" onClick={() => go(a.kind)} disabled={loading === a.kind}>
                {loading === a.kind ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Gerando...</> : "Executar"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado</CardTitle>
            <CardDescription className="text-xs">Saída mock — a integração real será habilitada em fase futura.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Quando ativada, a IA usará dados anonimizados desta rotina para sugerir melhorias contínuas.
      </p>
    </div>
  );
}