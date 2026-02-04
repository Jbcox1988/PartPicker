import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityLogType } from '@/types';

interface ActivityLogInput {
  type: ActivityLogType;
  order_id: string;
  so_number: string;
  part_number?: string | null;
  description: string;
  performed_by?: string;
  details?: Record<string, unknown>;
}

export function useActivityLog() {
  const logActivity = useCallback(async (entry: ActivityLogInput) => {
    try {
      const { error } = await supabase.from('activity_log').insert({
        type: entry.type,
        order_id: entry.order_id,
        so_number: entry.so_number,
        part_number: entry.part_number ?? null,
        description: entry.description,
        performed_by: entry.performed_by ?? null,
        details: entry.details ?? null,
      });

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  }, []);

  return { logActivity };
}
