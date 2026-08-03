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
 * Regra pura e única de operação de uma execução (concluir, bloquear, iniciar).
 *
 * Ordem de decisão:
 * 1. status terminal (`completed`/`cancelled`) => false;
 * 2. `canManage` (routine.manage no escopo) => true;
 * 3. execução própria: exige `canExecuteOwn` e ser o responsável efetivo.
 *
 * Responsável efetivo: quando `executionOwnerId` não é nulo, somente ele conta —
 * o responsável do modelo nunca substitui o da execução. `templateOwnerId` é
 * usado apenas como **fallback legado**, para execuções geradas antes de o
 * responsável passar a ser gravado em `routine_executions.owner_user_id`.
 * Sem responsável efetivo, não há execução própria possível.
 */
export function canOperateExecution(input: {
  currentUserId: string | null;
  executionOwnerId: string | null;
  templateOwnerId?: string | null;
  canExecuteOwn: boolean;
  canManage: boolean;
  status?: string;
}): boolean {
  if (input.status && TERMINAL_EXECUTION_STATUS.includes(input.status)) return false;
  if (input.canManage) return true;
  if (!input.canExecuteOwn) return false;
  const owner = effectiveOwnerId(input.executionOwnerId, input.templateOwnerId);
  if (!input.currentUserId || !owner) return false;
  return input.currentUserId === owner;
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

/**
 * Verdadeiro quando a execução pertence ao usuário atual — ou, no fallback
 * legado (execução sem responsável), quando o modelo pertence a ele.
 */
export function isMine(ownership: ExecutionOwnership): boolean {
  const me = ownership.meUserId;
  if (!me) return false;
  return effectiveOwnerId(ownership.executionOwnerId, ownership.templateOwnerId) === me;
}

/**
 * Compatibilidade de chamada nas telas: delega integralmente a
 * `canOperateExecution`, incluindo o fallback legado de responsável do modelo.
 */
export function canExecute(
  ownership: ExecutionOwnership,
  caps: ExecutionCapabilities,
  status: string,
): boolean {
  return canOperateExecution({
    currentUserId: ownership.meUserId,
    executionOwnerId: ownership.executionOwnerId,
    templateOwnerId: ownership.templateOwnerId,
    canExecuteOwn: caps.canExecuteOwn,
    canManage: caps.canManage,
    status,
  });
}

/** Rótulo de responsável sem inventar nomes. */
export function ownerDisplay(ownerUserId: string | null, meUserId: string | null): string {
  if (!ownerUserId) return OWNER_UNDEFINED_LABEL;
  if (meUserId && ownerUserId === meUserId) return "Você";
  return "Definido";
}
