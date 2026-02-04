-- ============================================================
-- Inventory API Views & Functions
-- Provides server-side aggregation for the inventory-api edge function
-- ============================================================

-- 1. Line item pick totals
-- Joins line_items + picks, computes total_picked and remaining per line item
CREATE OR REPLACE VIEW line_item_pick_totals AS
SELECT
  li.id AS line_item_id,
  li.order_id,
  li.part_number,
  li.description,
  li.location,
  li.qty_available,
  li.qty_on_order,
  li.total_qty_needed,
  li.qty_per_unit,
  li.assembly_group,
  COALESCE(SUM(p.qty_picked), 0)::int AS total_picked,
  (li.total_qty_needed - COALESCE(SUM(p.qty_picked), 0))::int AS remaining
FROM line_items li
LEFT JOIN picks p ON p.line_item_id = li.id
GROUP BY li.id;

-- 2. Pick details
-- Full pick context: picks -> line_items -> orders -> tools
CREATE OR REPLACE VIEW pick_details AS
SELECT
  p.id AS pick_id,
  p.qty_picked,
  p.picked_by,
  p.picked_at,
  p.notes AS pick_notes,
  li.id AS line_item_id,
  li.part_number,
  li.description AS part_description,
  li.location,
  li.total_qty_needed,
  o.id AS order_id,
  o.so_number,
  o.po_number,
  o.customer_name,
  o.order_date,
  o.due_date,
  o.status AS order_status,
  o.tool_model AS order_tool_model,
  t.id AS tool_id,
  t.tool_number,
  t.serial_number,
  t.status AS tool_status,
  t.tool_model
FROM picks p
JOIN line_items li ON li.id = p.line_item_id
JOIN orders o ON o.id = li.order_id
JOIN tools t ON t.id = p.tool_id;

-- 3. Consolidated remaining
-- Groups by part_number across active orders, calculates qty_to_order
-- Mirrors useConsolidatedParts.ts + useItemsToOrder.ts logic
CREATE OR REPLACE VIEW consolidated_remaining AS
WITH part_totals AS (
  SELECT
    li.part_number,
    MIN(li.description) AS description,
    MIN(li.location) AS location,
    -- Use first non-null qty_available (same part should have same value)
    MAX(li.qty_available) AS qty_available,
    MAX(li.qty_on_order) AS qty_on_order,
    SUM(li.total_qty_needed)::int AS total_needed,
    COALESCE(SUM(p.qty_picked), 0)::int AS total_picked,
    (SUM(li.total_qty_needed) - COALESCE(SUM(p.qty_picked), 0))::int AS remaining
  FROM line_items li
  JOIN orders o ON o.id = li.order_id
  LEFT JOIN picks p ON p.line_item_id = li.id
  WHERE o.status = 'active'
  GROUP BY li.part_number
  HAVING (SUM(li.total_qty_needed) - COALESCE(SUM(p.qty_picked), 0)) > 0
)
SELECT
  pt.*,
  GREATEST(
    0,
    pt.remaining - COALESCE(pt.qty_available, 0) - COALESCE(pt.qty_on_order, 0)
  )::int AS qty_to_order
FROM part_totals pt
ORDER BY pt.part_number;

-- 4. Completed order summaries
-- Completed orders with aggregated pick totals
CREATE OR REPLACE VIEW completed_order_summaries AS
SELECT
  o.id AS order_id,
  o.so_number,
  o.po_number,
  o.customer_name,
  o.order_date,
  o.due_date,
  o.tool_model,
  o.quantity,
  o.updated_at AS completed_at,
  COUNT(DISTINCT li.id)::int AS total_line_items,
  COALESCE(SUM(li.total_qty_needed), 0)::int AS total_parts_needed,
  COALESCE(SUM(pick_sums.total_picked), 0)::int AS total_parts_picked
FROM orders o
LEFT JOIN line_items li ON li.order_id = o.id
LEFT JOIN (
  SELECT
    line_item_id,
    SUM(qty_picked)::int AS total_picked
  FROM picks
  GROUP BY line_item_id
) pick_sums ON pick_sums.line_item_id = li.id
WHERE o.status = 'complete'
GROUP BY o.id
ORDER BY o.updated_at DESC;

-- 5. get_consolidated_parts() function
-- Postgres function that supports include_fully_picked flag
CREATE OR REPLACE FUNCTION get_consolidated_parts(include_fully_picked boolean DEFAULT false)
RETURNS TABLE (
  part_number text,
  description text,
  location text,
  qty_available int,
  qty_on_order int,
  total_needed int,
  total_picked int,
  remaining int,
  qty_to_order int
)
LANGUAGE sql
STABLE
AS $$
  WITH part_totals AS (
    SELECT
      li.part_number,
      MIN(li.description) AS description,
      MIN(li.location) AS location,
      MAX(li.qty_available)::int AS qty_available,
      MAX(li.qty_on_order)::int AS qty_on_order,
      SUM(li.total_qty_needed)::int AS total_needed,
      COALESCE(SUM(p.qty_picked), 0)::int AS total_picked,
      (SUM(li.total_qty_needed) - COALESCE(SUM(p.qty_picked), 0))::int AS remaining
    FROM line_items li
    JOIN orders o ON o.id = li.order_id
    LEFT JOIN picks p ON p.line_item_id = li.id
    WHERE o.status = 'active'
    GROUP BY li.part_number
  )
  SELECT
    pt.part_number,
    pt.description,
    pt.location,
    pt.qty_available,
    pt.qty_on_order,
    pt.total_needed,
    pt.total_picked,
    pt.remaining,
    GREATEST(
      0,
      pt.remaining - COALESCE(pt.qty_available, 0) - COALESCE(pt.qty_on_order, 0)
    )::int AS qty_to_order
  FROM part_totals pt
  WHERE include_fully_picked OR pt.remaining > 0
  ORDER BY pt.part_number;
$$;

-- Add helpful comments
COMMENT ON VIEW line_item_pick_totals IS 'Per-line-item pick aggregation for the inventory API';
COMMENT ON VIEW pick_details IS 'Denormalized pick details with full order/tool context';
COMMENT ON VIEW consolidated_remaining IS 'Per-part remaining quantities across active orders with qty_to_order';
COMMENT ON VIEW completed_order_summaries IS 'Completed orders with aggregated pick statistics';
COMMENT ON FUNCTION get_consolidated_parts IS 'Returns consolidated parts with optional include_fully_picked flag';
