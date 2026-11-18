import { ROLES, ROLE_PERMISSIONS, checkPermission } from "~~/convex/functions/shared_constants";

export { ROLES, ROLE_PERMISSIONS, checkPermission };

export type TeamRole = (typeof ROLES)[keyof typeof ROLES];

export const TEAM_ROLES = ROLES;

export const PERMISSIONS = {
  EXPENSE_CREATE: "expense:create",
  EXPENSE_READ: "expense:read",
  EXPENSE_APPROVE: "expense:approve",
  EXPENSE_REJECT: "expense:reject",
  BUDGET_CREATE: "budget:create",
  BUDGET_UPDATE: "budget:update",
  BUDGET_DELETE: "budget:delete",
  CATEGORY_MANAGE: "category:manage",
  SETTLEMENT_CREATE: "settlement:create",
  SETTLEMENT_READ: "settlement:read",
  TEAM_MANAGE: "team:manage",
  INVITE_CREATE: "invite:create",
  AUDIT_READ: "audit:read",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  role: string,
  permission: Permission,
): boolean {
  return checkPermission(role, permission);
}