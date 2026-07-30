// FASE F3 — contexto de empresa/filial selecionada (apenas preferência de interface).
// A seleção NÃO concede privilégios: leitura e escrita continuam sob RLS e has_permission.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMe,
  fetchScopePermissions,
  fetchWorkspaceOptions,
  type Workspace,
  type WorkspaceOption,
} from "@/lib/gmos/f3";

const STORAGE_KEY = "gmos.contexto.filial";

type WorkspaceContextValue = {
  options: WorkspaceOption[];
  workspace: Workspace | null;
  selectedBusinessUnitId: string | null;
  selectUnit: (businessUnitId: string) => void;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [preferred, setPreferred] = useState<string | null>(null);

  useEffect(() => {
    setPreferred(readStored());
  }, []);

  const optionsQuery = useQuery({
    queryKey: ["gmos", "workspace-options"],
    queryFn: fetchWorkspaceOptions,
    retry: false,
  });
  const meQuery = useQuery({ queryKey: ["gmos", "me"], queryFn: fetchMe, retry: false });

  const options = optionsQuery.data ?? [];

  // Revalida a preferência contra os registros realmente visíveis.
  // Sem correspondência, usa a primeira unidade visível como fallback neutro.
  const selected = useMemo(() => {
    if (!options.length) return null;
    return options.find((o) => o.businessUnitId === preferred) ?? options[0];
  }, [options, preferred]);

  const permsQuery = useQuery({
    queryKey: ["gmos", "permissions", selected?.scopeId ?? null],
    queryFn: () => fetchScopePermissions(selected?.scopeId ?? null),
    enabled: Boolean(selected),
    retry: false,
  });

  const selectUnit = useCallback((businessUnitId: string) => {
    setPreferred(businessUnitId);
    try {
      window.localStorage.setItem(STORAGE_KEY, businessUnitId);
    } catch {
      /* preferência de UI é opcional */
    }
  }, []);

  const workspace: Workspace | null = useMemo(() => {
    if (!selected) return null;
    return {
      ...selected,
      meUserId: meQuery.data?.meUserId ?? null,
      meEmail: meQuery.data?.meEmail ?? null,
      canStrategy: permsQuery.data?.canStrategy ?? false,
      canAction: permsQuery.data?.canAction ?? false,
      canRoutine: permsQuery.data?.canRoutine ?? false,
    };
  }, [selected, meQuery.data, permsQuery.data]);

  const value: WorkspaceContextValue = {
    options,
    workspace,
    selectedBusinessUnitId: selected?.businessUnitId ?? null,
    selectUnit,
    isPending:
      optionsQuery.isPending || meQuery.isPending || (Boolean(selected) && permsQuery.isPending),
    error: optionsQuery.error ?? meQuery.error ?? null,
    refetch: () => {
      void optionsQuery.refetch();
      void meQuery.refetch();
      void permsQuery.refetch();
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace deve ser usado dentro de WorkspaceProvider.");
  return ctx;
}
