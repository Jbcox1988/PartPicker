import { useState, useEffect, useCallback } from 'react';

// Types for offline pick queue
export interface QueuedPick {
  id: string;
  lineItemId: string;
  toolId: string;
  qtyPicked: number;
  pickedBy?: string;
  notes?: string;
  timestamp: string;
}

const OFFLINE_QUEUE_KEY = 'offline-picks-queue';

// Hook to detect online/offline status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Hook for managing the offline queue
export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedPick[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        setQueue(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }, [queue]);

  // Add a pick to the queue
  const addToQueue = useCallback((pick: Omit<QueuedPick, 'id' | 'timestamp'>) => {
    const newPick: QueuedPick = {
      ...pick,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setQueue((prev) => [...prev, newPick]);
    return newPick;
  }, []);

  // Remove a pick from the queue (after successful sync)
  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Clear the entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Get queue count
  const queueCount = queue.length;

  return {
    queue,
    queueCount,
    isOnline,
    isSyncing,
    setIsSyncing,
    addToQueue,
    removeFromQueue,
    clearQueue,
  };
}

// Sync function to be called when back online
export async function syncOfflineQueue(
  queue: QueuedPick[],
  recordPick: (
    lineItemId: string,
    toolId: string,
    qtyPicked: number,
    pickedBy?: string,
    notes?: string
  ) => Promise<unknown>,
  removeFromQueue: (id: string) => void,
  setIsSyncing: (syncing: boolean) => void
): Promise<{ success: number; failed: number }> {
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  setIsSyncing(true);
  let success = 0;
  let failed = 0;

  for (const pick of queue) {
    try {
      const result = await recordPick(
        pick.lineItemId,
        pick.toolId,
        pick.qtyPicked,
        pick.pickedBy,
        pick.notes
      );

      if (result) {
        removeFromQueue(pick.id);
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error('Failed to sync pick:', e);
      failed++;
    }
  }

  setIsSyncing(false);
  return { success, failed };
}

// Combined hook for offline-aware picks
export function useOfflinePicks() {
  const offlineQueue = useOfflineQueue();

  // Auto-sync when coming back online
  useEffect(() => {
    if (offlineQueue.isOnline && offlineQueue.queueCount > 0 && !offlineQueue.isSyncing) {
      // Emit custom event for components to handle sync
      window.dispatchEvent(
        new CustomEvent('offline-queue-ready-to-sync', {
          detail: { count: offlineQueue.queueCount },
        })
      );
    }
  }, [offlineQueue.isOnline, offlineQueue.queueCount, offlineQueue.isSyncing]);

  return offlineQueue;
}
