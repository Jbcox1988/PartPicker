import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { PartConflict } from '@/types';

interface DuplicatePartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: PartConflict[];
  onResolve: (resolvedConflicts: PartConflict[]) => void;
}

export function DuplicatePartsDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
}: DuplicatePartsDialogProps) {
  const [resolvedConflicts, setResolvedConflicts] = useState<PartConflict[]>(
    conflicts.map(c => ({ ...c, action: null }))
  );

  // Update when conflicts change
  useState(() => {
    setResolvedConflicts(conflicts.map(c => ({ ...c, action: null })));
  });

  const handleSetAction = (partNumber: string, action: 'keep' | 'update') => {
    setResolvedConflicts(prev =>
      prev.map(c =>
        c.part_number === partNumber ? { ...c, action } : c
      )
    );
  };

  const handleKeepAll = () => {
    setResolvedConflicts(prev =>
      prev.map(c => ({ ...c, action: 'keep' as const }))
    );
  };

  const handleUpdateAll = () => {
    setResolvedConflicts(prev =>
      prev.map(c => ({ ...c, action: 'update' as const }))
    );
  };

  const handleContinue = () => {
    // Default any unresolved conflicts to 'keep'
    const finalResolved = resolvedConflicts.map(c => ({
      ...c,
      action: c.action || ('keep' as const),
    }));
    onResolve(finalResolved);
  };

  const allResolved = resolvedConflicts.every(c => c.action !== null);
  const resolvedCount = resolvedConflicts.filter(c => c.action !== null).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Part Description Conflicts
          </DialogTitle>
          <DialogDescription>
            The following parts have different descriptions than what's saved in your parts catalog.
            Choose whether to keep the saved description or update it with the import description.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="border rounded-lg">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium border-b sticky top-0">
              <div className="col-span-2">Part #</div>
              <div className="col-span-4">Saved Description</div>
              <div className="col-span-4">Import Description</div>
              <div className="col-span-2 text-center">Action</div>
            </div>

            {/* Conflict Rows */}
            <div className="divide-y">
              {resolvedConflicts.map((conflict) => (
                <div
                  key={conflict.part_number}
                  className="grid grid-cols-12 gap-2 p-3 items-center text-sm"
                >
                  <div className="col-span-2 font-mono font-medium">
                    {conflict.part_number}
                  </div>
                  <div className="col-span-4 text-muted-foreground">
                    {conflict.saved_description || '-'}
                  </div>
                  <div className="col-span-4">
                    {conflict.import_description || '-'}
                  </div>
                  <div className="col-span-2 flex justify-center gap-1">
                    <Button
                      size="sm"
                      variant={conflict.action === 'keep' ? 'default' : 'outline'}
                      className="h-7 px-2 text-xs"
                      onClick={() => handleSetAction(conflict.part_number, 'keep')}
                    >
                      Keep
                    </Button>
                    <Button
                      size="sm"
                      variant={conflict.action === 'update' ? 'default' : 'outline'}
                      className="h-7 px-2 text-xs"
                      onClick={() => handleSetAction(conflict.part_number, 'update')}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 border-t pt-4">
          <div className="flex items-center gap-2 mr-auto">
            <Badge variant="outline">
              {resolvedCount}/{conflicts.length} resolved
            </Badge>
            <Button variant="outline" size="sm" onClick={handleKeepAll}>
              Keep All Saved
            </Button>
            <Button variant="outline" size="sm" onClick={handleUpdateAll}>
              Update All to Import
            </Button>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleContinue}>
            {allResolved ? 'Continue' : 'Continue (Keep Unresolved)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
