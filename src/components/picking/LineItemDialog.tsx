import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { LineItem } from '@/types';
import type { LineItemInput } from '@/hooks/useLineItems';

interface LineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: LineItemInput) => Promise<boolean>;
  lineItem?: LineItem | null;
  isLoading?: boolean;
}

export function LineItemDialog({
  open,
  onOpenChange,
  onSave,
  lineItem,
  isLoading = false,
}: LineItemDialogProps) {
  const isEditMode = !!lineItem;

  const [formData, setFormData] = useState<LineItemInput>({
    part_number: '',
    description: '',
    location: '',
    qty_per_unit: 1,
    total_qty_needed: 1,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes or lineItem changes
  useEffect(() => {
    if (open) {
      if (lineItem) {
        setFormData({
          part_number: lineItem.part_number,
          description: lineItem.description || '',
          location: lineItem.location || '',
          qty_per_unit: lineItem.qty_per_unit,
          total_qty_needed: lineItem.total_qty_needed,
        });
      } else {
        setFormData({
          part_number: '',
          description: '',
          location: '',
          qty_per_unit: 1,
          total_qty_needed: 1,
        });
      }
      setErrors({});
    }
  }, [open, lineItem]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.part_number.trim()) {
      newErrors.part_number = 'Part number is required';
    }

    if (formData.qty_per_unit < 1) {
      newErrors.qty_per_unit = 'Quantity per unit must be at least 1';
    }

    if (formData.total_qty_needed < 1) {
      newErrors.total_qty_needed = 'Total quantity needed must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const success = await onSave({
      part_number: formData.part_number.trim(),
      description: formData.description?.trim() || null,
      location: formData.location?.trim() || null,
      qty_per_unit: formData.qty_per_unit,
      total_qty_needed: formData.total_qty_needed,
    });

    if (success) {
      onOpenChange(false);
    }
  };

  const handleInputChange = (field: keyof LineItemInput, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Line Item' : 'Add Line Item'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the details for this line item.'
              : 'Enter the details for the new line item.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Part Number */}
          <div className="space-y-2">
            <Label htmlFor="part_number">
              Part Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="part_number"
              value={formData.part_number}
              onChange={(e) => handleInputChange('part_number', e.target.value)}
              placeholder="e.g., ABC-12345"
              className={errors.part_number ? 'border-red-500' : ''}
            />
            {errors.part_number && (
              <p className="text-sm text-red-500">{errors.part_number}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="e.g., Hex Bolt M8x30"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="e.g., A-01-03"
            />
          </div>

          {/* Quantity Fields */}
          <div className="grid grid-cols-2 gap-4">
            {/* Qty Per Unit */}
            <div className="space-y-2">
              <Label htmlFor="qty_per_unit">
                Qty Per Unit <span className="text-red-500">*</span>
              </Label>
              <Input
                id="qty_per_unit"
                type="number"
                min="1"
                value={formData.qty_per_unit}
                onChange={(e) => handleInputChange('qty_per_unit', parseInt(e.target.value) || 1)}
                className={errors.qty_per_unit ? 'border-red-500' : ''}
              />
              {errors.qty_per_unit && (
                <p className="text-sm text-red-500">{errors.qty_per_unit}</p>
              )}
            </div>

            {/* Total Qty Needed */}
            <div className="space-y-2">
              <Label htmlFor="total_qty_needed">
                Total Qty Needed <span className="text-red-500">*</span>
              </Label>
              <Input
                id="total_qty_needed"
                type="number"
                min="1"
                value={formData.total_qty_needed}
                onChange={(e) => handleInputChange('total_qty_needed', parseInt(e.target.value) || 1)}
                className={errors.total_qty_needed ? 'border-red-500' : ''}
              />
              {errors.total_qty_needed && (
                <p className="text-sm text-red-500">{errors.total_qty_needed}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditMode ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
