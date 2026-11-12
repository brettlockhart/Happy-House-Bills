import { httpAction } from "./_generated/server";

export const healthCheck = httpAction(async () => {
  return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
