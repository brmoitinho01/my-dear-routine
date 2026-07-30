import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Network, ShieldCheck, LogOut, Target, ListChecks, CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/estrutura", label: "Estrutura", icon: Network },
  { to: "/planejamento", label: "Planejamento", icon: Target },
  { to: "/planos-de-acao", label: "Planos de ação", icon: ListChecks },
  { to: "/rotinas", label: "Rotinas", icon: CalendarClock },
  { to: "/acessos", label: "Acessos", icon: ShieldCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              GM
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">GMOS</p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>

        <nav className="mx-auto hidden w-full max-w-5xl gap-1 overflow-x-auto px-4 pb-2 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === item.to && "bg-accent text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:pb-12">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-5xl overflow-x-auto">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 px-1 py-2.5 text-center text-[10px] font-medium leading-tight text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}