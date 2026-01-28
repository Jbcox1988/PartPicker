import { useState } from 'react';
import { Settings, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Tool } from '@/types';

interface ManageToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: Tool[];
  soNumber: string;
  onAddTool: (toolNumber: string, serialNumber?: string) => Promise<Tool | null>;
  onDeleteTool: (toolId: string) => Promise<boolean>;
  getToolPickCount: (toolId: string) => number;
  generateNextToolNumber: () => string;
}

export function ManageToolsDialog({
  open,
  onOpenChange,
  tools,
  soNumber,
  onAddTool,
  onDeleteTool,
  getToolPickCount,
  generateNextToolNumber,
}: ManageToolsDialogProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ tool_number: '', serial_number: '' });
  const [isAddingTool, setIsAddingTool] = useState(false);
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null);
  const [isDeletingTool, setIsDeletingTool] = useState(false);

  const handleStartAdding = () => {
    setAddForm({
      tool_number: generateNextToolNumber(),
      serial_number: '',
    });
    setIsAdding(true);
  };

  const handleCancelAdding = () => {
    setIsAdding(false);
    setAddForm({ tool_number: '', serial_number: '' });
  };

  const handleAddTool = async () => {
    if (!addForm.tool_number.trim()) return;

    setIsAddingTool(true);
    const result = await onAddTool(
      addForm.tool_number.trim(),
      addForm.serial_number.trim() || undefined
    );
    setIsAddingTool(false);

    if (result) {
      setIsAdding(false);
      setAddForm({ tool_number: '', serial_number: '' });
    }
  };

  const handleDeleteTool = async () => {
    if (!toolToDelete) return;

    setIsDeletingTool(true);
    await onDeleteTool(toolToDelete.id);
    setIsDeletingTool(false);
    setToolToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage Tools
            </DialogTitle>
            <DialogDescription>
              Add or remove tools for order SO-{soNumber}. Deleting a tool will also remove all of its pick records.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Tool List */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tools ({tools.length})</Label>
              {tools.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No tools defined for this order.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tools.map((tool) => {
                    const pickCount = getToolPickCount(tool.id);
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {tool.tool_number}
                          </Badge>
                          {tool.serial_number && (
                            <span className="text-sm text-muted-foreground">
                              SN: {tool.serial_number}
                            </span>
                          )}
                          {pickCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {pickCount} pick{pickCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setToolToDelete(tool)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Tool Section */}
            {isAdding ? (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                <Label className="text-sm font-medium">Add New Tool</Label>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="new_tool_number" className="text-xs">Tool Number</Label>
                    <Input
                      id="new_tool_number"
                      value={addForm.tool_number}
                      onChange={(e) => setAddForm({ ...addForm, tool_number: e.target.value })}
                      placeholder={`e.g., ${soNumber}-1`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new_serial_number" className="text-xs">Serial Number (Optional)</Label>
                    <Input
                      id="new_serial_number"
                      value={addForm.serial_number}
                      onChange={(e) => setAddForm({ ...addForm, serial_number: e.target.value })}
                      placeholder="Enter serial number"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelAdding}
                    disabled={isAddingTool}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddTool}
                    disabled={isAddingTool || !addForm.tool_number.trim()}
                  >
                    {isAddingTool ? 'Adding...' : 'Add Tool'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleStartAdding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tool
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tool Confirmation */}
      <AlertDialog open={!!toolToDelete} onOpenChange={(open) => !open && setToolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Tool?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Are you sure you want to delete tool <strong>{toolToDelete?.tool_number}</strong>?
                </p>
                {toolToDelete && getToolPickCount(toolToDelete.id) > 0 && (
                  <p className="mt-2 text-destructive font-medium">
                    Warning: This tool has {getToolPickCount(toolToDelete.id)} recorded pick(s) that will also be deleted.
                  </p>
                )}
                <p className="mt-2 font-medium">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTool}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTool}
              disabled={isDeletingTool}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTool ? 'Deleting...' : 'Delete Tool'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
