// FASE F2 — formulário administrativo genérico (criar/editar).
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldType = "text" | "textarea" | "date" | "time" | "number" | "select" | "switch";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: string;
  hidden?: boolean;
};

export type FormValues = Record<string, string | boolean>;

export function RecordDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  submitLabel = "Salvar",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: Field[];
  initial?: FormValues;
  submitLabel?: string;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(initial ?? {});
      setErrors({});
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = fields.filter((f) => !f.hidden);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    for (const f of visible) {
      if (!f.required) continue;
      const v = values[f.name];
      if (v === undefined || v === null || String(v).trim() === "") {
        next[f.name] = "Campo obrigatório.";
      }
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {visible.map((f) => {
            const id = `f-${f.name}`;
            const value = values[f.name];
            const err = errors[f.name];
            return (
              <div key={f.name} className="space-y-1.5">
                {f.type === "switch" ? (
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor={id}>{f.label}</Label>
                    <Switch
                      id={id}
                      checked={Boolean(value)}
                      onCheckedChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                    />
                  </div>
                ) : (
                  <>
                    <Label htmlFor={id}>
                      {f.label}
                      {f.required ? <span className="ml-0.5 text-destructive">*</span> : null}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        id={id}
                        rows={3}
                        placeholder={f.placeholder}
                        value={String(value ?? "")}
                        aria-invalid={Boolean(err)}
                        onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                      />
                    ) : f.type === "select" ? (
                      <Select
                        value={String(value ?? "")}
                        onValueChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                      >
                        <SelectTrigger id={id} aria-invalid={Boolean(err)}>
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        type={
                          f.type === "number"
                            ? "number"
                            : f.type === "date"
                              ? "date"
                              : f.type === "time"
                                ? "time"
                                : "text"
                        }
                        placeholder={f.placeholder}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={String(value ?? "")}
                        aria-invalid={Boolean(err)}
                        onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                      />
                    )}
                  </>
                )}
                {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
                {err ? <p className="text-xs font-medium text-destructive">{err}</p> : null}
              </div>
            );
          })}

          {formError ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function toNullable(v: string | boolean | undefined) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}
export function toNumeric(v: string | boolean | undefined) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
