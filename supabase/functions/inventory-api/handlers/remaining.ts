import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { successResponse, errorResponse } from "../lib/response.ts";

export async function handleRemaining(params: URLSearchParams): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const partNumber = params.get("part_number");
  const includeFullyPicked = params.get("include_fully_picked") === "true";

  // Use the consolidated_remaining view for the default case,
  // or the function when include_fully_picked is requested
  if (includeFullyPicked) {
    const { data, error } = await supabase.rpc("get_consolidated_parts", {
      include_fully_picked: true,
    });

    if (error) {
      return errorResponse(`Database error: ${error.message}`, 500);
    }

    let results = data || [];
    if (partNumber) {
      results = results.filter((r: any) => r.part_number === partNumber);
    }

    // Fetch per-order breakdown for each part
    const enriched = await enrichWithOrderBreakdown(supabase, results);

    return successResponse(enriched, {
      count: enriched.length,
      include_fully_picked: true,
      part_number_filter: partNumber || null,
    });
  }

  // Default: use the view (excludes fully picked)
  let query = supabase.from("consolidated_remaining").select("*");

  if (partNumber) {
    query = query.eq("part_number", partNumber);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse(`Database error: ${error.message}`, 500);
  }

  const results = data || [];
  const enriched = await enrichWithOrderBreakdown(supabase, results);

  return successResponse(enriched, {
    count: enriched.length,
    include_fully_picked: false,
    part_number_filter: partNumber || null,
  });
}

// Fetch per-order breakdown for each part number
async function enrichWithOrderBreakdown(supabase: any, parts: any[]): Promise<any[]> {
  if (parts.length === 0) return [];

  const partNumbers = parts.map((p: any) => p.part_number);

  // Fetch line items with order info for these part numbers
  const { data: lineItems, error } = await supabase
    .from("line_item_pick_totals")
    .select(`
      line_item_id,
      order_id,
      part_number,
      total_qty_needed,
      total_picked,
      remaining
    `)
    .in("part_number", partNumbers);

  if (error) {
    // Return parts without breakdown on error
    return parts.map((p: any) => ({ ...p, orders: [] }));
  }

  // Fetch order details for these line items
  const orderIds = [...new Set((lineItems || []).map((li: any) => li.order_id))];
  const { data: orders } = await supabase
    .from("orders")
    .select("id, so_number, order_date, tool_model, status")
    .in("id", orderIds)
    .eq("status", "active");

  const orderMap = new Map((orders || []).map((o: any) => [o.id, o]));

  // Group line items by part number
  const breakdownByPart = new Map<string, any[]>();
  for (const li of lineItems || []) {
    const order = orderMap.get(li.order_id);
    if (!order) continue; // skip non-active orders

    const list = breakdownByPart.get(li.part_number) || [];
    list.push({
      order_id: li.order_id,
      so_number: order.so_number,
      order_date: order.order_date,
      tool_model: order.tool_model,
      needed: li.total_qty_needed,
      picked: li.total_picked,
      remaining: li.remaining,
      line_item_id: li.line_item_id,
    });
    breakdownByPart.set(li.part_number, list);
  }

  return parts.map((p: any) => {
    const orders = breakdownByPart.get(p.part_number) || [];
    // Sort by order_date ascending (oldest first), fallback to so_number
    orders.sort((a: any, b: any) => {
      if (a.order_date && b.order_date) {
        const diff = new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
        if (diff !== 0) return diff;
      } else if (a.order_date && !b.order_date) return -1;
      else if (!a.order_date && b.order_date) return 1;
      return (a.so_number || "").localeCompare(b.so_number || "", undefined, { numeric: true });
    });
    return { ...p, orders };
  });
}
