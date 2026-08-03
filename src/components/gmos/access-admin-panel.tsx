// FASE F7 — administração de acessos. A validação real acontece nas RPCs do banco.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { useAuthz } from "@/components/gmos/authz-context";
import { assignRole, fetchDirectory, fetchRoleOptions, revokeRole } from "@/lib/gmos/access-admin";
import { ROLE_LABEL } from "@/lib/gmos/rbac";
import { scopeTypeLabel } from "@/lib/gmos/structure";

const ASSIGNMENT_STATUS: Record<string, string> = {
  pending: "Pendente",
  active: "Ativa",
  revoked: "Revogada",
  expired: "Expirada",
};

export function AccessAdminPanel() {
  const { authz } = useAuthz();
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [justification, setJustification] = useState("");

  const directory = useQuery({
    queryKey: ["gmos", "directory"],
    queryFn: fetchDirectory,
    retry: false,
  });
  const roles = useQuery({ queryKey: ["gmos", "roles"], queryFn: fetchRoleOptions, retry: false });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["gmos", "directory"] });
    void qc.invalidateQueries({ queryKey: ["gmos", "authorization"] });
    void qc.invalidateQueries({ queryKey: ["gmos", "my-access"] });
  };

  const assign = useMutation({
    mutationFn: () => assignRole({ userId, roleCode, scopeId, justification }),
    onSuccess: () => {
      toast.success("Papel atribuído.");
      setJustification("");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atribuir o papel."),
  });

  const revoke = useMutation({
    mutationFn: (input: { id: string; justification: string }) =>
      revokeRole(input.id, input.justification),
    onSuccess: () => {
      toast.success("Atribuição revogada.");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível revogar a atribuição."),
  });

  const scopes = (authz?.payload.scopes ?? [])
    .filter((s) => s.status === "active")
    .sort((a, b) => a.scope_type.localeCompare(b.scope_type) || a.label.localeCompare(b.label, "pt-BR"));

  const canSubmit =
    userId.length > 0 && roleCode.length > 0 && scopeId.length > 0 && justification.trim().length >= 10;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Administração de acessos</h2>
      <p className="text-xs text-muted-foreground">
        Concessões e revogações são validadas no banco e registradas em auditoria. Endereços de
        e-mail não são expostos por este cadastro.
      </p>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Usuário</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o usuário" />
              </SelectTrigger>
              <SelectContent>
                {(directory.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.id.slice(0, 8)} · {u.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={roleCode} onValueChange={setRoleCode}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                {(roles.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.code}>
                    {ROLE_LABEL[r.code] ?? r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Escopo</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o escopo" />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {scopeTypeLabel(s.scope_type)} · {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="justificativa">Justificativa (mínimo 10 caracteres)</Label>
            <Input
              id="justificativa"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Motivo da concessão"
            />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={!canSubmit || assign.isPending} onClick={() => assign.mutate()}>
              Atribuir papel
            </Button>
          </div>
        </CardContent>
      </Card>

      {directory.isPending || roles.isPending ? <LoadingBlock rows={2} /> : null}
      {directory.error ? (
        <ErrorBlock error={directory.error} onRetry={() => directory.refetch()} />
      ) : null}

      {directory.data && directory.data.length === 0 ? (
        <StateCard
          title="Nenhum usuário visível"
          description="Seu perfil não tem visibilidade sobre outros usuários deste Grupo."
        />
      ) : null}

      {(directory.data ?? []).map((u) => (
        <Card key={u.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Usuário {u.id.slice(0, 8)}</span>
              <Badge variant="outline">{u.status}</Badge>
            </div>
            {u.assignments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem papéis atribuídos.</p>
            ) : (
              <ul className="space-y-2">
                {u.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{ROLE_LABEL[a.roleCode] ?? a.roleName}</span>
                    <span className="text-xs text-muted-foreground">
                      {scopeTypeLabel(a.scopeType)} · {a.scopeLabel}
                    </span>
                    <Badge variant={a.status === "active" ? "secondary" : "outline"}>
                      {ASSIGNMENT_STATUS[a.status] ?? a.status}
                    </Badge>
                    {a.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revoke.isPending}
                        onClick={() => {
                          const reason = window.prompt(
                            "Justificativa da revogação (mínimo 10 caracteres):",
                          );
                          if (!reason || reason.trim().length < 10) {
                            toast.error("Justificativa obrigatória com pelo menos 10 caracteres.");
                            return;
                          }
                          revoke.mutate({ id: a.id, justification: reason.trim() });
                        }}
                      >
                        Revogar
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}