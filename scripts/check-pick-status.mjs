#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPicks() {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, so_number')
    .order('so_number');

  console.log('Pick status for all orders:\n');

  for (const order of orders || []) {
    const { data: tools } = await supabase
      .from('tools')
      .select('id, tool_number')
      .eq('order_id', order.id);

    const toolIds = tools?.map(t => t.id) || [];

    const { data: picks } = await supabase
      .from('picks')
      .select('id, tool_id, qty_picked')
      .in('tool_id', toolIds.length > 0 ? toolIds : ['none']);

    const pickCount = picks?.length || 0;
    const totalQty = picks?.reduce((sum, p) => sum + p.qty_picked, 0) || 0;

    console.log(`SO-${order.so_number}:`);
    console.log(`  Tools: ${tools?.map(t => t.tool_number).join(', ') || 'none'}`);
    console.log(`  Pick records: ${pickCount}`);
    console.log(`  Total qty picked: ${totalQty}`);
    console.log();
  }
}

checkPicks().catch(console.error);
