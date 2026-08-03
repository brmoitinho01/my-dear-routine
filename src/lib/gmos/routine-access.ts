// FASE F7-B — regras puras de execução de rotina.
// A decisão final é sempre da RLS; estas funções apenas evitam expor botões
// que o banco recusaria e corrigem o antigo comportamento em que qualquer
// perfil com escrita no escopo podia concluir execução de terceiros.

export const OWNER_UNDEFINED_LABEL = "Responsável não definido";

/** Estados terminais: nada mais pode ser operado. */
export const TERMINAL_EXECUTION_STATUS = ["completed", "cancelled"];

/**
 * Responsável efetivo da execução.
 * O owner do modelo NUNCA substitui o owner da execução: ele só é herdado
 * quando `routine_executions.owner_user_id` é nulo — caso de registros
 * legados gerados antes de o responsável passar a ser gravado na execução.
 */
export function effectiveOwnerId(
  executionOwnerId: string | null,
  templateOwnerId?: string | null,
): string | null {
  return executionOwnerId ?? templateOwnerId ?? null;
}

/**
 * Regra pura de operação de uma execução (concluir, bloquear, iniciar):
 * é o responsável e tem `routine.execute_own` no escopo, OU tem `routine.manage`.
 */
export function canOperateExecution(input: {
  currentUserId: string | null;
  ownerUserId: string | null;
  canExecuteOwn: boolean;
  canManage: boolean;
}): boolean {
  if (input.canManage) return true;
  if (!input.canExecuteOwn) return false;
  if (!input.currentUserId || !input.ownerUserId) return false;
  return input.currentUserId === input.ownerUserId;
}

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
  return effectiveOwnerId(ownership.executionOwnerId, ownership.templateOwnerId) === me;
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
  if (TERMINAL_EXECUTION_STATUS.includes(status)) return false;
  return canOperateExecution({
    currentUserId: ownership.meUserId,
    ownerUserId: effectiveOwnerId(ownership.executionOwnerId, ownership.templateOwnerId),
    canExecuteOwn: caps.canExecuteOwn,
    canManage: caps.canManage,
  });
}

/** Rótulo de responsável sem inventar nomes. */
export function ownerDisplay(ownerUserId: string | null, meUserId: string | null): string {
  if (!ownerUserId) return OWNER_UNDEFINED_LABEL;
  if (meUserId && ownerUserId === meUserId) return "Você";
  return "Definido";
}
