// FASE F8.1-A — diagnóstico do Planejamento montado a partir da Jornada (F12).
// Nada é digitado pelo usuário aqui e nada é inventado: só entram os sinais que a
// liderança selecionou na Jornada. Sem IA e sem inferência externa.
import { Check, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import { StateCard } from "@/components/gmos/states";
import {
  SWOT_ORDER,
  diagnosisConfirmDecision,
  diagnosisReadiness,
  diagnosticReplacement,
  selectedStatementsBySwot,
  synthesizePlanningDiagnostic,
  type PlanningDiagnosisInput,
} from "@/lib/gmos/planning-diagnosis";
import {
  MATURITY_BAND_LABEL,
  SECTOR_LABEL,
  STAGE_LABEL,
  SWOT_LABEL,
  DIMENSION_LABEL,
} from "@/lib/gmos/strategy-recommendations";
import type { Diagnostic, DiagnosticInput } from "@/lib/gmos/strategy";

export function GuidedPlanningDiagnosis({
  input,
  diagnostic,
  canEdit,
  saving,
  onConfirm,
}: {
  input: PlanningDiagnosisInput;
  diagnostic: Diagnostic | null;
  canEdit: boolean;
  saving: boolean;
  onConfirm: (value: DiagnosticInput) => void;
}) {
  const readiness = diagnosisReadiness(input);
  const draft = synthesizePlanningDiagnostic(input);
  const replacement = diagnosticReplacement(diagnostic, draft);
  // F8.1-A.1 — nada de confirmar diagnóstico com Jornada incompleta.
  const decision = diagnosisConfirmDecision({ readiness, replacement, canEdit });
  const swot = selectedStatementsBySwot(input.statements, input.selections);
  const maturity = input.maturity;

  const blocks: { key: keyof DiagnosticInput; label: string; text: string }[] = [
    { key: "strengths", label: SWOT_LABEL.strength, text: draft.strengths },
    { key: "weaknesses", label: SWOT_LABEL.weakness, text: draft.weaknesses },
    { key: "opportunities", label: SWOT_LABEL.opportunity, text: draft.opportunities },
    { key: "threats", label: SWOT_LABEL.threat, text: draft.threats },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Diagnóstico preparado a partir da Jornada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            O Diagnóstico da Jornada é a origem. Aqui ele vira o Diagnóstico do Planejamento, sem
            digitação e sem nenhum conteúdo inventado.
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <Fact
              label="Setor"
              value={input.profile ? SECTOR_LABEL[input.profile.sectorCode] : "—"}
            />
            <Fact label="Modelo" value={input.profile?.businessModelLabel ?? "—"} />
            <Fact label="Fase" value={input.profile ? STAGE_LABEL[input.profile.stage] : "—"} />
            <Fact
              label="Maturidade"
              value={
                !maturity || maturity.total === 0
                  ? "—"
                  : maturity.complete
                    ? `${MATURITY_BAND_LABEL[maturity.band]} · ${maturity.overall}/100`
                    : `provisória · ${maturity.answered}/${maturity.total} respostas`
              }
            />
          </dl>

          {maturity?.complete && maturity.gaps.length > 0 ? (
            <p className="text-xs">
              <span className="font-semibold">Principais lacunas: </span>
              {maturity.gaps.map((g) => DIMENSION_LABEL[g]).join(", ")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Prioridades da liderança
            </span>
            {input.priorityDimensions.length === 0 ? (
              <span className="text-xs text-muted-foreground">nenhuma registrada</span>
            ) : (
              input.priorityDimensions.map((d) => (
                <Badge key={d} variant="outline">
                  {DIMENSION_LABEL[d]}
                </Badge>
              ))
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SWOT_ORDER.map((category) => (
              <div key={category} className="rounded-md border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {SWOT_LABEL[category]} · {swot[category].length} sinal(is)
                </p>
                {swot[category].length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum sinal selecionado na Jornada.
                  </p>
                ) : (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                    {swot[category].map((s) => (
                      <li key={s.id}>{s.statement}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Resumo do contexto
            </p>
            <p className="mt-1 text-sm">{draft.contextSummary}</p>
          </div>

          {blocks.some((b) => b.text.length === 0) ? (
            <p className="text-xs text-muted-foreground">
              Blocos sem sinal selecionado ficam vazios de propósito: o sistema não escreve forças
              ou ameaças que ninguém marcou.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!readiness.ready ? (
        <StateCard
          title="A Jornada Estratégica ainda está incompleta"
          description={`Falta: ${readiness.missing.join(" ")}`}
        >
          <Button size="sm" asChild>
            <Link to="/jornada-estrategica">Continuar Jornada Estratégica</Link>
          </Button>
        </StateCard>
      ) : null}

      {decision.mode === "replace" ? (
        <ConfirmAction
          trigger={
            <Button size="sm" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Substituir diagnóstico pelo da Jornada
            </Button>
          }
          title="Substituir o diagnóstico atual?"
          description="O diagnóstico registrado será substituído pelo rascunho gerado a partir da Jornada. Nada é aprovado nem ativado por esta ação."
          actionLabel="Substituir"
          onConfirm={() => onConfirm(draft)}
        />
      ) : decision.mode === "confirm" ? (
        <Button size="sm" disabled={saving} onClick={() => onConfirm(draft)}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Confirmar diagnóstico no Planejamento
        </Button>
      ) : decision.reason === "read_only" ? (
        <p className="text-xs text-muted-foreground">Você tem acesso de leitura a esta etapa.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          A confirmação no Planejamento fica disponível quando a Jornada Estratégica estiver
          concluída. Concluir a revisão do diagnóstico sem nenhum sinal selecionado também é uma
          resposta válida.
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
