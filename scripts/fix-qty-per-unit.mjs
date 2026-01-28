#!/usr/bin/env node

/**
 * Fix qty_per_unit for orders where it was incorrectly set to total_qty_needed
 * This script divides qty_per_unit by the number of tools for the order
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixOrder(soNumber) {
  console.log(`\nFixing order SO-${soNumber}...\n`);

  // Get the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, so_number')
    .eq('so_number', soNumber)
    .single();

  if (orderError || !order) {
    console.error(`Order SO-${soNumber} not found:`, orderError?.message);
    return;
  }

  console.log(`Found order: ${order.id}`);

  // Get tools for this order
  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('id, tool_number')
    .eq('order_id', order.id);

  if (toolsError) {
    console.error('Error fetching tools:', toolsError.message);
    return;
  }

  const toolCount = tools?.length || 1;
  console.log(`Tools: ${toolCount} (${tools?.map(t => t.tool_number).join(', ')})`);

  // Get line items for this order
  const { data: lineItems, error: itemsError } = await supabase
    .from('line_items')
    .select('id, part_number, qty_per_unit, total_qty_needed')
    .eq('order_id', order.id);

  if (itemsError) {
    console.error('Error fetching line items:', itemsError.message);
    return;
  }

  console.log(`\nLine items to fix: ${lineItems?.length || 0}`);

  // Check if fix is needed (qty_per_unit equals total_qty_needed)
  const needsFix = lineItems?.filter(item => item.qty_per_unit === item.total_qty_needed && toolCount > 1);

  if (!needsFix || needsFix.length === 0) {
    console.log('\nNo items need fixing (qty_per_unit already differs from total_qty_needed)');

    // Show current state
    console.log('\nCurrent state of first 5 items:');
    lineItems?.slice(0, 5).forEach(item => {
      console.log(`  ${item.part_number}: qty_per_unit=${item.qty_per_unit}, total=${item.total_qty_needed}`);
    });
    return;
  }

  console.log(`\nItems needing fix: ${needsFix.length}`);
  console.log('\nBefore fix (first 5):');
  needsFix.slice(0, 5).forEach(item => {
    const newQtyPerUnit = Math.ceil(item.total_qty_needed / toolCount);
    console.log(`  ${item.part_number}: ${item.qty_per_unit} -> ${newQtyPerUnit} per tool (total: ${item.total_qty_needed})`);
  });

  // Confirm before fixing
  console.log(`\n⚠️  This will update ${needsFix.length} line items.`);
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Update each line item
  let updated = 0;
  let errors = 0;

  for (const item of needsFix) {
    const newQtyPerUnit = Math.ceil(item.total_qty_needed / toolCount);

    const { error: updateError } = await supabase
      .from('line_items')
      .update({ qty_per_unit: newQtyPerUnit })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  Error updating ${item.part_number}:`, updateError.message);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\n✅ Updated ${updated} line items`);
  if (errors > 0) {
    console.log(`❌ ${errors} errors occurred`);
  }

  // Verify the fix
  console.log('\nVerifying fix (first 5 items):');
  const { data: verifyItems } = await supabase
    .from('line_items')
    .select('part_number, qty_per_unit, total_qty_needed')
    .eq('order_id', order.id)
    .limit(5);

  verifyItems?.forEach(item => {
    console.log(`  ${item.part_number}: qty_per_unit=${item.qty_per_unit}, total=${item.total_qty_needed}`);
  });
}

// Get SO number from command line
const soNumber = process.argv[2];

if (!soNumber) {
  console.log('Usage: node fix-qty-per-unit.mjs <SO_NUMBER>');
  console.log('Example: node fix-qty-per-unit.mjs 3548');
  process.exit(1);
}

fixOrder(soNumber).catch(console.error);
