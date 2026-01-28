import { RefreshCw } from 'lucide-react';
import { useServiceWorker } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  const { needsRefresh, refresh } = useServiceWorker();

  if (!needsRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-card p-4 shadow-lg">
      <RefreshCw className="h-5 w-5 text-primary" />
      <div className="flex-1">
        <p className="text-sm font-medium">Update Available</p>
        <p className="text-xs text-muted-foreground">
          A new version is ready
        </p>
      </div>
      <Button size="sm" onClick={refresh}>
        Update
      </Button>
    </div>
  );
}
