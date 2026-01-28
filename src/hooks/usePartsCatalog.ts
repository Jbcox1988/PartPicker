import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllFromTable } from '@/lib/supabasePagination';
import type { PartsCatalogItem, PartConflict, ImportedLineItem } from '@/types';

export function usePartsCatalog() {
  const [parts, setParts] = useState<PartsCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use pagination to handle >1000 parts in catalog
      const data = await fetchAllFromTable<PartsCatalogItem>(
        'parts_catalog',
        '*',
        { order: { column: 'part_number', ascending: true } }
      );

      setParts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch parts catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  /**
   * Check imported line items against the catalog and return conflicts
   */
  const checkForConflicts = useCallback((importedItems: ImportedLineItem[]): PartConflict[] => {
    const conflicts: PartConflict[] = [];
    const catalogMap = new Map(parts.map(p => [p.part_number, p]));

    for (const item of importedItems) {
      const catalogItem = catalogMap.get(item.part_number);
      if (catalogItem) {
        // Check if description differs
        const savedDesc = catalogItem.description || '';
        const importDesc = item.description || '';
        const savedLoc = catalogItem.default_location || '';
        const importLoc = item.location || '';

        if (savedDesc !== importDesc || savedLoc !== importLoc) {
          conflicts.push({
            part_number: item.part_number,
            saved_description: catalogItem.description,
            import_description: item.description || null,
            saved_location: catalogItem.default_location,
            import_location: item.location || null,
            action: null,
          });
        }
      }
    }

    return conflicts;
  }, [parts]);

  /**
   * Apply resolved conflicts - update catalog where action is 'update'
   */
  const applyConflictResolutions = useCallback(async (
    resolvedConflicts: PartConflict[]
  ): Promise<boolean> => {
    try {
      const updatePromises = resolvedConflicts
        .filter(c => c.action === 'update')
        .map(c =>
          supabase
            .from('parts_catalog')
            .update({
              description: c.import_description,
              default_location: c.import_location,
              updated_at: new Date().toISOString(),
            })
            .eq('part_number', c.part_number)
        );

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        await fetchParts();
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply conflict resolutions');
      return false;
    }
  }, [fetchParts]);

  /**
   * Save new parts from import to the catalog
   */
  const savePartsFromImport = useCallback(async (
    items: ImportedLineItem[],
    skipExisting: boolean = true
  ): Promise<boolean> => {
    try {
      const catalogMap = new Map(parts.map(p => [p.part_number, p]));

      const newParts = items
        .filter(item => !skipExisting || !catalogMap.has(item.part_number))
        .map(item => ({
          part_number: item.part_number,
          description: item.description || null,
          default_location: item.location || null,
        }));

      if (newParts.length === 0) return true;

      // Use upsert to handle duplicates
      const { error: insertError } = await supabase
        .from('parts_catalog')
        .upsert(newParts, {
          onConflict: 'part_number',
          ignoreDuplicates: skipExisting,
        });

      if (insertError) throw insertError;
      await fetchParts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save parts to catalog');
      return false;
    }
  }, [parts, fetchParts]);

  /**
   * Get part from catalog by part number
   */
  const getPart = useCallback((partNumber: string): PartsCatalogItem | undefined => {
    return parts.find(p => p.part_number === partNumber);
  }, [parts]);

  /**
   * Search parts catalog
   */
  const searchParts = useCallback((query: string): PartsCatalogItem[] => {
    const lowerQuery = query.toLowerCase();
    return parts.filter(p =>
      p.part_number.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery)
    );
  }, [parts]);

  /**
   * Add a single part to the catalog
   */
  const addPart = useCallback(async (
    partNumber: string,
    description?: string,
    location?: string
  ): Promise<PartsCatalogItem | null> => {
    try {
      const { data, error: insertError } = await supabase
        .from('parts_catalog')
        .insert({
          part_number: partNumber,
          description: description || null,
          default_location: location || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      await fetchParts();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add part to catalog');
      return null;
    }
  }, [fetchParts]);

  /**
   * Update a part in the catalog
   */
  const updatePart = useCallback(async (
    partNumber: string,
    updates: { description?: string; default_location?: string }
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('parts_catalog')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('part_number', partNumber);

      if (updateError) throw updateError;
      await fetchParts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update part');
      return false;
    }
  }, [fetchParts]);

  /**
   * Delete a part from the catalog
   */
  const deletePart = useCallback(async (partNumber: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('parts_catalog')
        .delete()
        .eq('part_number', partNumber);

      if (deleteError) throw deleteError;
      await fetchParts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete part');
      return false;
    }
  }, [fetchParts]);

  return {
    parts,
    loading,
    error,
    refresh: fetchParts,
    checkForConflicts,
    applyConflictResolutions,
    savePartsFromImport,
    getPart,
    searchParts,
    addPart,
    updatePart,
    deletePart,
  };
}
