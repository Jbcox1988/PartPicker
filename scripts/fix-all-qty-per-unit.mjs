#!/usr/bin/env node

/**
 * Fix qty_per_unit for all orders where it equals total_qty_needed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixOrder(soNumber) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Fixing SO-${soNumber}`);
  console.log('='.repeat(50));

  // Get the order
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('so_number', soNumber)
    .single();

  if (!order) {
    console.log(`Order not found`);
    return;
  }

  // Get tools count
  const { data: tools } = await supabase
    .from('tools')
    .select('id, tool_number')
    .eq('order_id', order.id);

  const toolCount = tools?.length || 1;
  console.log(`Tools: ${toolCount} (${tools?.map(t => t.tool_number).join(', ')})`);

  if (toolCount <= 1) {
    console.log('Only 1 tool - no fix needed');
    return;
  }

  // Get line items
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, part_number, qty_per_unit, total_qty_needed')
    .eq('order_id', order.id);

  // Find items where qty_per_unit equals total_qty_needed (wrong)
  const needsFix = lineItems?.filter(item =>
    item.qty_per_unit === item.total_qty_needed && toolCount > 1
  ) || [];

  if (needsFix.length === 0) {
    console.log('No items need fixing');
    return;
  }

  console.log(`Items to fix: ${needsFix.length}`);
  console.log('\nSample before fix:');
  needsFix.slice(0, 3).forEach(item => {
    const newQty = Math.ceil(item.total_qty_needed / toolCount);
    console.log(`  ${item.part_number}: ${item.qty_per_unit} -> ${newQty} (total: ${item.total_qty_needed})`);
  });

  // Update each line item
  let updated = 0;
  for (const item of needsFix) {
    const newQtyPerUnit = Math.ceil(item.total_qty_needed / toolCount);

    const { error } = await supabase
      .from('line_items')
      .update({ qty_per_unit: newQtyPerUnit })
      .eq('id', item.id);

    if (!error) updated++;
  }

  console.log(`\n✅ Updated ${updated} line items`);
}

async function main() {
  const orders = ['3137', '3138', '3317', '3444', '3548'];

  for (const so of orders) {
    await fixOrder(so);
  }

  console.log('\n\nDone!');
}

main().catch(console.error);
