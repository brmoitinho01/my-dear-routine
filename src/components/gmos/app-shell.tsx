// FASE F4 — casca corporativa: sidebar em desktop, cabeçalho + menu em mobile.
// O seletor Empresa/Filial é preferência de UX e não concede privilégios.
import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Network,
  Presentation,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GmosBrand, GmosMark } from "@/components/gmos/gmos-brand";
import { useWorkspace } from "@/components/gmos/workspace-context";
import { RoleBadge } from "@/components/gmos/permission-gate";
import { NAV_ITEMS, filterNav, type NavKey } from "@/lib/gmos/navigation";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Rotas literais + ícone por item de navegação. A visibilidade vem de filterNav (permissões).
const NAV_TARGET: Record<NavKey, { to: string; icon: typeof LayoutDashboard }> = {
  inicio: { to: "/", icon: LayoutDashboard },
  "meu-trabalho": { to: "/meu-trabalho", icon: ClipboardCheck },
  "painel-equipe": { to: "/painel-equipe", icon: Users },
  "painel-grupo": { to: "/painel-grupo", icon: Building2 },
  metodo: { to: "/metodo", icon: Compass },
  "jornada-estrategica": { to: "/jornada-estrategica", icon: Compass },
  planejamento: { to: "/planejamento", icon: Target },
  "planos-de-acao": { to: "/planos-de-acao", icon: ListChecks },
  rotinas: { to: "/rotinas", icon: CalendarClock },
  apresentacao: { to: "/apresentacao", icon: Presentation },
  estrutura: { to: "/estrutura", icon: Network },
  organograma: { to: "/organograma", icon: Users },
  acessos: { to: "/acessos", icon: ShieldCheck },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut, authorization } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { options, workspace, selectUnit } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = filterNav(NAV_ITEMS, authorization);

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
      {navItems.map((item) => {
        const target = NAV_TARGET[item.key];
        const Icon = target.icon;
        const active = pathname === target.to;
        return (
          <Link
            key={item.key}
            to={target.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon
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
      <RoleBadge />
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
        <Link to="/" className="block">
          <GmosBrand tone="inverted" />
        </Link>
        {contextSelectors}
        <div className="flex-1 overflow-y-auto">{navList()}</div>
        {userBlock}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
            <Link to="/" className="flex min-w-0 items-center gap-2">
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
