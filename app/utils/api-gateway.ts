export interface ApiGatewayRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface ApiGatewayResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  durationMs: number;
}

export class ApiGateway {
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;

  constructor(options: { baseUrl?: string; defaultHeaders?: Record<string, string>; defaultTimeout?: number } = {}) {
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "Happy-House-Bills/1.0",
      Accept: "application/json",
      ...options.defaultHeaders,
    };
    this.defaultTimeout = options.defaultTimeout ?? 30000;
  }

  private async request<T>(options: ApiGatewayRequest): Promise<ApiGatewayResponse<T>> {
    const { url, method = "GET", headers = {}, body, timeoutMs = this.defaultTimeout } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: { ...this.defaultHeaders, ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseText = await response.text();
      const durationMs = Date.now() - startTime;

      let data: T | null = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          // Non-JSON response
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
        durationMs,
        error: response.ok ? undefined : `HTTP ${response.status}: ${responseText}`,
      };
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      return {
        ok: false,
        status: 0,
        data: null,
        durationMs,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<ApiGatewayResponse<T>> {
    return this.request<T>({ url, method: "GET", headers });
  }

  async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<ApiGatewayResponse<T>> {
    return this.request<T>({ url, method: "POST", body, headers });
  }

  async put<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<ApiGatewayResponse<T>> {
    return this.request<T>({ url, method: "PUT", body, headers });
  }

  async patch<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<ApiGatewayResponse<T>> {
    return this.request<T>({ url, method: "PATCH", body, headers });
  }

  async delete<T>(url: string, headers?: Record<string, string>): Promise<ApiGatewayResponse<T>> {
    return this.request<T>({ url, method: "DELETE", headers });
  }

  setAuthToken(token: string): void {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.defaultHeaders.Authorization;
  }
}

export const apiGateway = new ApiGateway();