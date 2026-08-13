// FASE F8.1-B1 — camada de acesso do Retrato do negócio.
// Client normal do projeto: toda leitura/escrita passa por RLS e
// public.has_permission. Nenhuma chave de serviço, nenhuma autoria vinda do
// cliente (created_by/updated_by são preenchidos por trigger no banco).
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "./structure";
import type {
  BusinessFactsInput,
  BusinessSnapshotMeta,
  FactConfidence,
  FactDefinition,
  FactDimension,
  FactImportance,
  FactValue,
  FactValueDraft,
  FactValueType,
} from "./business-facts";

export const FACT_LIBRARY_VERSION = 1;

export type BusinessFactContext = {
  organizationId: string;
  businessUnitId: string;
  snapshotId: string;
};

const asDimension = (v: string): FactDimension =>
  (["finance", "marketing_sales", "operations", "people", "governance"] as const).includes(
    v as FactDimension,
  )
    ? (v as FactDimension)
    : "governance";

const asValueType = (v: string): FactValueType =>
  (
    ["currency", "percentage", "number", "days", "hours", "boolean", "text_short"] as const
  ).includes(v as FactValueType)
    ? (v as FactValueType)
    : "number";

const asImportance = (v: string): FactImportance =>
  (["core", "recommended", "optional"] as const).includes(v as FactImportance)
    ? (v as FactImportance)
    : "optional";

const asConfidence = (v: string): FactConfidence =>
  (["exact", "estimated", "unavailable"] as const).includes(v as FactConfidence)
    ? (v as FactConfidence)
    : "exact";

/**
 * Definições aplicáveis: universais sempre; setoriais só quando o perfil da
 * unidade (F12) declara aquele setor. Nada é filtrado por permissão aqui — RLS
 * é a autoridade.
 */
export async function fetchApplicableFactDefinitions(
  profile: { sectorCode: string; businessModel?: string | null } | null,
): Promise<FactDefinition[]> {
  const { data, error } = await supabase
    .from("strategy_fact_definitions")
    .select(
      "id, version, code, label, description, dimension, category, value_type, unit, universal, sector_code, business_model, importance, derived, source_fact_codes, allow_negative, sort_order, is_active",
    )
    .eq("version", FACT_LIBRARY_VERSION)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) translateError(error);

  return (data ?? [])
    .map((d) => ({
      id: d.id,
      version: d.version,
      code: d.code,
      label: d.label,
      description: d.description ?? null,
      dimension: asDimension(d.dimension),
      category: d.category,
      valueType: asValueType(d.value_type),
      unit: d.unit ?? null,
      universal: d.universal,
      sectorCode: d.sector_code ?? null,
      businessModel: d.business_model ?? null,
      importance: asImportance(d.importance),
      derived: d.derived,
      sourceFactCodes: d.source_fact_codes ?? [],
      allowNegative: d.allow_negative,
      sortOrder: d.sort_order ?? 0,
      isActive: d.is_active,
    }))
    .filter((d) => {
      if (d.universal) return true;
      if (!profile) return false;
      if (d.sectorCode && d.sectorCode !== profile.sectorCode) return false;
      if (d.businessModel && d.businessModel !== (profile.businessModel ?? null)) return false;
      return true;
    });
}

/** Último retrato da unidade. Histórico nunca é sobrescrito: novos retratos são novos registros. */
export async function fetchLatestBusinessSnapshot(
  businessUnitId: string,
): Promise<BusinessSnapshotMeta | null> {
  const { data, error } = await supabase
    .from("strategy_business_snapshots")
    .select("id, reference_date, period_label, currency_code, review_status, reviewed_at")
    .eq("business_unit_id", businessUnitId)
    .order("reference_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) translateError(error);
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    id: row.id,
    referenceDate: row.reference_date,
    periodLabel: row.period_label ?? null,
    currencyCode: row.currency_code ?? "BRL",
    reviewStatus: row.review_status === "reviewed" ? "reviewed" : "draft",
    reviewedAt: row.reviewed_at ?? null,
  };
}

export async function fetchBusinessFactValues(snapshotId: string): Promise<FactValue[]> {
  const { data, error } = await supabase
    .from("strategy_business_fact_values")
    .select("fact_definition_id, numeric_value, text_value, boolean_value, confidence, source_note")
    .eq("snapshot_id", snapshotId);
  if (error) translateError(error);
  return (data ?? []).map((v) => ({
    factDefinitionId: v.fact_definition_id,
    numericValue: v.numeric_value === null ? null : Number(v.numeric_value),
    textValue: v.text_value ?? null,
    booleanValue: v.boolean_value ?? null,
    confidence: asConfidence(v.confidence),
    sourceNote: v.source_note ?? null,
  }));
}

export type CreateSnapshotInput = {
  referenceDate: string;
  periodLabel: string | null;
  currencyCode?: string;
};

export async function createBusinessSnapshot(
  ctx: { organizationId: string; businessUnitId: string },
  input: CreateSnapshotInput,
): Promise<BusinessSnapshotMeta> {
  const { data, error } = await supabase
    .from("strategy_business_snapshots")
    .insert({
      organization_id: ctx.organizationId,
      business_unit_id: ctx.businessUnitId,
      reference_date: input.referenceDate,
      period_label: input.periodLabel,
      currency_code: input.currencyCode ?? "BRL",
    })
    .select("id, reference_date, period_label, currency_code, review_status, reviewed_at")
    .single();
  if (error) translateError(error);
  const row = data!;
  return {
    id: row.id,
    referenceDate: row.reference_date,
    periodLabel: row.period_label ?? null,
    currencyCode: row.currency_code ?? "BRL",
    reviewStatus: row.review_status === "reviewed" ? "reviewed" : "draft",
    reviewedAt: row.reviewed_at ?? null,
  };
}

/**
 * Grava um fato. Editar um fato essencial/recomendado de um retrato revisado
 * invalida a revisão automaticamente por trigger no banco.
 */
export async function saveBusinessFactValue(
  ctx: BusinessFactContext,
  definition: FactDefinition,
  draft: FactValueDraft,
): Promise<void> {
  const unavailable = draft.confidence === "unavailable";
  const isNumeric = !["boolean", "text_short"].includes(definition.valueType);
  const { error } = await supabase.from("strategy_business_fact_values").upsert(
    {
      organization_id: ctx.organizationId,
      business_unit_id: ctx.businessUnitId,
      snapshot_id: ctx.snapshotId,
      fact_definition_id: definition.id,
      numeric_value: unavailable || !isNumeric ? null : (draft.numericValue ?? null),
      boolean_value:
        unavailable || definition.valueType !== "boolean" ? null : (draft.booleanValue ?? null),
      text_value:
        unavailable || definition.valueType !== "text_short" ? null : (draft.textValue ?? null),
      confidence: draft.confidence,
      source_note: unavailable ? null : (draft.sourceNote ?? null),
    },
    { onConflict: "snapshot_id,fact_definition_id" },
  );
  if (error) translateError(error);
}

/** "Não tenho este dado" é resposta válida — e nunca é convertida em zero. */
export async function markBusinessFactUnavailable(
  ctx: BusinessFactContext,
  definition: FactDefinition,
): Promise<void> {
  await saveBusinessFactValue(ctx, definition, { confidence: "unavailable" });
}

export type ReviewSnapshotResult = {
  ok: boolean;
  error: string | null;
  message: string;
  missingCoreGroups: string[];
};

/** Única porta de revisão: o frontend nunca declara o retrato pronto. */
export async function reviewBusinessSnapshot(snapshotId: string): Promise<ReviewSnapshotResult> {
  const { data, error } = await supabase.rpc("f81_review_business_snapshot", {
    p_snapshot_id: snapshotId,
  });
  if (error) translateError(error);
  const o = (data ?? {}) as Record<string, unknown>;
  return {
    ok: o.ok === true,
    error: typeof o.error === "string" ? o.error : null,
    message:
      typeof o.message === "string" ? o.message : "Não foi possível revisar o retrato do negócio.",
    missingCoreGroups: Array.isArray(o.missingCoreGroups)
      ? o.missingCoreGroups.map((x) => String(x))
      : [],
  };
}

/** Leitura agregada do retrato para a etapa da Jornada e para a Home. */
export async function fetchBusinessPortrait(
  businessUnitId: string,
  profile: { sectorCode: string; businessModel?: string | null } | null,
): Promise<BusinessFactsInput> {
  const [definitions, snapshot] = await Promise.all([
    fetchApplicableFactDefinitions(profile),
    fetchLatestBusinessSnapshot(businessUnitId),
  ]);
  const values = snapshot ? await fetchBusinessFactValues(snapshot.id) : [];
  return { definitions, snapshot, values };
}
