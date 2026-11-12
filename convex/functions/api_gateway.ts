import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export interface GatewayRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface GatewayResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  error?: string;
}

async function requestInternal(args: {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}): Promise<GatewayResponse> {
  const method = args.method ?? "GET";
  const timeoutMs = args.timeoutMs ?? 30000;
  const retries = args.retries ?? 3;

  const headers: Record<string, string> = {
    "User-Agent": "Happy-House-Bills/1.0",
    Accept: "application/json",
    ...args.headers,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let lastError: string | undefined;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(args.url, {
        method,
        headers,
        body: args.body,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const bodyText = await response.text().catch(() => "");
      const durationMs = Date.now() - startTime;
      clearTimeout(timer);

      return {
        ok: response.ok,
        status: response.status,
        headers: responseHeaders,
        body: bodyText,
        durationMs,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  clearTimeout(timer);
  return {
    ok: false,
    status: 0,
    headers: {},
    body: "",
    durationMs: Date.now() - startTime,
    error: lastError ?? "Unknown error",
  };
}

export const request = internalAction({
  args: {
    url: v.string(),
    method: v.union(
      v.literal("GET"),
      v.literal("POST"),
      v.literal("PUT"),
      v.literal("DELETE"),
      v.literal("PATCH"),
    ),
    headers: v.optional(v.any()),
    body: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
    retries: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<GatewayResponse> => {
    return requestInternal({
      url: args.url,
      method: args.method ?? "GET",
      headers: args.headers as Record<string, string> | undefined,
      body: args.body,
      timeoutMs: args.timeoutMs,
      retries: args.retries,
    });
  },
});

export const get = (url: string, headers?: Record<string, string>) =>
  requestInternal({ url, method: "GET", headers });

export const post = (
  url: string,
  body?: string,
  headers?: Record<string, string>,
) => requestInternal({ url, method: "POST", body, headers });

export const put = (
  url: string,
  body?: string,
  headers?: Record<string, string>,
) => requestInternal({ url, method: "PUT", body, headers });

export const del = (url: string, headers?: Record<string, string>) =>
  requestInternal({ url, method: "DELETE", headers });

export const patch = (
  url: string,
  body?: string,
  headers?: Record<string, string>,
) => requestInternal({ url, method: "PATCH", body, headers });