import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LineItem } from '@/types';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItems: LineItem[];
  defaultToolModel?: string;
  onSave: (name: string, toolModel: string | null) => Promise<boolean>;
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  lineItems,
  defaultToolModel,
  onSave,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState('');
  const [toolModel, setToolModel] = useState(defaultToolModel || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    const success = await onSave(name.trim(), toolModel.trim() || null);
    setIsSaving(false);

    if (success) {
      setName('');
      setToolModel(defaultToolModel || '');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save as BOM Template
          </DialogTitle>
          <DialogDescription>
            Save the current parts list as a reusable template for future orders.
            This will save {lineItems.length} part(s) to the template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 230Q Standard BOM"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tool-model">Tool Model (optional)</Label>
            <Input
              id="tool-model"
              value={toolModel}
              onChange={(e) => setToolModel(e.target.value)}
              placeholder="e.g., 230Q"
            />
            <p className="text-xs text-muted-foreground">
              Associate this template with a specific tool model for easier selection.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
