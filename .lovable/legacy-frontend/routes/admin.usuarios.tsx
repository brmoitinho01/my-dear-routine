import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, ROLE_LABEL, type AppRole } from "@/lib/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({ meta: [{ title: "Admin · Usuários — Meu Querido" }] }),
  component: AdminUsers,
});

const ROLES: AppRole[] = ["admin", "gerente", "lider_setor", "operador"];

function AdminUsers() {
  const { isAdmin, sectors } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: us }] = await Promise.all([
        supabase.from("users_profile").select("id, full_name, primary_sector_id"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_sectors").select("user_id, sector_id"),
      ]);
      return { profiles: profiles ?? [], roles: roles ?? [], us: us ?? [] };
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Acesso restrito a Admin.</p>;

  async function setRole(userId: string, role: AppRole, has: boolean) {
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function setPrimarySector(userId: string, sectorId: string) {
    await supabase.from("users_profile").update({ primary_sector_id: sectorId || null }).eq("id", userId);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function toggleSector(userId: string, sectorId: string, has: boolean) {
    if (has) {
      await supabase.from("user_sectors").delete().eq("user_id", userId).eq("sector_id", sectorId);
    } else {
      const { error } = await supabase.from("user_sectors").insert({ user_id: userId, sector_id: sectorId });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">Papéis e setores.</p>
      </header>
      <div className="grid gap-2">
        {(data?.profiles ?? []).map((p) => {
          const userRoles = (data?.roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole);
          const userSectors = (data?.us ?? []).filter((x) => x.user_id === p.id).map((x) => x.sector_id);
          return (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="font-medium flex-1 truncate">{p.full_name || p.id.slice(0, 8)}</div>
                  <div className="flex gap-1 flex-wrap">
                    {userRoles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Papéis</div>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((r) => {
                      const has = userRoles.includes(r);
                      return (
                        <Button key={r} size="sm" variant={has ? "default" : "outline"} onClick={() => setRole(p.id, r, has)}>
                          {ROLE_LABEL[r]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Setor principal</div>
                  <Select value={p.primary_sector_id ?? ""} onValueChange={(v) => setPrimarySector(p.id, v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Setores adicionais</div>
                  <div className="flex flex-wrap gap-3">
                    {sectors.map((s) => {
                      const has = userSectors.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-1.5 text-sm">
                          <Checkbox checked={has} onCheckedChange={() => toggleSector(p.id, s.id, has)} />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}