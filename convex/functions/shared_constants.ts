export const ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

export type TeamRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  admin: [
    "expense:create",
    "expense:read",
    "expense:approve",
    "expense:reject",
    "budget:create",
    "budget:update",
    "budget:delete",
    "category:manage",
    "settlement:create",
    "settlement:read",
    "team:manage",
    "invite:create",
    "audit:read",
  ],
  member: [
    "expense:create",
    "expense:read",
    "expense:reject",
    "budget:create",
    "budget:update",
    "budget:delete",
    "category:manage",
    "settlement:create",
    "settlement:read",
  ],
  viewer: ["expense:read"],
};

export function checkPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role as TeamRole];
  return !!permissions && permissions.includes(permission);
}

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = 90;