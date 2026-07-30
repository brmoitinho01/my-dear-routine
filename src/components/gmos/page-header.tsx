// FASE F4 — cabeçalho padrão das telas operacionais, com contexto e ações.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; to?: "/" | "/apresentacao" };

export function PageHeader({
  title,
  description,
  crumbs,
  context,
  actions,
  className,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  context?: string | null;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3 border-b pb-4", className)}>
      {crumbs?.length ? (
        <nav aria-label="Trilha de navegação">
          <ol className="flex flex-wrap items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3" aria-hidden /> : null}
                {c.to ? (
                  <Link to={c.to} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {context ? (
            <p className="mt-1 text-xs font-medium text-brand-accent-foreground/80">{context}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
