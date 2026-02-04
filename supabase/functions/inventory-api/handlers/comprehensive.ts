import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { successResponse, errorResponse } from "../lib/response.ts";

export async function handleComprehensive(params: URLSearchParams): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const soNumber = params.get("so_number");

  // Run all three queries in parallel
  const [remainingResult, completedResult, activeOrdersResult] = await Promise.all([
    // 1. Remaining parts (consolidated)
    supabase.rpc("get_consolidated_parts", { include_fully_picked: false }),

    // 2. Completed orders (last 20)
    supabase
      .from("completed_order_summaries")
      .select("*")
      .order("completed_at", { ascending: false })
      .limit(20),

    // 3. Active orders with pick progress
    fetchActiveOrders(supabase, soNumber),
  ]);

  if (remainingResult.error) {
    return errorResponse(`Database error (remaining): ${remainingResult.error.message}`, 500);
  }
  if (completedResult.error) {
    return errorResponse(`Database error (completed): ${completedResult.error.message}`, 500);
  }
  if (activeOrdersResult.error) {
    return errorResponse(`Database error (active orders): ${activeOrdersResult.error}`, 500);
  }

  return successResponse({
    remaining_parts: remainingResult.data || [],
    completed_orders: completedResult.data || [],
    active_orders: activeOrdersResult.data || [],
  }, {
    remaining_parts_count: (remainingResult.data || []).length,
    completed_orders_count: (completedResult.data || []).length,
    active_orders_count: (activeOrdersResult.data || []).length,
    so_number_filter: soNumber || null,
  });
}

async function fetchActiveOrders(
  supabase: any,
  soNumber: string | null,
): Promise<{ data: any[] | null; error: string | null }> {
  let query = supabase
    .from("orders")
    .select("id, so_number, po_number, customer_name, order_date, due_date, tool_model, quantity")
    .eq("status", "active")
    .order("order_date", { ascending: true });

  if (soNumber) {
    query = query.eq("so_number", soNumber);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) return { data: null, error: ordersError.message };
  if (!orders || orders.length === 0) return { data: [], error: null };

  // Fetch line items with pick totals for all active orders
  const orderIds = orders.map((o: any) => o.id);
  const { data: lineItems, error: liError } = await supabase
    .from("line_item_pick_totals")
    .select("*")
    .in("order_id", orderIds);

  if (liError) return { data: null, error: liError.message };

  // Group line items by order
  const liByOrder = new Map<string, any[]>();
  for (const li of lineItems || []) {
    const list = liByOrder.get(li.order_id) || [];
    list.push(li);
    liByOrder.set(li.order_id, list);
  }

  // Enrich orders with summary
  const enriched = orders.map((order: any) => {
    const items = liByOrder.get(order.id) || [];
    const totalNeeded = items.reduce((s: number, li: any) => s + li.total_qty_needed, 0);
    const totalPicked = items.reduce((s: number, li: any) => s + li.total_picked, 0);

    return {
      ...order,
      summary: {
        total_line_items: items.length,
        total_parts_needed: totalNeeded,
        total_parts_picked: totalPicked,
        total_remaining: totalNeeded - totalPicked,
        percent_complete: totalNeeded > 0
          ? Math.round((totalPicked / totalNeeded) * 100)
          : 0,
      },
    };
  });

  return { data: enriched, error: null };
}
