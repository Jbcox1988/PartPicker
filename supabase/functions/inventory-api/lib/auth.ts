// API key authentication via Bearer token or query param

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

// Simple in-memory rate limiter (resets on cold start)
const requestCounts = new Map<string, { count: number; windowStart: number }>();

export function authenticate(req: Request): { ok: true } | { ok: false; error: string; status: number } {
  const apiKey = Deno.env.get("INVENTORY_API_KEY");
  if (!apiKey) {
    return { ok: false, error: "Server misconfiguration: API key not set", status: 500 };
  }

  // Check Authorization header first, then query param
  const url = new URL(req.url);
  const authHeader = req.headers.get("Authorization");
  let providedKey: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  } else {
    providedKey = url.searchParams.get("api_key");
  }

  if (!providedKey) {
    return { ok: false, error: "Missing API key. Provide via Authorization: Bearer <key> header or ?api_key=<key> query param.", status: 401 };
  }

  if (providedKey !== apiKey) {
    return { ok: false, error: "Invalid API key", status: 403 };
  }

  // Rate limiting by client IP (best-effort)
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                   req.headers.get("cf-connecting-ip") ||
                   "unknown";

  const now = Date.now();
  const entry = requestCounts.get(clientIp);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(clientIp, { count: 1, windowStart: now });
  } else {
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      return { ok: false, error: "Rate limit exceeded. Max 60 requests per minute.", status: 429 };
    }
  }

  return { ok: true };
}
