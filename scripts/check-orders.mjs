#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkOrders() {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, so_number')
    .order('so_number');

  console.log('All orders in database:\n');

  for (const order of orders || []) {
    const { data: tools } = await supabase
      .from('tools')
      .select('tool_number')
      .eq('order_id', order.id);

    const { count: lineItemCount } = await supabase
      .from('line_items')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', order.id);

    const { count: pickCount } = await supabase
      .from('picks')
      .select('*', { count: 'exact', head: true })
      .in('tool_id', tools?.map(t => t.id) || []);

    console.log(`SO-${order.so_number}:`);
    console.log(`  Tools: ${tools?.map(t => t.tool_number).join(', ') || 'none'}`);
    console.log(`  Line items: ${lineItemCount || 0}`);
    console.log(`  Picks recorded: ${pickCount || 0}`);
    console.log();
  }
}

checkOrders().catch(console.error);
