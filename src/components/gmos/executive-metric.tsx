// FASE F4 — métrica executiva. Exibe apenas números reais; zero é exibido como zero.
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ExecutiveMetric({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  hint?: string;
  tone?: "default" | "alert";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          <span className="min-w-0 truncate">{label}</span>
        </div>
        <p
          className={cn(
            "mt-2 text-2xl font-bold tabular-nums",
            tone === "alert" && Number(value) > 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
