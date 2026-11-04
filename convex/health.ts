import { httpAction } from "convex/server";
import type { HttpAction } from "convex/server";

export const healthCheck: HttpAction = httpAction(async () => {
  return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
