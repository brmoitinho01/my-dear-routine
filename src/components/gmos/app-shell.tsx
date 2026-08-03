// FASE F4 — casca corporativa: sidebar em desktop, cabeçalho + menu em mobile.
// O seletor Empresa/Filial é preferência de UX e não concede privilégios.
import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Compass,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Network,
  Presentation,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GmosBrand, GmosMark } from "@/components/gmos/gmos-brand";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/metodo", label: "Método GMOS", icon: Compass },
  { to: "/planejamento", label: "Planejamento", icon: Target },
  { to: "/planos-de-acao", label: "Planos de ação", icon: ListChecks },
  { to: "/rotinas", label: "Rotinas", icon: CalendarClock },
  { to: "/apresentacao", label: "Apresentação", icon: Presentation },
  { to: "/estrutura", label: "Estrutura", icon: Network },
  { to: "/acessos", label: "Acessos", icon: ShieldCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { options, workspace, selectUnit } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

  const companies = Array.from(
    new Map(options.map((o) => [o.companyId, { id: o.companyId, name: o.companyName }])).values(),
  );
  const units = options.filter((o) => o.companyId === workspace?.companyId);

  function handleCompanyChange(companyId: string) {
    const first = options.find((o) => o.companyId === companyId);
    if (first) selectUnit(first.businessUnitId);
  }

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const contextSelectors =
    options.length > 0 ? (
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/60">
          Contexto
        </p>
        <Select value={workspace?.companyId ?? ""} onValueChange={handleCompanyChange}>
          <SelectTrigger
            className="h-9 w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
            aria-label="Empresa"
          >
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workspace?.businessUnitId ?? ""} onValueChange={selectUnit}>
          <SelectTrigger
            className="h-9 w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
            aria-label="Filial"
          >
            <SelectValue placeholder="Filial" />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.businessUnitId} value={u.businessUnitId}>
                {u.businessUnitName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  const navList = (onNavigate?: () => void) => (
    <nav aria-label="Navegação principal" className="space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <item.icon
              className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")}
              aria-hidden
            />
            <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="space-y-2 border-t border-sidebar-border pt-3">
      <p className="truncate text-xs text-sidebar-foreground/70">{user?.email ?? "—"}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="mr-2 h-4 w-4" aria-hidden />
        Sair
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 bg-sidebar p-4 lg:flex">
        <Link to="/apresentacao" className="block">
          <GmosBrand tone="inverted" />
        </Link>
        {contextSelectors}
        <div className="flex-1 overflow-y-auto">{navList()}</div>
        {userBlock}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
            <Link to="/apresentacao" className="flex min-w-0 items-center gap-2">
              <GmosMark className="h-8 w-8 shrink-0" />
              <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
                GMOS <span className="font-normal text-muted-foreground">· Grupo Moitinho</span>
              </span>
            </Link>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Abrir menu">
                  <Menu className="h-4 w-4" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[17rem] bg-sidebar p-4">
                <SheetTitle className="sr-only">Menu do GMOS</SheetTitle>
                <div className="flex h-full flex-col gap-5 overflow-y-auto">
                  <GmosBrand tone="inverted" />
                  {contextSelectors}
                  <div className="flex-1">{navList(() => setMenuOpen(false))}</div>
                  {userBlock}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
