import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { LineItem } from '@/types';

export interface LineItemInput {
  part_number: string;
  description?: string | null;
  location?: string | null;
  qty_per_unit: number;
  total_qty_needed: number;
}

export function useLineItems(orderId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLineItem = useCallback(async (
    input: LineItemInput
  ): Promise<LineItem | null> => {
    if (!orderId) {
      setError('No order ID provided');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: insertError } = await supabase
        .from('line_items')
        .insert({
          order_id: orderId,
          part_number: input.part_number,
          description: input.description || null,
          location: input.location || null,
          qty_per_unit: input.qty_per_unit,
          total_qty_needed: input.total_qty_needed,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add line item';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const updateLineItem = useCallback(async (
    lineItemId: string,
    input: Partial<LineItemInput>
  ): Promise<LineItem | null> => {
    try {
      setLoading(true);
      setError(null);

      const updateData: Record<string, unknown> = {};

      if (input.part_number !== undefined) {
        updateData.part_number = input.part_number;
      }
      if (input.description !== undefined) {
        updateData.description = input.description || null;
      }
      if (input.location !== undefined) {
        updateData.location = input.location || null;
      }
      if (input.qty_per_unit !== undefined) {
        updateData.qty_per_unit = input.qty_per_unit;
      }
      if (input.total_qty_needed !== undefined) {
        updateData.total_qty_needed = input.total_qty_needed;
      }

      const { data, error: updateError } = await supabase
        .from('line_items')
        .update(updateData)
        .eq('id', lineItemId)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update line item';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteLineItem = useCallback(async (
    lineItemId: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('line_items')
        .delete()
        .eq('id', lineItemId);

      if (deleteError) throw deleteError;
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete line item';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    clearError,
  };
}
