import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { healthCheck } from "./health";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

async function verifySvixSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string,
): Promise<boolean> {
  // Clerk signs webhooks via Svix using HMAC-SHA256
  // Signature = "v1," + HMAC-SHA256(secret, timestamp + "." + payload)
  const signedPayload = `${timestamp}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `v1,${hex}`;

  if (signature.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

const verifyWebhook = httpAction(async (ctx, req) => {
  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET not configured");
  }

  const payload = await req.text();
  const svixSignature = req.headers.get("svix-signature");
  const svixTimestamp = req.headers.get("svix-timestamp");

  if (!svixSignature || !svixTimestamp) {
    return new Response("Missing Svix headers", { status: 401 });
  }

  const valid = await verifySvixSignature(
    payload,
    svixSignature,
    svixTimestamp,
    WEBHOOK_SECRET,
  );
  if (!valid) {
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
      await ctx.scheduler.runAfter(0, internal.functions.cleanup.cleanupOrganization, { orgId });
    }
  }

  return new Response("OK", { status: 200 });
});

const http = httpRouter();

http.route({
  path: "/webhook/clerk",
  method: "POST",
  handler: verifyWebhook,
});

http.route({
  path: "/health",
  method: "GET",
  handler: healthCheck,
});

export default http;
export { healthCheck };
