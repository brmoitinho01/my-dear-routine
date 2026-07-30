// FASE F4 — mapa de capacidades. "Próxima evolução" nunca é apresentado como disponível.
import type { ReactNode } from "react";
import { Check, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type Capability = { title: string; description: string };

export function CapabilityCard({
  title,
  description,
  items,
  variant,
  footer,
}: {
  title: string;
  description: string;
  items: Capability[];
  variant: "available" | "next";
  footer?: ReactNode;
}) {
  const available = variant === "available";
  return (
    <Card className={available ? "border-brand-accent/50" : "border-dashed"}>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <Badge variant={available ? "default" : "outline"}>
            {available ? "Disponível agora" : "Próxima evolução"}
          </Badge>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li key={it.title} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0">
                {available ? (
                  <Check className="h-4 w-4 text-success" aria-hidden />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{it.title}</span>
                <span className="block text-xs text-muted-foreground">{it.description}</span>
              </span>
            </li>
          ))}
        </ul>
        {footer}
      </CardContent>
    </Card>
  );
}
