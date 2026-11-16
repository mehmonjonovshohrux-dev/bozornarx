// RBAC: roles are fixed here, but checks are made per permission, never per role name.
// The backend guard must call `can()` on every request. Hidden UI buttons are not security.

export const ROLES = ['GUEST', 'BUYER', 'SELLER', 'MODERATOR', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'catalog.read',
  'prices.read',
  'history.read',
  'favorites.manage',
  'alerts.manage',
  'chat.use',
  'orders.create',
  'reviews.create',
  'products.create',
  'products.update',
  'products.archive',
  'products.delete',
  'prices.create',
  'prices.update',
  'prices.moderate',
  'complaints.create',
  'complaints.review',
  'contracts.create',
  'contracts.sign',
  'contracts.review',
  'disputes.resolve',
  'users.manage',
  'roles.manage',
  'payments.view',
  'reports.export',
  'audit.read',
  'system.settings',
  'catalog.manage',
  'stores.manage',
  'stores.moderate',
  'orders.manage',
  'plans.manage',
  'stats.view',
  'reviews.moderate',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const PUBLIC_READ: Permission[] = ['catalog.read', 'prices.read', 'history.read'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  GUEST: PUBLIC_READ,
  BUYER: [
    ...PUBLIC_READ,
    'favorites.manage',
    'alerts.manage',
    'chat.use',
    'orders.create',
    'reviews.create',
    'complaints.create',
    'contracts.create',
    'contracts.sign',
    'payments.view', // own payments only (ownership is checked in the service layer)
  ],
  SELLER: [
    ...PUBLIC_READ,
    'favorites.manage',
    'alerts.manage',
    'chat.use',
    'reviews.create',
    'complaints.create',
    'products.create',
    'products.update', // own products only
    'products.archive', // own products only
    'prices.create',
    'prices.update', // own prices only
    'contracts.create',
    'contracts.sign',
    'payments.view', // own payments only
    'reports.export', // own store report only
    'stores.manage', // own store only
    'orders.manage', // orders of own store only
  ],
  MODERATOR: [
    ...PUBLIC_READ,
    'prices.moderate',
    'complaints.review',
    'contracts.review',
    'disputes.resolve',
    'reports.export', // moderation report only
    'catalog.manage',
    'stores.moderate',
    'stats.view', // queue counters and own moderation activity
    'reviews.moderate',
  ],
  // Super Admin gets everything except acting as a contract party (no contracts.sign / contracts.create).
  SUPER_ADMIN: PERMISSIONS.filter((p) => p !== 'contracts.sign' && p !== 'contracts.create'),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => can(r, permission));
}
