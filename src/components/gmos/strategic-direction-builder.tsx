// FASE F8.1-A — direcionamento estratégico por decisões estruturadas.
// A experiência padrão são cards e chips: o texto oficial é montado pelo sistema
// a partir das escolhas explícitas. Nenhuma IA, nenhuma frase inventada.
// Este componente não decide permissão: recebe de quem já consultou o banco.
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import {
  AMBITION_OPTIONS,
  COMPETITIVE_EDGE_OPTIONS,
  DIRECTION_LIMITS,
  EMPTY_DIRECTION_CHOICES,
  FOCUS_OPTIONS,
  OTHER_CODE,
  PRIORITY_DIMENSION_OPTIONS,
  VALUE_CODE_OPTIONS,
  VALUE_PROPOSITION_OPTIONS,
  behaviourLabels,
  identityReplacement,
  synthesizeStrategicIdentity,
  validateDirectionChoices,
  type DirectionChoices,
  type DirectionContext,
} from "@/lib/gmos/strategic-direction-builder";
import { DIMENSION_LABEL, type Dimension } from "@/lib/gmos/strategy-recommendations";
import type { IdentityInput, StrategicIdentity } from "@/lib/gmos/strategy";

/* ---------- primitivas de escolha ---------- */

function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function ChoiceBlock({
  question,
  help,
  children,
  count,
}: {
  question: string;
  help?: string;
  children: React.ReactNode;
  count?: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{question}</h3>
        {count ? <span className="text-[11px] text-muted-foreground">{count}</span> : null}
      </div>
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function toggle(list: string[], code: string, max: number): string[] {
  if (list.includes(code)) return list.filter((c) => c !== code);
  if (list.length >= max) return list;
  return [...list, code];
}

/* ---------- preview da síntese ---------- */

function PreviewCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-1 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-sm font-medium leading-snug">
          {text.length > 0 ? text : "Complete as escolhas acima."}
        </p>
        <p className="text-[11px] text-muted-foreground">Gerado a partir das suas escolhas</p>
      </CardContent>
    </Card>
  );
}

function Comparison({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-xs text-muted-foreground line-through">
        {before.length > 0 ? before : "sem conteúdo"}
      </p>
      <p className="text-sm font-medium">{after.length > 0 ? after : "—"}</p>
    </div>
  );
}

/* ---------- componente principal ---------- */

export function StrategicDirectionBuilder({
  identity,
  choices,
  journeyPriorities,
  context,
  canEdit,
  saving,
  onConfirm,
}: {
  identity: StrategicIdentity | null;
  choices: DirectionChoices | null;
  /** prioridades já escolhidas pela liderança na Jornada (F12) */
  journeyPriorities: Dimension[];
  context: DirectionContext;
  canEdit: boolean;
  saving: boolean;
  onConfirm: (choices: DirectionChoices, identity: IdentityInput) => void;
}) {
  const [form, setForm] = useState<DirectionChoices>(choices ?? EMPTY_DIRECTION_CHOICES);
  useEffect(() => setForm(choices ?? EMPTY_DIRECTION_CHOICES), [choices]);

  const validation = validateDirectionChoices(form);
  const synthesis = synthesizeStrategicIdentity(form, context);
  const replacement = identityReplacement(identity, synthesis);

  const priorityOptions =
    journeyPriorities.length > 0
      ? journeyPriorities.map((d) => ({ code: d, label: DIMENSION_LABEL[d] }))
      : PRIORITY_DIMENSION_OPTIONS;

  const set = <K extends keyof DirectionChoices>(key: K, value: DirectionChoices[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const limits = DIRECTION_LIMITS;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Decisões do direcionamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Você escolhe; o sistema escreve. Missão, visão, valores e norte são montados apenas com
            o que estiver marcado aqui.
          </p>

          <ChoiceBlock
            question="Quem é o foco principal deste ciclo?"
            count={`${form.focusGroups.length}/${limits.focusGroups.max}`}
          >
            {FOCUS_OPTIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                disabled={!canEdit}
                selected={form.focusGroups.includes(o.code)}
                onClick={() =>
                  set("focusGroups", toggle(form.focusGroups, o.code, limits.focusGroups.max))
                }
              />
            ))}
            <Chip
              label="Outro"
              disabled={!canEdit}
              selected={form.focusGroups.includes(OTHER_CODE)}
              onClick={() =>
                set("focusGroups", toggle(form.focusGroups, OTHER_CODE, limits.focusGroups.max))
              }
            />
            {form.focusGroups.includes(OTHER_CODE) ? (
              <Input
                className="h-9 max-w-xs"
                placeholder="Qual foco?"
                disabled={!canEdit}
                value={form.customFocus}
                onChange={(e) => set("customFocus", e.target.value)}
              />
            ) : null}
          </ChoiceBlock>

          <ChoiceBlock
            question="Qual valor queremos entregar melhor?"
            count={`${form.valuePropositions.length}/${limits.valuePropositions.max}`}
          >
            {VALUE_PROPOSITION_OPTIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                disabled={!canEdit}
                selected={form.valuePropositions.includes(o.code)}
                onClick={() =>
                  set(
                    "valuePropositions",
                    toggle(form.valuePropositions, o.code, limits.valuePropositions.max),
                  )
                }
              />
            ))}
            <Chip
              label="Outro"
              disabled={!canEdit}
              selected={form.valuePropositions.includes(OTHER_CODE)}
              onClick={() =>
                set(
                  "valuePropositions",
                  toggle(form.valuePropositions, OTHER_CODE, limits.valuePropositions.max),
                )
              }
            />
            {form.valuePropositions.includes(OTHER_CODE) ? (
              <Input
                className="h-9 max-w-xs"
                placeholder="Qual entrega de valor?"
                disabled={!canEdit}
                value={form.customValueProposition}
                onChange={(e) => set("customValueProposition", e.target.value)}
              />
            ) : null}
          </ChoiceBlock>

          <ChoiceBlock
            question="Como queremos ser reconhecidos e competir?"
            count={`${form.competitiveEdges.length}/${limits.competitiveEdges.max}`}
          >
            {COMPETITIVE_EDGE_OPTIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                disabled={!canEdit}
                selected={form.competitiveEdges.includes(o.code)}
                onClick={() =>
                  set(
                    "competitiveEdges",
                    toggle(form.competitiveEdges, o.code, limits.competitiveEdges.max),
                  )
                }
              />
            ))}
            <Chip
              label="Outro"
              disabled={!canEdit}
              selected={form.competitiveEdges.includes(OTHER_CODE)}
              onClick={() =>
                set(
                  "competitiveEdges",
                  toggle(form.competitiveEdges, OTHER_CODE, limits.competitiveEdges.max),
                )
              }
            />
            {form.competitiveEdges.includes(OTHER_CODE) ? (
              <Input
                className="h-9 max-w-xs"
                placeholder="Como competimos?"
                disabled={!canEdit}
                value={form.customCompetitiveEdge}
                onChange={(e) => set("customCompetitiveEdge", e.target.value)}
              />
            ) : null}
          </ChoiceBlock>

          <ChoiceBlock question="Qual é a principal ambição do ciclo?" count="escolha única">
            {AMBITION_OPTIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                disabled={!canEdit}
                selected={form.ambition === o.code}
                onClick={() => set("ambition", form.ambition === o.code ? null : o.code)}
              />
            ))}
          </ChoiceBlock>

          <ChoiceBlock
            question="Quais comportamentos são inegociáveis?"
            help={`Escolha de ${limits.valueCodes.min} a ${limits.valueCodes.max}.`}
            count={`${form.valueCodes.length}/${limits.valueCodes.max}`}
          >
            {VALUE_CODE_OPTIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                disabled={!canEdit}
                selected={form.valueCodes.includes(o.code)}
                onClick={() =>
                  set("valueCodes", toggle(form.valueCodes, o.code, limits.valueCodes.max))
                }
              />
            ))}
          </ChoiceBlock>

          <ChoiceBlock
            question="Qual prioridade resolve o maior gargalo agora?"
            help={
              journeyPriorities.length > 0
                ? "Temas já priorizados pela liderança na Jornada Estratégica."
                : "A Jornada ainda não registrou prioridades: a escolha aqui precisa ser alinhada com a Jornada."
            }
            count="escolha única"
          >
            {priorityOptions.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                disabled={!canEdit}
                selected={form.priorityDimension === o.code}
                onClick={() =>
                  set("priorityDimension", form.priorityDimension === o.code ? null : o.code)
                }
              />
            ))}
          </ChoiceBlock>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewCard title="Missão sugerida" text={synthesis.mission} />
        <PreviewCard title="Visão sugerida" text={synthesis.vision} />
        <PreviewCard title="Valores escolhidos" text={behaviourLabels(form).join(", ")} />
        <PreviewCard title="Norte estratégico" text={synthesis.strategicNorth} />
      </div>

      {!validation.valid ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {validation.issues.map((i) => (
            <li key={`${String(i.field)}-${i.message}`}>{i.message}</li>
          ))}
        </ul>
      ) : null}

      {canEdit ? (
        validation.valid && replacement.requiresConfirmation ? (
          <ConfirmAction
            trigger={
              <Button size="sm" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Substituir pelo direcionamento estruturado
              </Button>
            }
            title="Substituir o direcionamento atual?"
            description="O texto atual será substituído pela síntese das suas escolhas. Nada é aprovado nem ativado por esta ação."
            actionLabel="Substituir"
            onConfirm={() => onConfirm(form, synthesis)}
          />
        ) : (
          <Button
            size="sm"
            disabled={saving || !validation.valid}
            onClick={() => onConfirm(form, synthesis)}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Confirmar direcionamento
          </Button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">Você tem acesso de leitura a esta etapa.</p>
      )}

      {replacement.requiresConfirmation ? (
        <Card className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              Direcionamento atual x nova síntese
              <Badge variant="outline">confirmação necessária</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Comparison label="Missão" before={identity?.mission ?? ""} after={synthesis.mission} />
            <Comparison label="Visão" before={identity?.vision ?? ""} after={synthesis.vision} />
            <Comparison
              label="Valores"
              before={identity?.valuesText ?? ""}
              after={synthesis.valuesText}
            />
            <Comparison
              label="Norte estratégico"
              before={identity?.strategicNorth ?? ""}
              after={synthesis.strategicNorth}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
