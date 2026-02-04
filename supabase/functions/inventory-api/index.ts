import { handleCors } from "./lib/cors.ts";
import { authenticate } from "./lib/auth.ts";
import { errorResponse } from "./lib/response.ts";
import { handlePicksByOrder } from "./handlers/picks.ts";
import { handleRemaining } from "./handlers/remaining.ts";
import { handleCompletedOrders } from "./handlers/completed.ts";
import { handleComprehensive } from "./handlers/comprehensive.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow GET
  if (req.method !== "GET") {
    return errorResponse("Method not allowed. Use GET.", 405);
  }

  // Authenticate
  const auth = authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }

  // Route by endpoint query param
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");

  try {
    switch (endpoint) {
      case "picks-by-order":
        return await handlePicksByOrder(url.searchParams);

      case "remaining":
        return await handleRemaining(url.searchParams);

      case "completed-orders":
        return await handleCompletedOrders(url.searchParams);

      case "comprehensive":
        return await handleComprehensive(url.searchParams);

      default:
        return errorResponse(
          `Unknown or missing endpoint: "${endpoint || ""}". ` +
          `Available endpoints: picks-by-order, remaining, completed-orders, comprehensive`,
          400,
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
});
