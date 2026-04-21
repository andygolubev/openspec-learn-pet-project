/** Portal RBAC — aligns with accounts spec */

export const ROLES = {
  CUSTOMER_USER: "customer_user",
  CUSTOMER_ADMIN: "customer_admin",
  /** Generic internal role; extend with finer roles later */
  INTERNAL_STAFF: "internal_staff",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function isInternalRole(roles: readonly string[]): boolean {
  return roles.some((r) => r.startsWith("internal_"));
}

export function hasCustomerAdmin(roles: readonly string[]): boolean {
  return roles.includes(ROLES.CUSTOMER_ADMIN);
}

export function hasCustomerUser(roles: readonly string[]): boolean {
  return roles.includes(ROLES.CUSTOMER_USER);
}
