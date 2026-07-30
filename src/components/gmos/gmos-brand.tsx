// FASE F4 — marca GMOS: símbolo geométrico local em SVG, sem imagem externa.
import { cn } from "@/lib/utils";

export function GmosMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Símbolo GMOS"
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M8 22V13.5A5.5 5.5 0 0 1 19 13.5V22"
        stroke="var(--brand-foreground)"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="23" cy="21" r="3.2" fill="var(--brand-accent)" />
    </svg>
  );
}

export function GmosBrand({
  className,
  subtitle = "Grupo Moitinho",
  tone = "default",
  size = "md",
}: {
  className?: string;
  subtitle?: string | null;
  tone?: "default" | "inverted";
  size?: "sm" | "md" | "lg";
}) {
  const title = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <GmosMark className={size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-9 w-9"} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block truncate font-semibold tracking-tight",
            title,
            tone === "inverted" ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          GMOS
        </span>
        {subtitle ? (
          <span
            className={cn(
              "block truncate text-[11px] uppercase tracking-[0.14em]",
              tone === "inverted" ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
