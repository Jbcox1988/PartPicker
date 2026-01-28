#!/usr/bin/env node

/**
 * Delete the grey rows from SO-3548
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parts to delete (grey rows)
const partsToDelete = [
  '680910PT',
  '621288',
  '864241',
  '613733',
  '642283PT',
  '642286PT',
  '617962',
  '624341'
];

async function deleteGreyRows() {
  console.log('Deleting grey rows from SO-3548...\n');

  // Get order ID
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('so_number', '3548')
    .single();

  if (!order) {
    console.error('Order SO-3548 not found');
    return;
  }

  console.log(`Order ID: ${order.id}\n`);

  let deleted = 0;
  let notFound = 0;

  for (const partNumber of partsToDelete) {
    const { data: items, error: findError } = await supabase
      .from('line_items')
      .select('id, part_number')
      .eq('order_id', order.id)
      .eq('part_number', partNumber);

    if (findError) {
      console.error(`  Error finding ${partNumber}:`, findError.message);
      continue;
    }

    if (!items || items.length === 0) {
      console.log(`  ${partNumber}: not found (may already be deleted)`);
      notFound++;
      continue;
    }

    // Delete all matching items (in case of duplicates)
    for (const item of items) {
      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('id', item.id);

      if (deleteError) {
        console.error(`  Error deleting ${partNumber}:`, deleteError.message);
      } else {
        console.log(`  ✓ Deleted: ${partNumber}`);
        deleted++;
      }
    }
  }

  console.log(`\n✅ Deleted ${deleted} line items`);
  if (notFound > 0) {
    console.log(`ℹ️  ${notFound} parts were not found`);
  }

  // Show remaining count
  const { count } = await supabase
    .from('line_items')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', order.id);

  console.log(`\nRemaining line items in SO-3548: ${count}`);
}

deleteGreyRows().catch(console.error);
