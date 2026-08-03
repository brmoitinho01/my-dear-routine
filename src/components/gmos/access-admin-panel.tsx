// FASE F7 — administração de atribuições de papel.
// Nada é decidido aqui: atribuir e revogar passam por RPC transacional que revalida
// permissão, compatibilidade de escopo, justificativa e o último proprietário do Grupo.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { assignRole, fetchIamDirectory, revokeRole } from "@/lib/gmos/iam";
import { roleLabel } from "@/lib/gmos/rbac";
import { scopeTypeLabel } from "@/lib/gmos/structure";
import { useAuth } from "@/lib/auth-context";

const MIN_JUSTIFICATION = 10;

export function AccessAdminPanel() {
  const { can, isGroupPrivileged, userId } = useAuth();
  const qc = useQueryClient();
  const canAssign = can("role.assign");
  const canRevoke = can("role.revoke");

  const directory = useQuery({
    queryKey: ["gmos", "iam-directory"],
    queryFn: fetchIamDirectory,
    retry: false,
  });

  const [targetUser, setTargetUser] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [justification, setJustification] = useState("");
  const [revokeJustification, setRevokeJustification] = useState<Record<string, string>>({});

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["gmos", "iam-directory"] });
    void qc.invalidateQueries({ queryKey: ["gmos", "my-access"] });
    void qc.invalidateQueries({ queryKey: ["gmos", "authorization"] });
  };

  const assign = useMutation({
    mutationFn: assignRole,
    onSuccess: () => {
      toast.success("Papel atribuído e registrado em auditoria.");
      setTargetUser("");
      setRoleCode("");
      setScopeId("");
      setJustification("");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atribuir o papel."),
  });

  const revoke = useMutation({
    mutationFn: revokeRole,
    onSuccess: () => {
      toast.success("Papel revogado e registrado em auditoria.");
      setRevokeJustification({});
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível revogar o papel."),
  });

  const roles = useMemo(
    () =>
      (directory.data?.assignableRoles ?? []).filter((r) =>
        // papéis de Grupo só por perfis privilegiados; o banco revalida.
        r.code === "group_owner" || r.code === "group_admin" ? isGroupPrivileged : true,
      ),
    [directory.data, isGroupPrivileged],
  );

  if (directory.isPending) return <LoadingBlock rows={3} />;
  if (directory.error)
    return <ErrorBlock error={directory.error} onRetry={() => directory.refetch()} />;

  const users = directory.data?.users ?? [];
  const scopes = directory.data?.scopes ?? [];
  const justificationTooShort = justification.trim().length < MIN_JUSTIFICATION;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Administração de acessos</h2>
      </div>

      {canAssign ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Atribuir papel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="iam-user">Usuário interno</Label>
                {users.length > 0 ? (
                  <Select value={targetUser} onValueChange={setTargetUser}>
                    <SelectTrigger id="iam-user">
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.userId !== userId)
                        .map((u) => (
                          <SelectItem key={u.userId} value={u.userId}>
                            {u.userId.slice(0, 8)} — {u.status}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="iam-user"
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    placeholder="Identificador do usuário interno"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iam-role">Papel</Label>
                <Select value={roleCode} onValueChange={setRoleCode}>
                  <SelectTrigger id="iam-role">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {roleLabel(r.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iam-scope">Escopo</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger id="iam-scope">
                  <SelectValue placeholder="Selecione o escopo" />
                </SelectTrigger>
                <SelectContent>
                  {scopes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {scopeTypeLabel(s.scopeType)} — {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iam-justification">Justificativa (mínimo 10 caracteres)</Label>
              <Textarea
                id="iam-justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Motivo da concessão, para trilha de auditoria."
                rows={2}
              />
            </div>
            <Button
              size="sm"
              disabled={
                assign.isPending ||
                !targetUser ||
                !roleCode ||
                !scopeId ||
                justificationTooShort
              }
              onClick={() =>
                assign.mutate({
                  userId: targetUser,
                  roleCode,
                  scopeId,
                  justification: justification.trim(),
                })
              }
            >
              {assign.isPending ? "Atribuindo…" : "Atribuir papel"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Usuários e papéis visíveis para você
        </h3>
        {users.length === 0 ? (
          <StateCard
            title="Nenhum usuário visível"
            description="Seu escopo de acesso não inclui outros usuários com papéis ativos."
          />
        ) : (
          users.map((u) => (
            <Card key={u.userId}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-mono text-xs">{u.userId}</span>
                  <Badge variant="outline" className="ml-auto">
                    {u.status}
                  </Badge>
                </div>
                {u.assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem papéis registrados.</p>
                ) : (
                  u.assignments.map((a) => (
                    <div key={a.id} className="space-y-2 rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{roleLabel(a.roleCode)}</span>
                        <Badge variant="outline">{scopeTypeLabel(a.scopeType)}</Badge>
                        <span className="text-sm text-muted-foreground">{a.scopeLabel}</span>
                        <Badge
                          variant={a.status === "active" ? "secondary" : "outline"}
                          className="ml-auto"
                        >
                          {a.status}
                        </Badge>
                      </div>
                      {canRevoke && a.status === "active" && a.userId !== userId ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={revokeJustification[a.id] ?? ""}
                            onChange={(e) =>
                              setRevokeJustification((prev) => ({
                                ...prev,
                                [a.id]: e.target.value,
                              }))
                            }
                            placeholder="Justificativa da revogação (mínimo 10 caracteres)"
                            aria-label="Justificativa da revogação"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              revoke.isPending ||
                              (revokeJustification[a.id] ?? "").trim().length < MIN_JUSTIFICATION
                            }
                            onClick={() =>
                              revoke.mutate({
                                assignmentId: a.id,
                                justification: (revokeJustification[a.id] ?? "").trim(),
                              })
                            }
                          >
                            Revogar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}