-- Issues table for reporting problems with parts
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id UUID REFERENCES line_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('out_of_stock', 'wrong_part', 'damaged', 'other')),
  description TEXT,
  reported_by TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

-- Enable Row Level Security
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous access (development)
CREATE POLICY "Allow all operations on issues" ON issues FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE issues;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_line_item_id ON issues(line_item_id);
CREATE INDEX IF NOT EXISTS idx_issues_order_id ON issues(order_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
