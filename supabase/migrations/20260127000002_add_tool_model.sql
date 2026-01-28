-- Add tool_model field to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tool_model TEXT;

-- Add quantity field (number of tools/units in the order)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
