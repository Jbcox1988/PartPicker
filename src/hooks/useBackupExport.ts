import { useState } from 'react';
import { exportFullBackupToExcel, type BackupData } from '@/lib/excelExport';
import { fetchAllFromTable } from '@/lib/supabasePagination';

export function useBackupExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportBackup = async () => {
    setExporting(true);
    setError(null);

    try {
      // Fetch all tables in parallel with pagination to handle >1000 rows
      const [
        orders,
        tools,
        lineItems,
        picks,
        issues,
        partsCatalog,
        bomTemplates,
        bomTemplateItems,
        pickUndos,
      ] = await Promise.all([
        fetchAllFromTable('orders', '*', { order: { column: 'created_at', ascending: false } }),
        fetchAllFromTable('tools', '*', { order: { column: 'created_at', ascending: false } }),
        fetchAllFromTable('line_items', '*', { order: { column: 'created_at', ascending: false } }),
        fetchAllFromTable('picks', '*', { order: { column: 'picked_at', ascending: false } }),
        fetchAllFromTable('issues', '*', { order: { column: 'created_at', ascending: false } }),
        fetchAllFromTable('parts_catalog', '*', { order: { column: 'part_number', ascending: true } }).catch(() => []),
        fetchAllFromTable('bom_templates', '*', { order: { column: 'name', ascending: true } }).catch(() => []),
        fetchAllFromTable('bom_template_items', '*').catch(() => []),
        fetchAllFromTable('pick_undos', '*', { order: { column: 'undone_at', ascending: false } }).catch(() => []),
      ]);

      const backupData: BackupData = {
        orders,
        tools,
        lineItems,
        picks,
        issues,
        partsCatalog,
        bomTemplates,
        bomTemplateItems,
        pickUndos,
      };

      // Export to Excel
      exportFullBackupToExcel(backupData);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      return false;
    } finally {
      setExporting(false);
    }
  };

  return { exportBackup, exporting, error };
}
