import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LineItem, IssueType } from '@/types';
import { getIssueTypeLabel } from '@/hooks/useIssues';

const ISSUE_TYPES: IssueType[] = ['out_of_stock', 'wrong_part', 'damaged', 'other'];

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem: LineItem | null;
  onSubmit: (
    lineItemId: string,
    issueType: IssueType,
    description?: string
  ) => Promise<boolean>;
}

export function ReportIssueDialog({
  open,
  onOpenChange,
  lineItem,
  onSubmit,
}: ReportIssueDialogProps) {
  const [issueType, setIssueType] = useState<IssueType | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!lineItem || !issueType) return;

    setIsSubmitting(true);
    const success = await onSubmit(
      lineItem.id,
      issueType,
      description.trim() || undefined
    );

    if (success) {
      handleClose();
    }
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setIssueType('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Report Issue
          </DialogTitle>
          <DialogDescription>
            Report a problem with this part
          </DialogDescription>
        </DialogHeader>

        {lineItem && (
          <div className="space-y-4 py-4">
            {/* Part info */}
            <div className="rounded-lg bg-muted p-3">
              <p className="font-mono font-medium">{lineItem.part_number}</p>
              {lineItem.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {lineItem.description}
                </p>
              )}
              {lineItem.location && (
                <p className="text-sm text-muted-foreground">
                  Location: {lineItem.location}
                </p>
              )}
            </div>

            {/* Issue type */}
            <div className="space-y-2">
              <Label htmlFor="issueType">Issue Type *</Label>
              <Select
                value={issueType}
                onValueChange={(value) => setIssueType(value as IssueType)}
              >
                <SelectTrigger id="issueType">
                  <SelectValue placeholder="Select issue type..." />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getIssueTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details about the issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!issueType || isSubmitting}
          >
            {isSubmitting ? 'Reporting...' : 'Report Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
