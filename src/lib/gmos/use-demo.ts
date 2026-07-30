import { useQuery } from "@tanstack/react-query";
import { fetchExecutivePanel, fetchIsDemoUnit } from "./demo";

/** true somente quando o marcador do lote é realmente encontrado no banco para a filial. */
export function useIsDemoUnit(businessUnitId: string | null | undefined) {
  const q = useQuery({
    queryKey: ["gmos", "demo-batch", businessUnitId ?? null],
    queryFn: () => fetchIsDemoUnit(businessUnitId ?? null),
    enabled: Boolean(businessUnitId),
    retry: false,
    staleTime: 60_000,
  });
  return q.data === true;
}

export function useExecutivePanel(businessUnitId: string | null | undefined) {
  return useQuery({
    queryKey: ["gmos", "executive-panel", businessUnitId ?? null],
    queryFn: () => fetchExecutivePanel(businessUnitId as string),
    enabled: Boolean(businessUnitId),
    retry: false,
  });
}
