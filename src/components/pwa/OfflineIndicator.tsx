import { WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus, useOfflineQueue } from '@/hooks/useOffline';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { queueCount, isSyncing } = useOfflineQueue();

  if (isOnline && queueCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition-all duration-300',
        !isOnline
          ? 'bg-amber-500 text-white'
          : isSyncing
            ? 'bg-blue-500 text-white'
            : 'bg-amber-500 text-white'
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline</span>
          {queueCount > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {queueCount} queued
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Syncing...</span>
        </>
      ) : queueCount > 0 ? (
        <>
          <CloudOff className="h-4 w-4" />
          <span>{queueCount} picks pending sync</span>
        </>
      ) : null}
    </div>
  );
}
