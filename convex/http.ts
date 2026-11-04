import { httpAction } from "convex/server";
import type { HttpAction } from "convex/server";
import { createHmac } from "crypto";
import { internal } from "./_generated/api";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export { healthCheck } from "./health";

export const verifyWebhook: HttpAction = httpAction(async (ctx, req) => {
  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET not configured");
  }

  const payload = await req.text();
  const svixSignature = req.headers.get("svix-signature");
  const svixTimestamp = req.headers.get("svix-timestamp");

  if (!svixSignature || !svixTimestamp) {
    return new Response("Missing Svix headers", { status: 401 });
  }

  // Clerk signs webhooks via Svix using HMAC-SHA256
  // Signature = "v1," + HMAC-SHA256(secret, timestamp + "." + payload)
  const signedPayload = `${svixTimestamp}.${payload}`;
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(signedPayload);
  const expectedSignature = `v1,${hmac.digest("hex")}`;

  // Constant-time comparison
  const sigBytes = new TextEncoder().encode(svixSignature);
  const expectedBytes = new TextEncoder().encode(expectedSignature);
  if (sigBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(sigBytes, expectedBytes)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const eventType = event.type as string | undefined;

  if (eventType === "organization.deleted") {
      const orgId = (event.data as { id: string })?.id;
      if (orgId) {
        await ctx.scheduler.runAfter(0, internal.cleanup.cleanupOrganization, { orgId });
      }
  }

  return new Response("OK", { status: 200 });
});
