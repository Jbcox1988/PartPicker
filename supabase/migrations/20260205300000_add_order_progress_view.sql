-- ============================================================
-- Order Progress View
-- Computes per-order pick progress using line_item_pick_totals
-- Used by the Dashboard to avoid fetching all line_items + picks
-- ============================================================

CREATE OR REPLACE VIEW order_progress AS
SELECT
  li.order_id,
  COUNT(*)::int AS total_items,
  COUNT(*) FILTER (WHERE lipt.total_picked >= li.total_qty_needed)::int AS picked_items,
  CASE WHEN COUNT(*) > 0
    THEN ROUND((COUNT(*) FILTER (WHERE lipt.total_picked >= li.total_qty_needed))::numeric / COUNT(*) * 100)
    ELSE 0
  END::int AS progress_percent
FROM line_items li
JOIN line_item_pick_totals lipt ON lipt.line_item_id = li.id
GROUP BY li.order_id;

COMMENT ON VIEW order_progress IS 'Per-order pick progress computed from line_item_pick_totals, used by Dashboard';
