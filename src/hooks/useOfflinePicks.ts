import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOnlineStatus, useOfflineQueue, syncOfflineQueue, QueuedPick } from './useOffline';
import type { Pick } from '@/types';

/**
 * Enhanced pick recording that works offline
 * - When online: Records picks directly to Supabase
 * - When offline: Queues picks locally and syncs when back online
 */
export function useOfflineAwarePicks() {
  const isOnline = useOnlineStatus();
  const { queue, queueCount, isSyncing, setIsSyncing, addToQueue, removeFromQueue } =
    useOfflineQueue();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  // Core record function that talks to Supabase
  const recordPickToServer = useCallback(
    async (
      lineItemId: string,
      toolId: string,
      qtyPicked: number,
      pickedBy?: string,
      notes?: string
    ): Promise<Pick | null> => {
      try {
        const { data, error } = await supabase
          .from('picks')
          .insert({
            line_item_id: lineItemId,
            tool_id: toolId,
            qty_picked: qtyPicked,
            picked_by: pickedBy || null,
            notes: notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Failed to record pick to server:', err);
        return null;
      }
    },
    []
  );

  // Main record function - handles online/offline automatically
  const recordPick = useCallback(
    async (
      lineItemId: string,
      toolId: string,
      qtyPicked: number,
      pickedBy?: string,
      notes?: string
    ): Promise<{ success: boolean; queued: boolean; pick?: Pick; queuedPick?: QueuedPick }> => {
      if (isOnline) {
        // Try to record directly
        const pick = await recordPickToServer(
          lineItemId,
          toolId,
          qtyPicked,
          pickedBy,
          notes
        );

        if (pick) {
          return { success: true, queued: false, pick };
        }

        // If failed while online, queue it for retry
        const queuedPick = addToQueue({
          lineItemId,
          toolId,
          qtyPicked,
          pickedBy,
          notes,
        });
        return { success: true, queued: true, queuedPick };
      } else {
        // Offline - queue the pick
        const queuedPick = addToQueue({
          lineItemId,
          toolId,
          qtyPicked,
          pickedBy,
          notes,
        });
        return { success: true, queued: true, queuedPick };
      }
    },
    [isOnline, recordPickToServer, addToQueue]
  );

  // Manual sync trigger
  const syncQueue = useCallback(async () => {
    if (queue.length === 0 || !isOnline || isSyncing) {
      return;
    }

    setSyncError(null);

    try {
      const result = await syncOfflineQueue(
        queue,
        recordPickToServer,
        removeFromQueue,
        setIsSyncing
      );

      setLastSyncResult(result);

      if (result.failed > 0) {
        setSyncError(`${result.failed} pick(s) failed to sync`);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    }
  }, [queue, isOnline, isSyncing, recordPickToServer, removeFromQueue, setIsSyncing]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing) {
      // Small delay to ensure network is stable
      const timer = setTimeout(() => {
        syncQueue();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, queueCount, isSyncing, syncQueue]);

  return {
    recordPick,
    isOnline,
    queueCount,
    isSyncing,
    syncQueue,
    syncError,
    lastSyncResult,
    clearSyncResult: () => setLastSyncResult(null),
  };
}
