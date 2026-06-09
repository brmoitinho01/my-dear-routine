import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardCheck, AlertTriangle, BarChart3, Sparkles, MoreHorizontal, LogOut, Users, Settings } from "lucide-react";
import { useAuth, ROLE_LABEL } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Hoje", icon: ClipboardCheck, exact: true },
  { to: "/nao-conformidades", label: "NCs", icon: AlertTriangle },
  { to: "/dashboard", label: "Painel", icon: BarChart3 },
  { to: "/ia", label: "IA", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, profile, signOut, isAdmin, isManager } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">MQ</div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">Meu Querido</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rotina &amp; Padrão</div>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{profile?.full_name || user?.email}</div>
                <div className="text-xs text-muted-foreground">
                  {roles.length ? roles.map((r) => ROLE_LABEL[r]).join(" · ") : "Sem papel"}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/planos-acao">Planos de ação</Link>
              </DropdownMenuItem>
              {isManager && (
                <DropdownMenuItem asChild>
                  <Link to="/admin/checklists"><Settings className="mr-2 h-4 w-4" />Checklists</Link>
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin/usuarios"><Users className="mr-2 h-4 w-4" />Usuários</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 pt-4 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-3xl grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={
                  "flex flex-col items-center justify-center py-2.5 text-xs gap-0.5 " +
                  (active ? "text-primary font-medium" : "text-muted-foreground")
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}