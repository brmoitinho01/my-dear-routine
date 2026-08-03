// FASE F8.5 — Organograma funcional: cargos, ocupantes, definição da função e lacunas.
// Nenhum nome, cargo ou atribuição é sugerido pelo sistema: todo dado vem do cadastro real.
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ListTree, Network, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBlock, LoadingBlock, StateCard } from "@/components/gmos/states";
import { PageHeader } from "@/components/gmos/page-header";
import { RequirePermission } from "@/components/gmos/permission-gate";
import { ConfirmAction } from "@/components/gmos/confirm-dialog";
import { RecordDialog, type Field, type FormValues } from "@/components/gmos/record-dialog";

function nul(value: string | boolean | undefined): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}
import { useAuth } from "@/lib/auth-context";
import { scopeTypeLabel } from "@/lib/gmos/structure";
import {
  assignPerson,
  buildOrgTree,
  createPerson,
  createPosition,
  definitionLabel,
  endAssignment,
  fetchOrgChart,
  flattenTree,
  matchesFilters,
  orgManagementActions,
  orgSummary,
  responsibilitySummary,
  setPersonStatus,
  setPositionStatus,
  updatePerson,
  updatePosition,
  validateOrgChart,
  type OrgPosition,
  type OrgTreeNode,
  type Situation,
} from "@/lib/gmos/org-chart";

export const Route = createFileRoute("/_authenticated/organograma")({
  head: () => ({
    meta: [
      { title: "Organograma funcional — GMOS Grupo Moitinho" },
      {
        name: "description",
        content:
          "Cargos, ocupantes, propósito da função, autoridade de decisão e lacunas de responsabilidade do Grupo Moitinho.",
      },
      { property: "og:title", content: "Organograma funcional — GMOS Grupo Moitinho" },
      {
        property: "og:description",
        content:
          "Cargos, ocupantes, propósito da função, autoridade de decisão e lacunas de responsabilidade do Grupo Moitinho.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequirePermission permission="structure.read" area="visualizar o organograma">
      <OrganogramaPage />
    </RequirePermission>
  ),
});

const ASSIGNMENT_LABEL: Record<string, string> = {
  primary: "Titular",
  acting: "Substituto",
  support: "Apoio",
};

function OrganogramaPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [situation, setSituation] = useState<Situation>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [positionDialog, setPositionDialog] = useState<{ position: OrgPosition | null } | null>(
    null,
  );
  const [personDialog, setPersonDialog] = useState<{ personId: string | null } | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ positionId: string } | null>(null);

  const query = useQuery({
    queryKey: ["gmos", "org-chart"],
    queryFn: fetchOrgChart,
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gmos", "org-chart"] });
  const act = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      invalidate();
      toast.success("Organograma atualizado.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const data = query.data;
  const tree = useMemo(
    () => (data ? buildOrgTree(data.positions, data.assignments, data.people) : []),
    [data],
  );
  const nodes = useMemo(() => flattenTree(tree), [tree]);
  const issues = useMemo(
    () =>
      data
        ? validateOrgChart({
            positions: data.positions,
            people: data.people,
            assignments: data.assignments,
            scopes: data.scopes,
          })
        : [],
    [data],
  );
  const summary = useMemo(
    () => (data ? orgSummary(data.positions, data.people, data.assignments) : null),
    [data],
  );
  const responsibilities = useMemo(
    () =>
      data
        ? responsibilitySummary(data.people, data.assignments, data.positions, data.workloadByUser)
        : [],
    [data],
  );

  if (query.isPending) return <LoadingBlock rows={4} />;
  if (query.error) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;
  if (!data) return <StateCard title="Sem dados" description="Nada a exibir." />;

  const scopeById = new Map(data.scopes.map((s) => [s.id, s]));
  const manageScope = (scopeId: string) => can("structure.manage", scopeId);
  const canManageAnywhere = can("structure.manage");
  const actions = orgManagementActions(canManageAnywhere);

  const filters = {
    search,
    scopeId: scopeFilter === "all" ? null : scopeFilter,
    status: statusFilter,
    situation,
  };
  const visibleNodes = nodes.filter((n) => matchesFilters(n, filters));
  const visibleIds = new Set(visibleNodes.map((n) => n.position.id));
  const selected = nodes.find((n) => n.position.id === selectedId) ?? null;
  const peopleWithoutPosition = responsibilities.filter(
    (r) => r.person.status === "active" && r.positionTitles.length === 0,
  );
  const organizationId = data.organizationId ?? data.scopes[0]?.organization_id ?? null;

  const scopeOptions = data.scopes
    .filter((s) => s.status === "active")
    .map((s) => ({ value: s.id, label: `${s.label} · ${scopeTypeLabel(s.scope_type)}` }));

  const positionFields: Field[] = [
    { name: "title", label: "Cargo / posição", type: "text", required: true },
    {
      name: "scope_id",
      label: "Escopo de atuação",
      type: "select",
      required: true,
      options: scopeOptions,
      help: "Grupo, empresa, filial ou área onde a posição atua.",
    },
    {
      name: "parent_position_id",
      label: "Responde a",
      type: "select",
      options: [
        { value: "none", label: "Posição raiz (sem chefia)" },
        ...data.positions.map((p) => ({ value: p.id, label: p.title })),
      ],
    },
    { name: "purpose", label: "Propósito da função", type: "textarea" },
    { name: "responsibilities_text", label: "Responsabilidades principais", type: "textarea" },
    { name: "decision_authority_text", label: "Autoridade de decisão", type: "textarea" },
    { name: "key_deliverables_text", label: "Entregas-chave", type: "textarea" },
    {
      name: "expected_headcount",
      label: "Titulares previstos",
      type: "number",
      min: 1,
      required: true,
    },
    { name: "sort_order", label: "Ordem de exibição", type: "number" },
  ];

  const personFields: Field[] = [
    { name: "full_name", label: "Nome completo", type: "text", required: true },
    {
      name: "home_scope_id",
      label: "Escopo de atuação",
      type: "select",
      required: true,
      options: scopeOptions,
    },
    { name: "work_email", label: "E-mail de trabalho", type: "text" },
    { name: "employee_code", label: "Código de colaborador", type: "text" },
    {
      name: "user_id",
      label: "Usuário interno vinculado",
      type: "select",
      options: [
        { value: "none", label: "Sem acesso vinculado" },
        ...(data.people
          .map((p) => p.userId)
          .filter((id): id is string => Boolean(id))
          .map((id) => ({ value: id, label: id.slice(0, 8) })) ?? []),
      ],
      help: "Opcional. Sem vínculo, a pessoa não recebe itens executáveis do GMOS.",
    },
  ];

  const editingPerson = personDialog?.personId
    ? data.people.find((p) => p.id === personDialog.personId)
    : null;

  const assignFields: Field[] = [
    {
      name: "person_id",
      label: "Pessoa",
      type: "select",
      required: true,
      options: data.people
        .filter((p) => p.status === "active")
        .map((p) => ({ value: p.id, label: p.fullName })),
    },
    {
      name: "assignment_type",
      label: "Tipo de ocupação",
      type: "select",
      required: true,
      options: [
        { value: "primary", label: "Titular" },
        { value: "acting", label: "Substituto" },
        { value: "support", label: "Apoio" },
      ],
    },
    { name: "start_date", label: "Início", type: "date", required: true },
    { name: "notes", label: "Observações", type: "textarea" },
  ];

  const empty = data.positions.length === 0 && data.people.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: "GMOS", to: "/apresentacao" }, { label: "Organograma" }]}
        title="Organograma funcional"
        description="Cargos reais, ocupantes, definição da função e lacunas de responsabilidade. Nenhum dado é inventado pelo sistema."
      />

      {empty ? (
        <StateCard
          title="Organograma ainda não cadastrado"
          description="Cadastre primeiro as posições, depois as pessoas e por fim as atribuições. Enquanto isso, nada é preenchido automaticamente."
        />
      ) : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryTile label="Posições ativas" value={summary.activePositions} />
          <SummaryTile label="Ocupadas" value={summary.occupied} />
          <SummaryTile label="Vagas" value={summary.vacant} tone={summary.vacant > 0} />
          <SummaryTile
            label="Pessoas sem posição"
            value={summary.peopleWithoutPosition}
            tone={summary.peopleWithoutPosition > 0}
          />
          <SummaryTile
            label="Funções incompletas"
            value={summary.incompleteDefinitions}
            tone={summary.incompleteDefinitions > 0}
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pessoa ou cargo"
            aria-label="Buscar pessoa ou cargo"
          />
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger aria-label="Filtrar por escopo">
              <SelectValue placeholder="Escopo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os escopos</SelectItem>
              {scopeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}
          >
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Somente ativas</SelectItem>
              <SelectItem value="inactive">Somente inativas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={situation} onValueChange={(v) => setSituation(v as Situation)}>
            <SelectTrigger aria-label="Filtrar por situação">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer situação</SelectItem>
              <SelectItem value="occupied">Ocupada</SelectItem>
              <SelectItem value="vacant">Vaga</SelectItem>
              <SelectItem value="incomplete">Função incompleta</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {actions.canCreatePosition || actions.canCreatePerson ? (
        <div className="flex flex-wrap gap-2">
          {actions.canCreatePosition ? (
            <Button size="sm" onClick={() => setPositionDialog({ position: null })}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova posição
            </Button>
          ) : null}
          {actions.canCreatePerson ? (
            <Button size="sm" variant="outline" onClick={() => setPersonDialog({ personId: null })}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Nova pessoa
            </Button>
          ) : null}
        </div>
      ) : (
        <StateCard
          title="Somente leitura"
          description="Você pode consultar o organograma, mas não possui permissão de gestão da estrutura no escopo selecionado."
        />
      )}

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">
            <ListTree className="mr-1.5 h-4 w-4" /> Lista
          </TabsTrigger>
          <TabsTrigger value="arvore">
            <Network className="mr-1.5 h-4 w-4" /> Árvore
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4 space-y-2">
          {visibleNodes.length === 0 ? (
            <StateCard
              title="Nenhuma posição encontrada"
              description="Ajuste a busca ou os filtros para ver as posições cadastradas."
            />
          ) : (
            visibleNodes.map((node) => (
              <PositionRow
                key={node.position.id}
                node={node}
                scopeLabel={scopeById.get(node.position.scopeId)?.label ?? "—"}
                onSelect={() => setSelectedId(node.position.id)}
                selected={selectedId === node.position.id}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="arvore" className="mt-4">
          {tree.length === 0 ? (
            <StateCard
              title="Nenhuma posição cadastrada"
              description="Cadastre as posições para visualizar a árvore hierárquica."
            />
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-4">
                <TreeBranch
                  nodes={tree}
                  visibleIds={visibleIds}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selected ? (
        <PositionDetail
          node={selected}
          scopeLabel={scopeById.get(selected.position.scopeId)?.label ?? "—"}
          parentTitle={
            selected.position.parentPositionId
              ? (data.positions.find((p) => p.id === selected.position.parentPositionId)?.title ??
                null)
              : null
          }
          issues={issues.filter((i) => i.positionId === selected.position.id)}
          responsibilities={responsibilities}
          canManage={manageScope(selected.position.scopeId)}
          onEdit={() => setPositionDialog({ position: selected.position })}
          onAssign={() => setAssignDialog({ positionId: selected.position.id })}
          onDeactivate={() =>
            act.mutate(() =>
              setPositionStatus(
                selected.position.id,
                selected.position.status === "active" ? "inactive" : "active",
              ),
            )
          }
          onEndAssignment={(id) =>
            act.mutate(() => endAssignment(id, new Date().toISOString().slice(0, 10)))
          }
        />
      ) : null}

      <section aria-labelledby="sem-posicao" className="space-y-2">
        <h2
          id="sem-posicao"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Pessoas sem posição definida
        </h2>
        {peopleWithoutPosition.length === 0 ? (
          <StateCard
            title="Nenhuma pendência"
            description="Todas as pessoas ativas cadastradas possuem ao menos uma ocupação registrada."
          />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {peopleWithoutPosition.map((r) => (
                <div key={r.person.id} className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-sm font-medium">{r.person.fullName}</span>
                  <Badge variant="outline">
                    {r.linkedUser ? "Acesso vinculado" : "Sem acesso vinculado"}
                  </Badge>
                  {r.hasWork ? (
                    <Badge variant="destructive">
                      Tem itens do GMOS atribuídos e nenhuma titularidade
                    </Badge>
                  ) : null}
                  {manageScope(r.person.homeScopeId) ? (
                    <div className="ml-auto flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPersonDialog({ personId: r.person.id })}
                      >
                        Editar
                      </Button>
                      <ConfirmAction
                        title="Inativar pessoa"
                        description="A pessoa deixa de aparecer como ativa no organograma. Nenhum dado é excluído."
                        actionLabel="Inativar"
                        onConfirm={() => act.mutate(() => setPersonStatus(r.person.id, "inactive"))}

                        trigger={
                          <Button size="sm" variant="ghost">
                            Inativar
                          </Button>
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <GovernanceAlerts issues={issues} />

      <StateCard
        title="Estrutura organizacional"
        description="O organograma reflete cargos e pessoas. A hierarquia jurídica de empresas, unidades e departamentos fica em Estrutura."
      >
        <Button asChild size="sm" variant="outline">
          <Link to="/estrutura">Abrir Estrutura</Link>
        </Button>
      </StateCard>

      {positionDialog && organizationId ? (
        <RecordDialog
          open
          onOpenChange={(v) => !v && setPositionDialog(null)}
          title={positionDialog.position ? "Editar posição" : "Nova posição"}
          description="Descreva a função com propósito, responsabilidades, autoridade e entregas-chave."
          fields={positionFields}
          initial={
            positionDialog.position
              ? {
                  title: positionDialog.position.title,
                  scope_id: positionDialog.position.scopeId,
                  parent_position_id: positionDialog.position.parentPositionId ?? "none",
                  purpose: positionDialog.position.purpose ?? "",
                  responsibilities_text: positionDialog.position.responsibilities ?? "",
                  decision_authority_text: positionDialog.position.decisionAuthority ?? "",
                  key_deliverables_text: positionDialog.position.keyDeliverables ?? "",
                  expected_headcount: String(positionDialog.position.expectedHeadcount),
                  sort_order: String(positionDialog.position.sortOrder),
                }
              : { expected_headcount: "1", sort_order: "0", parent_position_id: "none" }
          }
          onSubmit={async (values: FormValues) => {
            const input = {
              scopeId: String(values.scope_id),
              parentPositionId:
                values.parent_position_id && values.parent_position_id !== "none"
                  ? String(values.parent_position_id)
                  : null,
              title: String(values.title ?? ""),
              purpose: nul(values.purpose),
              responsibilities: nul(values.responsibilities_text),
              decisionAuthority: nul(values.decision_authority_text),
              keyDeliverables: nul(values.key_deliverables_text),
              expectedHeadcount: Math.max(1, Number(values.expected_headcount ?? 1) || 1),
              sortOrder: Number(values.sort_order ?? 0) || 0,
            };
            if (positionDialog.position) await updatePosition(positionDialog.position.id, input);
            else await createPosition(organizationId, input);
            setPositionDialog(null);
            invalidate();
            toast.success("Posição salva.");
          }}
        />
      ) : null}

      {personDialog && organizationId ? (
        <RecordDialog
          open
          onOpenChange={(v) => !v && setPersonDialog(null)}
          title={editingPerson ? "Editar pessoa" : "Nova pessoa"}
          description="Cadastre a pessoa real. O vínculo com usuário interno é opcional e só é necessário para executar itens do GMOS."
          fields={personFields}
          initial={
            editingPerson
              ? {
                  full_name: editingPerson.fullName,
                  home_scope_id: editingPerson.homeScopeId,
                  work_email: editingPerson.workEmail ?? "",
                  employee_code: editingPerson.employeeCode ?? "",
                  user_id: editingPerson.userId ?? "none",
                }
              : { user_id: "none" }
          }
          onSubmit={async (values: FormValues) => {
            const input = {
              homeScopeId: String(values.home_scope_id),
              fullName: String(values.full_name ?? ""),
              workEmail: nul(values.work_email),
              employeeCode: nul(values.employee_code),
              userId: values.user_id && values.user_id !== "none" ? String(values.user_id) : null,
            };
            if (editingPerson) await updatePerson(editingPerson.id, input);
            else await createPerson(organizationId, input);
            setPersonDialog(null);
            invalidate();
            toast.success("Pessoa salva.");
          }}
        />
      ) : null}

      {assignDialog && organizationId ? (
        <RecordDialog
          open
          onOpenChange={(v) => !v && setAssignDialog(null)}
          title="Atribuir pessoa à posição"
          description="Titular consome a vaga prevista; substituto e apoio não consomem."
          fields={assignFields}
          initial={{
            assignment_type: "primary",
            start_date: new Date().toISOString().slice(0, 10),
          }}
          onSubmit={async (values: FormValues) => {
            await assignPerson(organizationId, {
              positionId: assignDialog.positionId,
              personId: String(values.person_id),
              assignmentType: String(values.assignment_type ?? "primary") as
                "primary" | "acting" | "support",
              startDate: String(values.start_date),
              notes: nul(values.notes),
            });
            setAssignDialog(null);
            invalidate();
            toast.success("Ocupação registrada.");
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${tone ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PositionRow({
  node,
  scopeLabel,
  onSelect,
  selected,
}: {
  node: OrgTreeNode;
  scopeLabel: string;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <Card className={selected ? "border-primary" : undefined}>
      <CardContent className="p-3">
        <button type="button" onClick={onSelect} className="w-full text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{node.position.title}</span>
            <Badge variant="outline">{scopeLabel}</Badge>
            {node.position.status === "inactive" ? <Badge variant="outline">Inativa</Badge> : null}
            {node.vacant ? (
              <Badge variant="destructive">Vaga</Badge>
            ) : (
              <Badge variant="secondary">Ocupada</Badge>
            )}
            <Badge variant={node.completeness.complete ? "secondary" : "outline"}>
              Função {node.completeness.percent}%
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {node.occupants.length === 0
              ? "Responsável não definido"
              : node.occupants
                  .map(
                    (o) =>
                      `${o.person.fullName} (${ASSIGNMENT_LABEL[o.assignment.assignmentType]})`,
                  )
                  .join(" · ")}
          </p>
        </button>
      </CardContent>
    </Card>
  );
}

function TreeBranch({
  nodes,
  visibleIds,
  onSelect,
  selectedId,
}: {
  nodes: OrgTreeNode[];
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <ul className="space-y-2 border-l border-border pl-4">
      {nodes.map((node) => (
        <li key={node.position.id} className="relative">
          <span aria-hidden className="absolute -left-4 top-4 h-px w-4 bg-border" />
          <button
            type="button"
            onClick={() => onSelect(node.position.id)}
            className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
              selectedId === node.position.id ? "border-primary" : ""
            } ${visibleIds.has(node.position.id) ? "" : "opacity-50"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{node.position.title}</span>
              {node.vacant ? (
                <Badge variant="destructive">Vaga</Badge>
              ) : (
                <Badge variant="secondary">{node.occupants.length} ocupante(s)</Badge>
              )}
              <Badge variant="outline">Função {node.completeness.percent}%</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {node.occupants.map((o) => o.person.fullName).join(" · ") ||
                "Responsável não definido"}
            </p>
          </button>
          {node.children.length > 0 ? (
            <div className="mt-2 pl-4">
              <TreeBranch
                nodes={node.children}
                visibleIds={visibleIds}
                onSelect={onSelect}
                selectedId={selectedId}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PositionDetail({
  node,
  scopeLabel,
  parentTitle,
  issues,
  responsibilities,
  canManage,
  onEdit,
  onAssign,
  onDeactivate,
  onEndAssignment,
}: {
  node: OrgTreeNode;
  scopeLabel: string;
  parentTitle: string | null;
  issues: Array<{ code: string; message: string }>;
  responsibilities: ReturnType<typeof responsibilitySummary>;
  canManage: boolean;
  onEdit: () => void;
  onAssign: () => void;
  onDeactivate: () => void;
  onEndAssignment: (assignmentId: string) => void;
}) {
  const occupantSummaries = node.occupants.map((o) => ({
    occupant: o,
    summary: responsibilities.find((r) => r.person.id === o.person.id) ?? null,
  }));

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{node.position.title}</h2>
          <Badge variant="outline">{scopeLabel}</Badge>
          <Badge variant="outline">Responde a: {parentTitle ?? "Posição raiz (sem chefia)"}</Badge>
          {canManage ? (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onEdit}>
                Editar função
              </Button>
              <Button size="sm" onClick={onAssign}>
                Atribuir pessoa
              </Button>
              <ConfirmAction
                title={node.position.status === "active" ? "Inativar posição" : "Reativar posição"}
                description="Nada é excluído: a posição apenas muda de situação e o histórico permanece."
                actionLabel={node.position.status === "active" ? "Inativar" : "Reativar"}
                onConfirm={onDeactivate}

                trigger={
                  <Button size="sm" variant="ghost">
                    {node.position.status === "active" ? "Inativar" : "Reativar"}
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <DefinitionField label="Propósito da função" value={node.position.purpose} />
          <DefinitionField
            label="Responsabilidades principais"
            value={node.position.responsibilities}
          />
          <DefinitionField label="Autoridade de decisão" value={node.position.decisionAuthority} />
          <DefinitionField label="Entregas-chave" value={node.position.keyDeliverables} />
        </dl>

        <div>
          <h3 className="text-sm font-semibold">Ocupantes atuais</h3>
          {occupantSummaries.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Responsável não definido.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {occupantSummaries.map(({ occupant, summary }) => (
                <li key={occupant.assignment.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{occupant.person.fullName}</span>
                    <Badge variant="secondary">
                      {ASSIGNMENT_LABEL[occupant.assignment.assignmentType]}
                    </Badge>
                    <Badge variant="outline">Desde {occupant.assignment.startDate}</Badge>
                    {summary?.linkedUser ? null : (
                      <Badge variant="outline">Sem acesso vinculado</Badge>
                    )}
                    {canManage ? (
                      <ConfirmAction
                        title="Encerrar ocupação"
                        description="A atribuição é encerrada com a data de hoje. Depois é possível atribuir outra pessoa."
                        actionLabel="Encerrar"
                        onConfirm={() => onEndAssignment(occupant.assignment.id)}

                        trigger={
                          <Button size="sm" variant="ghost" className="ml-auto">
                            Encerrar / substituir
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary?.linkedUser
                      ? `Responsabilidades no GMOS: ${summary.workload.objectives} objetivo(s), ${summary.workload.kpis} indicador(es), ${summary.workload.actions} plano(s) de ação, ${summary.workload.routines} rotina(s).`
                      : "Pessoa sem usuário vinculado: não recebe itens executáveis do GMOS."}
                  </p>
                  {summary?.linkedUser ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/planejamento">Objetivos e indicadores</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/planos-de-acao">Planos de ação</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/rotinas">Rotinas</Link>
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Subordinados diretos</h3>
          {node.children.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nenhuma posição subordinada.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
              {node.children.map((child) => (
                <li key={child.position.id}>{child.position.title}</li>
              ))}
            </ul>
          )}
        </div>

        {node.completeness.missing.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Definição pendente: {node.completeness.missing.map(definitionLabel).join(", ")}.
          </p>
        ) : null}

        {issues.length > 0 ? (
          <ul className="space-y-1">
            {issues.map((issue) => (
              <li key={issue.code} className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DefinitionField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm">
        {value?.trim() ? value : <span className="text-muted-foreground">Não definido</span>}
      </dd>
    </div>
  );
}

function GovernanceAlerts({ issues }: { issues: Array<{ code: string; message: string }> }) {
  if (issues.length === 0) return null;
  return (
    <section aria-labelledby="lacunas" className="space-y-2">
      <h2
        id="lacunas"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Lacunas de governança ({issues.length})
      </h2>
      <Card>
        <CardContent className="divide-y p-0">
          {issues.map((issue, index) => (
            <p
              key={`${issue.code}-${index}`}
              className="flex items-start gap-2 p-3 text-sm text-muted-foreground"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              {issue.message}
            </p>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
