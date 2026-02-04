import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { successResponse, errorResponse } from "../lib/response.ts";

export async function handleCompletedOrders(params: URLSearchParams): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const soNumber = params.get("so_number");
  const since = params.get("since");
  const limit = parseInt(params.get("limit") || "50", 10);

  let query = supabase
    .from("completed_order_summaries")
    .select("*")
    .order("completed_at", { ascending: false })
    .limit(Math.min(limit, 500)); // cap at 500

  if (soNumber) {
    query = query.eq("so_number", soNumber);
  }

  if (since) {
    // Validate date format
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return errorResponse("Invalid 'since' parameter. Use ISO 8601 format (e.g. 2026-01-01).", 400);
    }
    query = query.gte("completed_at", since);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse(`Database error: ${error.message}`, 500);
  }

  return successResponse(data || [], {
    count: (data || []).length,
    filters: {
      so_number: soNumber || null,
      since: since || null,
      limit,
    },
  });
}
