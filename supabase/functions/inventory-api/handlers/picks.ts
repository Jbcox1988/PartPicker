import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { successResponse, errorResponse } from "../lib/response.ts";

export async function handlePicksByOrder(params: URLSearchParams): Promise<Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const soNumber = params.get("so_number");
  if (!soNumber) {
    return errorResponse("Missing required parameter: so_number", 400);
  }

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, so_number, po_number, customer_name, order_date, due_date, status, tool_model, quantity")
    .eq("so_number", soNumber)
    .single();

  if (orderError) {
    if (orderError.code === "PGRST116") {
      return errorResponse(`Order not found: ${soNumber}`, 404);
    }
    return errorResponse(`Database error: ${orderError.message}`, 500);
  }

  // Fetch line items with pick totals for this order
  const { data: lineItems, error: liError } = await supabase
    .from("line_item_pick_totals")
    .select("*")
    .eq("order_id", order.id);

  if (liError) {
    return errorResponse(`Database error: ${liError.message}`, 500);
  }

  // Fetch individual picks with full details for this order
  const { data: picks, error: picksError } = await supabase
    .from("pick_details")
    .select("*")
    .eq("order_id", order.id)
    .order("picked_at", { ascending: false });

  if (picksError) {
    return errorResponse(`Database error: ${picksError.message}`, 500);
  }

  // Build summary
  const totalNeeded = (lineItems || []).reduce((sum: number, li: any) => sum + li.total_qty_needed, 0);
  const totalPicked = (lineItems || []).reduce((sum: number, li: any) => sum + li.total_picked, 0);

  return successResponse({
    order,
    line_items: (lineItems || []).map((li: any) => ({
      line_item_id: li.line_item_id,
      part_number: li.part_number,
      description: li.description,
      location: li.location,
      total_qty_needed: li.total_qty_needed,
      total_picked: li.total_picked,
      remaining: li.remaining,
      assembly_group: li.assembly_group,
    })),
    picks: (picks || []).map((p: any) => ({
      pick_id: p.pick_id,
      part_number: p.part_number,
      part_description: p.part_description,
      qty_picked: p.qty_picked,
      picked_by: p.picked_by,
      picked_at: p.picked_at,
      pick_notes: p.pick_notes,
      tool_number: p.tool_number,
      serial_number: p.serial_number,
    })),
    summary: {
      total_line_items: (lineItems || []).length,
      total_parts_needed: totalNeeded,
      total_parts_picked: totalPicked,
      total_remaining: totalNeeded - totalPicked,
      percent_complete: totalNeeded > 0
        ? Math.round((totalPicked / totalNeeded) * 100)
        : 0,
    },
  }, {
    so_number: soNumber,
  });
}
