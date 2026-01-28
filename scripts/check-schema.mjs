#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // Test fetching an order with tools directly
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .limit(1);

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    return;
  }

  console.log('Sample order fields:', Object.keys(orders[0] || {}));
  console.log('Sample order:', orders[0]);

  // Test fetching tools for a specific order
  const testOrderId = 'd2cc5f61-62da-49f7-b2e9-139db8258922'; // SO-3548
  console.log('\nFetching tools for order:', testOrderId);

  const { data: tools, error: toolsError } = await supabase
    .from('tools')
    .select('*')
    .eq('order_id', testOrderId)
    .order('tool_number');

  if (toolsError) {
    console.error('Error fetching tools:', toolsError);
    return;
  }

  console.log('Tools found:', tools.length);
  console.log('Tools:', tools.map(t => t.tool_number));
}

main().catch(console.error);
