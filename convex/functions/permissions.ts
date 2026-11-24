import { internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";

const WRITE_PERMISSION_ERROR = "You do not have permission to write in this organisation";
const ADMIN_PERMISSION_ERROR = "Only active organisation admins can perform this action";

async function assertActiveRole(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  userId: string,
  adminOnly: boolean,
): Promise<void> {
  // Callers authenticate first; requireAuthenticatedOrg restricts this bypass to local dev.
  if (process.env.AUTH_BYPASS === "1") {
    const cloudUrl = process.env.CONVEX_CLOUD_URL || "";
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(cloudUrl);
    if (isLocal) return;
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .first();

  if (!membership || membership.deletedAt || membership.status !== "active") {
    throw new Error(adminOnly ? ADMIN_PERMISSION_ERROR : WRITE_PERMISSION_ERROR);
  }
  if (adminOnly ? membership.role !== "admin" : membership.role === "viewer") {
    throw new Error(adminOnly ? ADMIN_PERMISSION_ERROR : WRITE_PERMISSION_ERROR);
  }
}

/** Active admin/member required for organisation writes and paid operations. */
export async function assertOrgWriteAccess(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  userId: string,
): Promise<void> {
  await assertActiveRole(ctx, orgId, userId, false);
}

/** Active admin required for operations that already have admin-only semantics. */
export async function assertOrgAdminAccess(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
  userId: string,
): Promise<void> {
  await assertActiveRole(ctx, orgId, userId, true);
}

/** Internal reads let public actions, which have no db context, use the same checks. */
export const assertOrgWrite = internalQuery({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgWriteAccess(ctx, args.orgId, args.userId);
    return true;
  },
});

export const assertOrgAdmin = internalQuery({
  args: { orgId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAdminAccess(ctx, args.orgId, args.userId);
    return true;
  },
});
