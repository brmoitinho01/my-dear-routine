import { FlaskConical } from "lucide-react";
import { DEMO_DISCLAIMER, DEMO_TITLE } from "@/lib/gmos/demo";
import { cn } from "@/lib/utils";

/** Aviso discreto exibido apenas quando o contexto selecionado contém o lote demonstrativo. */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-brand-accent/40 bg-accent/40 px-3 py-2.5",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" aria-hidden />
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-semibold text-accent-foreground">{DEMO_TITLE}</p>
        <p className="text-accent-foreground/80">{DEMO_DISCLAIMER}</p>
      </div>
    </div>
  );
}
