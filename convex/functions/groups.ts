import { query } from "../_generated/server";
import { requireAuthenticatedUser } from "../auth";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuthenticatedUser(ctx);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const active = memberships.filter(
      (m) => m.status === "active" && m.deletedAt === undefined,
    );

    const seen = new Set<string>();
    const groups: Array<{ orgId: string; role: string; status: string }> = [];
    for (const m of active) {
      if (!m.orgId) continue;
      const orgId = m.orgId as string;
      if (seen.has(orgId)) continue;
      seen.add(orgId);
      groups.push({
        orgId,
        role: m.role,
        status: m.status,
      });
    }

    return groups;
  },
});