import type { UserIdentity } from "../_generated/server";

const CLERK_ORG_ID = "org_id";

export async function requireAuthenticatedUser(
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string }> {
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
  ctx: { auth: { getUserIdentity: () => Promise<UserIdentity | null> } }
): Promise<{ userId: string; orgId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const userId = identity.subject;

  // Extract orgId from the Clerk JWT org_id claim.
  // Requires a Clerk JWT template configured to include `org_id` as a custom claim.
  // See: domains/01-auth/onboarding-auth.md §8 (Clerk JWT Template Configuration)
  const orgId = (identity as Record<string, unknown>)[CLERK_ORG_ID] as string | undefined;

  if (!userId || !orgId) {
    throw new Error("Unauthenticated or no organisation");
  }

  return { userId, orgId };
}
