import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { parseInventoryFile, type InventoryMap } from '@/lib/inventoryParser';

interface SyncResult {
  success: boolean;
  updatedCount: number;
  notFoundCount: number;
  errors: string[];
  notFoundParts: string[];
}

export function useInventorySync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const syncInventory = useCallback(async (file: File): Promise<SyncResult> => {
    setSyncing(true);
    const errors: string[] = [];
    const notFoundParts: string[] = [];
    let updatedCount = 0;
    let notFoundCount = 0;

    try {
      // Parse the inventory file
      const parseResult = await parseInventoryFile(file);

      if (!parseResult.success) {
        const result: SyncResult = {
          success: false,
          updatedCount: 0,
          notFoundCount: 0,
          errors: parseResult.errors,
          notFoundParts: []
        };
        setLastSyncResult(result);
        setSyncing(false);
        return result;
      }

      const inventory = parseResult.inventory;

      // Get all unique part numbers from line_items
      // Only select id and part_number - qty_available column may not exist yet
      const { data: lineItems, error: fetchError } = await supabase
        .from('line_items')
        .select('id, part_number');

      if (fetchError) {
        throw new Error(`Failed to fetch line items: ${fetchError.message}`);
      }

      if (!lineItems || lineItems.length === 0) {
        const result: SyncResult = {
          success: true,
          updatedCount: 0,
          notFoundCount: 0,
          errors: ['No line items found in database'],
          notFoundParts: []
        };
        setLastSyncResult(result);
        setSyncing(false);
        return result;
      }

      // Group line items by part number to avoid duplicate updates
      const partNumbersToUpdate = new Map<string, string[]>(); // part_number -> [line_item_ids]

      for (const item of lineItems) {
        const partNum = item.part_number;
        if (!partNumbersToUpdate.has(partNum)) {
          partNumbersToUpdate.set(partNum, []);
        }
        partNumbersToUpdate.get(partNum)!.push(item.id);
      }

      // Track if qty_available column exists (we'll detect on first update attempt)
      let qtyAvailableColumnExists = true;

      // Update each part number's line items with inventory data
      for (const [partNumber, lineItemIds] of partNumbersToUpdate) {
        const invRecord = inventory[partNumber];

        if (invRecord) {
          let updateSucceeded = false;

          // Try updating both location and qty_available
          if (qtyAvailableColumnExists) {
            const { error: updateError } = await supabase
              .from('line_items')
              .update({
                location: invRecord.location,
                qty_available: invRecord.qtyAvailable
              })
              .in('id', lineItemIds);

            if (updateError) {
              // Check if it's because column doesn't exist (handles both error formats)
              const errMsg = updateError.message.toLowerCase();
              if (errMsg.includes('qty_available') && (errMsg.includes('does not exist') || errMsg.includes('could not find') || errMsg.includes('schema cache'))) {
                qtyAvailableColumnExists = false;
                // Will fall through to location-only update below
              } else {
                errors.push(`Failed to update ${partNumber}: ${updateError.message}`);
                continue;
              }
            } else {
              updateSucceeded = true;
              updatedCount += lineItemIds.length;
            }
          }

          // Fall back to just updating location if qty_available column doesn't exist
          if (!qtyAvailableColumnExists && !updateSucceeded) {
            const { error: updateError } = await supabase
              .from('line_items')
              .update({
                location: invRecord.location
              })
              .in('id', lineItemIds);

            if (updateError) {
              errors.push(`Failed to update ${partNumber}: ${updateError.message}`);
            } else {
              updatedCount += lineItemIds.length;
            }
          }
        } else {
          notFoundCount += lineItemIds.length;
          if (!notFoundParts.includes(partNumber)) {
            notFoundParts.push(partNumber);
          }
        }
      }

      // Add warning if qty_available column doesn't exist
      if (!qtyAvailableColumnExists) {
        errors.push('Note: qty_available column not found - only locations were updated. Run the migration SQL in Settings to enable stock tracking.');
      }

      const result: SyncResult = {
        success: errors.length === 0,
        updatedCount,
        notFoundCount,
        errors,
        notFoundParts
      };

      setLastSyncResult(result);
      setSyncing(false);
      return result;

    } catch (error) {
      const result: SyncResult = {
        success: false,
        updatedCount,
        notFoundCount,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        notFoundParts
      };
      setLastSyncResult(result);
      setSyncing(false);
      return result;
    }
  }, []);

  return {
    syncInventory,
    syncing,
    lastSyncResult
  };
}
