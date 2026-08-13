// FASE F8.1-A — modo avançado: texto livre nunca é a experiência principal.
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function AdvancedSection({
  title,
  microcopy,
  children,
}: {
  title: string;
  microcopy: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-dashed">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t p-3">
          <p className="text-xs text-muted-foreground">{microcopy}</p>
          {children}
        </div>
      ) : null}
    </section>
  );
}
