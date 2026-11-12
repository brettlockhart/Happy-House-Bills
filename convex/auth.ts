import type { UserIdentity } from "convex/server";

const CLERK_ORG_ID = "org_id";

function getBypassAuth(): { userId: string; orgId: string } | null {
  // Explicit dev-only bypass. Set in Convex env for a NON-production deployment only.
  if (process.env.AUTH_BYPASS !== "1") return null;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_BYPASS is not allowed in production");
  }
  const userId = process.env.AUTH_BYPASS_USER_ID?.trim() || "dev-user";
  const orgId = process.env.AUTH_BYPASS_ORG_ID?.trim() || "dev-org";
  return { userId, orgId };
}

export async function requireAuthenticatedUser(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } },
): Promise<{ userId: string }> {
  const bypass = getBypassAuth();
  if (bypass) return { userId: bypass.userId };

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  const userId = identity.subject;
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return { userId };
}

export async function requireAuthenticatedOrg(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } },
): Promise<{ userId: string; orgId: string }> {
  const bypass = getBypassAuth();
  if (bypass) return bypass;

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const userId = identity.subject;
  const orgId = (identity as Record<string, unknown>)[CLERK_ORG_ID] as
    | string
    | undefined;

  if (!userId || !orgId) {
    throw new Error("Unauthenticated or no organisation");
  }

  return { userId, orgId };
}
