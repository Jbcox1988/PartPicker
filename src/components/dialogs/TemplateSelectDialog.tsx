import { useState, useEffect } from 'react';
import { FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBOMTemplates } from '@/hooks/useBOMTemplates';
import type { BOMTemplate, BOMTemplateWithItems } from '@/types';

interface TemplateSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: BOMTemplateWithItems) => void;
}

export function TemplateSelectDialog({
  open,
  onOpenChange,
  onSelect,
}: TemplateSelectDialogProps) {
  const { templates, loading, getTemplateWithItems } = useBOMTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<BOMTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTemplate(null);
    }
  }, [open]);

  const handleSelect = async () => {
    if (!selectedTemplate) return;

    setIsLoading(true);
    const templateWithItems = await getTemplateWithItems(selectedTemplate.id);
    setIsLoading(false);

    if (templateWithItems) {
      onSelect(templateWithItems);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select BOM Template
          </DialogTitle>
          <DialogDescription>
            Choose a saved BOM template to pre-populate the order with parts.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No templates saved yet. Create a template from an existing order.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {template.name}
                        {selectedTemplate?.id === template.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      {template.tool_model && (
                        <Badge variant="outline" className="mt-1">
                          {template.tool_model}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(template.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedTemplate || isLoading}
          >
            {isLoading ? 'Loading...' : 'Use Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
