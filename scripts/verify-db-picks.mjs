#!/usr/bin/env node

/**
 * Verify picks in database match Excel for parts with differences
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parts with known differences to verify
const partsToCheck = [
  '864323',    // NG1-NG4: 2, NG5: 0
  '202632PT',  // NG1-3: 3, NG4: 1, NG5: 0
  '634241PT',  // NG1: 1, NG2-5: 0
  '844833',    // NG1-2: 2, NG3: 1, NG4-5: 0
  '622980',    // NG1: 1, NG2-5: 0
];

async function verify() {
  // Get order
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('so_number', '3548')
    .single();

  // Get tools
  const { data: tools } = await supabase
    .from('tools')
    .select('id, tool_number')
    .eq('order_id', order.id)
    .order('tool_number');

  // Get line items for parts to check
  const { data: lineItems } = await supabase
    .from('line_items')
    .select('id, part_number')
    .eq('order_id', order.id)
    .in('part_number', partsToCheck);

  // Get picks for these line items
  const lineItemIds = lineItems.map(li => li.id);
  const { data: picks } = await supabase
    .from('picks')
    .select('line_item_id, tool_id, qty_picked')
    .in('line_item_id', lineItemIds);

  console.log('Verifying picks in database match Excel:\n');
  console.log('Part Number      | NG1 | NG2 | NG3 | NG4 | NG5');
  console.log('-----------------|-----|-----|-----|-----|-----');

  for (const partNum of partsToCheck) {
    const lineItem = lineItems.find(li => li.part_number === partNum);
    if (!lineItem) {
      console.log(`${partNum.padEnd(16)} | NOT IN DB`);
      continue;
    }

    const partPicks = picks.filter(p => p.line_item_id === lineItem.id);

    const toolQtys = {};
    for (const tool of tools) {
      const pick = partPicks.find(p => p.tool_id === tool.id);
      toolQtys[tool.tool_number] = pick?.qty_picked || 0;
    }

    console.log(
      `${partNum.padEnd(16)} | ${String(toolQtys['NG1'] || 0).padStart(3)} | ${String(toolQtys['NG2'] || 0).padStart(3)} | ${String(toolQtys['NG3'] || 0).padStart(3)} | ${String(toolQtys['NG4'] || 0).padStart(3)} | ${String(toolQtys['NG5'] || 0).padStart(3)}`
    );
  }

  console.log('\nExpected from Excel:');
  console.log('864323           |   2 |   2 |   2 |   2 |   0');
  console.log('202632PT         |   3 |   3 |   3 |   1 |   0');
  console.log('634241PT         |   1 |   0 |   0 |   0 |   0');
  console.log('844833           |   2 |   2 |   1 |   0 |   0');
  console.log('622980           |   1 |   0 |   0 |   0 |   0');
}

verify().catch(console.error);
