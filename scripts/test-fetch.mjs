#!/usr/bin/env node

/**
 * Test fetching data exactly like the frontend does
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uewypezgyyyfanltoyfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVld3lwZXpneXl5ZmFubHRveWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDI0NTgsImV4cCI6MjA4NTExODQ1OH0.01oMpnVsWlpJr6P_mqKdpK-q-kEz1E1TEMo4gNn_gLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simulate the useOrder hook's fetch
async function testFetch(orderId) {
  console.log(`\nTesting fetch for order: ${orderId}\n`);

  try {
    const [orderRes, toolsRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase.from('tools').select('*').eq('order_id', orderId).order('tool_number'),
      supabase.from('line_items').select('*').eq('order_id', orderId).order('part_number'),
    ]);

    console.log('Order result:', {
      data: orderRes.data ? { so_number: orderRes.data.so_number, id: orderRes.data.id } : null,
      error: orderRes.error,
    });

    console.log('\nTools result:', {
      count: toolsRes.data?.length || 0,
      tools: toolsRes.data?.map(t => t.tool_number) || [],
      error: toolsRes.error,
    });

    console.log('\nLine items result:', {
      count: itemsRes.data?.length || 0,
      error: itemsRes.error,
    });

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

// Get the order ID for SO-3548
async function main() {
  const { data: order } = await supabase
    .from('orders')
    .select('id, so_number')
    .eq('so_number', '3548')
    .single();

  if (order) {
    console.log(`Found SO-3548 with ID: ${order.id}`);
    await testFetch(order.id);
  } else {
    console.log('SO-3548 not found, testing with all orders...');

    const { data: orders } = await supabase.from('orders').select('id, so_number').limit(5);
    for (const o of orders || []) {
      await testFetch(o.id);
    }
  }
}

main().catch(console.error);
