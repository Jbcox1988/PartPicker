#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // Get orders with their IDs
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, so_number')
    .order('so_number');

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    return;
  }

  console.log('Orders with IDs:\n');

  for (const order of orders) {
    console.log(`SO-${order.so_number}: ${order.id}`);

    // Fetch tools for this order
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, tool_number, order_id')
      .eq('order_id', order.id)
      .order('tool_number');

    if (toolsError) {
      console.error(`  Error fetching tools:`, toolsError);
      continue;
    }

    console.log(`  Tools (${tools.length}):`);
    tools.forEach(t => console.log(`    - ${t.tool_number} (order_id: ${t.order_id})`));

    // Fetch line items count
    const { count, error: lineItemsError } = await supabase
      .from('line_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id);

    if (lineItemsError) {
      console.error(`  Error fetching line items:`, lineItemsError);
    } else {
      console.log(`  Line Items: ${count}`);
    }

    console.log();
  }
}

main().catch(console.error);
