import type { UserIdentity } from "convex/server";

const CLERK_ORG_ID = "org_id";

function getBypassAuth(): { userId: string; orgId: string } | null {
  // Explicit dev-only bypass. Set in Convex env for a NON-production deployment only.
  if (process.env.AUTH_BYPASS !== "1") return null;
  // `process.env.NODE_ENV` is inlined to "production" when Convex bundles functions,
  // so it cannot distinguish a local dev backend. Use the runtime deployment URL
  // (not inlined) to only ever allow the bypass on a local backend.
  const cloudUrl = process.env.CONVEX_CLOUD_URL || "";
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(cloudUrl);
  // Fail closed: the bypass is never permitted on any cloud deployment,
  // regardless of NODE_ENV or deployment type.
  if (!isLocal) {
    throw new Error("AUTH_BYPASS is only allowed on a local development backend");
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
