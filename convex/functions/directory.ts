/**
 * Minimal Convex-native directory shim for local dev/tests when Clerk is unavailable.
 * Clerk remains the source of truth when configured; migrate these seams when switching providers.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DbCtx = QueryCtx | MutationCtx;

export async function listOrgMemberUserIds(ctx: DbCtx, orgId: string): Promise<string[]> {
  const rows = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return rows
    .filter((m) => !m.deletedAt && m.status === "active")
    .map((m) => m.userId);
}

export function displayNameForUserId(userId: string): string {
  if (!userId) return "Partner";
  return userId.replace(/^user_/, "").slice(0, 32) || "Partner";
}
