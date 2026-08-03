// FASE F7-B — regras puras de execução de rotina.
// A decisão final é sempre da RLS; estas funções apenas evitam expor botões
// que o banco recusaria e corrigem o antigo comportamento em que qualquer
// perfil com escrita no escopo podia concluir execução de terceiros.

export const OWNER_UNDEFINED_LABEL = "Responsável não definido";

export type ExecutionOwnership = {
  /** owner_user_id da execução. */
  executionOwnerId: string | null;
  /** owner_user_id do modelo, usado como responsável herdado. */
  templateOwnerId?: string | null;
  /** id interno (public.users) do usuário atual. */
  meUserId: string | null;
};

export type ExecutionCapabilities = {
  /** can("routine.manage", scopeId) resolvido pelo auth-context. */
  canManage: boolean;
  /** can("routine.execute_own", scopeId) resolvido pelo auth-context. */
  canExecuteOwn: boolean;
};

/** Verdadeiro quando a execução (ou o modelo) pertence ao usuário atual. */
export function isMine(ownership: ExecutionOwnership): boolean {
  const me = ownership.meUserId;
  if (!me) return false;
  return ownership.executionOwnerId === me || ownership.templateOwnerId === me;
}

/**
 * Pode registrar conclusão/impedimento se gerencia rotina no escopo
 * OU é o responsável e possui execução própria.
 */
export function canExecute(
  ownership: ExecutionOwnership,
  caps: ExecutionCapabilities,
  status: string,
): boolean {
  if (["completed", "cancelled"].includes(status)) return false;
  if (caps.canManage) return true;
  return caps.canExecuteOwn && isMine(ownership);
}

/** Rótulo de responsável sem inventar nomes. */
export function ownerDisplay(ownerUserId: string | null, meUserId: string | null): string {
  if (!ownerUserId) return OWNER_UNDEFINED_LABEL;
  if (meUserId && ownerUserId === meUserId) return "Você";
  return "Definido";
}
