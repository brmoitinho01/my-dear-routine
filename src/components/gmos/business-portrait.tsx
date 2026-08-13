// FASE F8.1-B1 — UI do Retrato do negócio.
// Nada aqui autoriza: RLS decide leitura/escrita e a revisão do retrato é
// SEMPRE do banco (RPC f81_review_business_snapshot). O frontend nunca declara
// o retrato pronto, nunca converte "não tenho este dado" em zero e nunca
// compara os números com mercado.
import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, Check, CheckCircle2, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACT_CONFIDENCE_LABEL,
  FACT_DIMENSION_LABEL,
  businessPortraitCoverage,
  businessPortraitReadiness,
  deriveBusinessMetrics,
  formatDerivedMetric,
  formatFactValue,
  normalizeBusinessFacts,
  validateFactValue,
  type BusinessFactsInput,
  type FactConfidence,
  type FactDefinition,
  type FactDimension,
  type FactValueDraft,
  type NormalizedFact,
} from "@/lib/gmos/business-facts";

const DIMENSION_ORDER: FactDimension[] = [
  "finance",
  "marketing_sales",
  "operations",
  "people",
  "governance",
];

const IMPORTANCE_BADGE: Record<string, string> = {
  core: "Essencial",
  recommended: "Recomendado",
  optional: "Opcional",
};

type Props = {
  portrait: BusinessFactsInput;
  disabled: boolean;
  savingCode: string | null;
  reviewing: boolean;
  creating: boolean;
  onCreateSnapshot: () => void;
  onSave: (definition: FactDefinition, draft: FactValueDraft) => void;
  onReview: () => void;
};

export function BusinessPortrait({
  portrait,
  disabled,
  savingCode,
  reviewing,
  creating,
  onCreateSnapshot,
  onSave,
  onReview,
}: Props) {
  const facts = useMemo(
    () => normalizeBusinessFacts(portrait.definitions, portrait.values),
    [portrait],
  );
  const coverage = useMemo(() => businessPortraitCoverage(portrait), [portrait]);
  const readiness = useMemo(() => businessPortraitReadiness(portrait), [portrait]);
  const metrics = useMemo(() => deriveBusinessMetrics(portrait), [portrait]);

  if (!portrait.snapshot) {
    return (
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Retrato do negócio</h2>
            <p className="text-sm text-muted-foreground">
              Antes de recomendar caminhos, o GMOS precisa dos números reais da unidade. Você não
              precisa ter todos os dados: “não tenho este dado” também é uma resposta válida e será
              registrada como tal.
            </p>
          </div>
          <Button size="sm" disabled={disabled || creating} onClick={onCreateSnapshot}>
            {creating ? "Criando…" : "Começar o retrato do negócio"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const byDimension = DIMENSION_ORDER.map((dimension) => ({
    dimension,
    items: facts
      .filter((f) => f.definition.dimension === dimension && !f.definition.derived)
      .sort(
        (a, b) =>
          a.definition.sortOrder - b.definition.sortOrder ||
          a.definition.label.localeCompare(b.definition.label),
      ),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Retrato do negócio</h2>
              <p className="text-sm text-muted-foreground">
                Período de referência: {portrait.snapshot.periodLabel ?? portrait.snapshot.referenceDate}
              </p>
            </div>
            <Badge variant={readiness.reviewed ? "default" : "outline"}>
              {readiness.reviewed ? "Revisado" : "Em preenchimento"}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{coverage.coveragePercent}% de dados disponíveis</span>
              <span>
                {coverage.answeredCount} de {coverage.applicableCount} itens respondidos
              </span>
            </div>
            <Progress value={coverage.coveragePercent} aria-label="Dados disponíveis" />
            <p className="text-xs text-muted-foreground">
              Este percentual mede quanto dado existe — não a qualidade da empresa.{" "}
              {coverage.estimatedCount} estimativa(s) · {coverage.unavailableCount} item(ns) sem dado.
            </p>
          </div>

          <div
            className={`rounded-md border p-3 text-sm ${
              readiness.readyForRecommendations
                ? "border-primary/40 bg-primary/5"
                : "border-amber-500/40 bg-amber-500/5"
            }`}
          >
            <p className="flex items-start gap-2">
              {readiness.readyForRecommendations ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>{readiness.message}</span>
            </p>
            {readiness.missingCoreLabels.length > 0 ? (
              <ul className="mt-2 list-disc pl-8 text-xs text-muted-foreground">
                {readiness.missingCoreLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={disabled || reviewing || readiness.reviewed}
              onClick={onReview}
            >
              {reviewing ? "Revisando…" : "Revisar e confirmar o retrato"}
            </Button>
            <p className="text-xs text-muted-foreground">
              A confirmação é validada pelo banco: o sistema recusa se faltar bloco essencial.
            </p>
          </div>
        </CardContent>
      </Card>

      {metrics.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Calculator className="h-3.5 w-3.5" aria-hidden /> Fatos calculados pelo GMOS
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {metrics.map((m) => (
                <li key={m.code} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-lg font-semibold">{formatDerivedMetric(m)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Cálculo: {m.formula}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Calculado a partir dos dados informados. Nenhuma extrapolação e nenhuma comparação com
              mercado.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {byDimension.map((group) => (
        <Card key={group.dimension}>
          <CardContent className="space-y-4 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {FACT_DIMENSION_LABEL[group.dimension]}
            </p>
            <div className="space-y-4">
              {group.items.map((fact) => (
                <FactRow
                  key={fact.definition.id}
                  fact={fact}
                  currencyCode={portrait.snapshot?.currencyCode ?? "BRL"}
                  disabled={disabled}
                  saving={savingCode === fact.definition.code}
                  onSave={onSave}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FactRow({
  fact,
  currencyCode,
  disabled,
  saving,
  onSave,
}: {
  fact: NormalizedFact;
  currencyCode: string;
  disabled: boolean;
  saving: boolean;
  onSave: (definition: FactDefinition, draft: FactValueDraft) => void;
}) {
  const d = fact.definition;
  const isBoolean = d.valueType === "boolean";
  const isText = d.valueType === "text_short";

  const [raw, setRaw] = useState<string>(() => {
    if (isBoolean) return fact.boolean === null ? "" : fact.boolean ? "true" : "false";
    if (isText) return fact.text ?? "";
    return fact.numeric === null ? "" : String(fact.numeric);
  });
  const [estimated, setEstimated] = useState<boolean>(fact.estimated);
  const [note, setNote] = useState<string>(fact.sourceNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const draft = (confidence: FactConfidence): FactValueDraft => ({
    numericValue: isBoolean || isText ? null : raw.trim() === "" ? null : Number(raw.replace(",", ".")),
    textValue: isText ? raw : null,
    booleanValue: isBoolean ? (raw === "" ? null : raw === "true") : null,
    confidence,
    sourceNote: note.trim() ? note.trim() : null,
  });

  const submit = () => {
    const next = draft(estimated ? "estimated" : "exact");
    const validation = validateFactValue(d, next);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setError(null);
    onSave(d, next);
  };

  const currentLabel = fact.unavailable
    ? "Não disponível"
    : fact.answered
      ? formatFactValue(d.valueType, fact.numeric ?? fact.boolean ?? fact.text, d.unit ?? currencyCode)
      : "Sem resposta";

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Label className="text-sm font-medium" htmlFor={`fact-${d.id}`}>
            {d.label}
          </Label>
          {d.description ? (
            <p className="text-xs text-muted-foreground">{d.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {d.importance !== "optional" ? (
            <Badge variant="outline" className="text-[10px]">
              {IMPORTANCE_BADGE[d.importance]}
            </Badge>
          ) : null}
          <Badge variant={fact.answered ? "secondary" : "outline"} className="text-[10px]">
            {currentLabel}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isBoolean ? (
          <Select value={raw} onValueChange={setRaw} disabled={disabled}>
            <SelectTrigger id={`fact-${d.id}`} className="w-[140px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={`fact-${d.id}`}
            className="w-[180px]"
            inputMode={isText ? "text" : "decimal"}
            type={isText ? "text" : "number"}
            value={raw}
            disabled={disabled}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={d.unit ?? (isText ? "Texto curto" : "Número")}
          />
        )}
        {d.unit && !isText && !isBoolean ? (
          <span className="text-xs text-muted-foreground">{d.unit}</span>
        ) : null}

        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={estimated}
            disabled={disabled}
            onChange={(e) => setEstimated(e.target.checked)}
          />
          {FACT_CONFIDENCE_LABEL.estimated}
        </label>

        <Button size="sm" disabled={disabled || saving} onClick={submit}>
          <Check className="mr-1 h-3.5 w-3.5" aria-hidden /> Salvar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={() => {
            setError(null);
            onSave(d, { confidence: "unavailable" });
          }}
        >
          <HelpCircle className="mr-1 h-3.5 w-3.5" aria-hidden /> Não tenho este dado
        </Button>
      </div>

      <Input
        className="h-8 text-xs"
        value={note}
        disabled={disabled}
        maxLength={120}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Origem do dado (opcional, até 120 caracteres)"
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
