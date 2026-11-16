// Allowed status transitions for orders and contracts.
// Services must call `assertTransition` inside the same DB transaction that writes the new status.

export const ORDER_STATUSES = [
  'CREATED',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'ACCEPTED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'DISPUTED'],
  PROCESSING: ['READY', 'CANCELLED', 'DISPUTED'],
  READY: ['SHIPPED', 'DELIVERED', 'CANCELLED', 'DISPUTED'], // DELIVERED directly = self-pickup
  SHIPPED: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['ACCEPTED', 'DISPUTED'],
  ACCEPTED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['COMPLETED', 'CANCELLED'], // only a moderator decision leaves DISPUTED
};

export const CONTRACT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'WAITING_FOR_BUYER',
  'WAITING_FOR_SELLER',
  'PARTIALLY_SIGNED',
  'FULLY_SIGNED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'EXPIRED',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['WAITING_FOR_BUYER', 'WAITING_FOR_SELLER', 'DRAFT', 'CANCELLED'],
  WAITING_FOR_BUYER: ['PARTIALLY_SIGNED', 'DRAFT', 'CANCELLED', 'EXPIRED'],
  WAITING_FOR_SELLER: ['PARTIALLY_SIGNED', 'DRAFT', 'CANCELLED', 'EXPIRED'],
  PARTIALLY_SIGNED: ['FULLY_SIGNED', 'CANCELLED', 'EXPIRED', 'DISPUTED'],
  FULLY_SIGNED: ['ACTIVE', 'DISPUTED'],
  ACTIVE: ['COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'],
  DISPUTED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export class InvalidTransitionError extends Error {
  readonly kind: 'order' | 'contract';
  readonly from: string;
  readonly to: string;

  constructor(kind: 'order' | 'contract', from: string, to: string) {
    super(`Invalid ${kind} status transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
    this.kind = kind;
    this.from = from;
    this.to = to;
  }
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  return CONTRACT_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) throw new InvalidTransitionError('order', from, to);
}

export function assertContractTransition(from: ContractStatus, to: ContractStatus): void {
  if (!canTransitionContract(from, to)) throw new InvalidTransitionError('contract', from, to);
}
