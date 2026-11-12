export const CLERK_API_URL = "https://api.clerk.com/v3";

export function isClerkConfigured(): boolean {
  return !!process.env.CLERK_SECRET_KEY?.trim();
}

export async function clerkRequest(
  path: string,
  method: string = "GET",
  body?: unknown,
): Promise<unknown> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY not configured");
  }

  const response = await fetch(`${CLERK_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Clerk API error: ${response.status} ${errorText}`);
  }

  return response.json();
}