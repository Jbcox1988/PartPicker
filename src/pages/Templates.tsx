import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, ArrowLeft, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchInput } from '@/components/common/SearchInput';
import { useBOMTemplates } from '@/hooks/useBOMTemplates';
import type { BOMTemplate, BOMTemplateItem, BOMTemplateWithItems } from '@/types';

export function Templates() {
  const {
    templates,
    loading,
    error,
    refresh,
    getTemplateWithItems,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplateItem,
    updateTemplateItem,
    deleteTemplateItem,
    extractTemplatesFromOrders,
  } = useBOMTemplates();

  // View state
  const [selectedTemplate, setSelectedTemplate] = useState<BOMTemplateWithItems | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('all');

  // Template dialog
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BOMTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', tool_model: '' });

  // Item dialog
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<BOMTemplateItem | null>(null);
  const [itemForm, setItemForm] = useState({
    part_number: '',
    description: '',
    location: '',
    assembly_group: '',
    qty_per_unit: 1,
  });

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'template' | 'item'; id: string; name: string } | null>(null);

  // Extract dialog
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  // Unique tool models for filter dropdown
  const uniqueModels = useMemo(() => {
    const models = new Set<string>();
    for (const t of templates) {
      if (t.tool_model) models.add(t.tool_model);
    }
    return Array.from(models).sort();
  }, [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.tool_model && t.tool_model.toLowerCase().includes(search.toLowerCase()));
      const matchesModel = modelFilter === 'all' || t.tool_model === modelFilter;
      return matchesSearch && matchesModel;
    });
  }, [templates, search, modelFilter]);

  // Stats
  const stats = useMemo(() => {
    const models = new Set(templates.map(t => t.tool_model).filter(Boolean));
    return {
      total: templates.length,
      toolModels: models.size,
    };
  }, [templates]);

  // Load template detail
  const handleSelectTemplate = async (template: BOMTemplate) => {
    setLoadingDetail(true);
    const detail = await getTemplateWithItems(template.id);
    setSelectedTemplate(detail);
    setLoadingDetail(false);
  };

  // Refresh detail if selected template changes
  const refreshDetail = async () => {
    if (selectedTemplate) {
      const detail = await getTemplateWithItems(selectedTemplate.id);
      setSelectedTemplate(detail);
    }
  };

  // Template CRUD
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', tool_model: '' });
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (t: BOMTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, tool_model: t.tool_model || '' });
    setShowTemplateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) return;

    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, {
        name: templateForm.name.trim(),
        tool_model: templateForm.tool_model.trim() || null,
      });
      // Refresh detail if we're editing the selected template
      if (selectedTemplate?.id === editingTemplate.id) {
        const detail = await getTemplateWithItems(editingTemplate.id);
        setSelectedTemplate(detail);
      }
    } else {
      await createTemplate(templateForm.name.trim(), templateForm.tool_model.trim() || undefined);
    }

    setShowTemplateDialog(false);
  };

  const confirmDeleteTemplate = (t: BOMTemplate) => {
    setDeleteTarget({ type: 'template', id: t.id, name: t.name });
    setShowDeleteDialog(true);
  };

  const confirmDeleteItem = (item: BOMTemplateItem) => {
    setDeleteTarget({ type: 'item', id: item.id, name: item.part_number });
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'template') {
      await deleteTemplate(deleteTarget.id);
      if (selectedTemplate?.id === deleteTarget.id) {
        setSelectedTemplate(null);
      }
    } else {
      await deleteTemplateItem(deleteTarget.id);
      await refreshDetail();
    }

    setShowDeleteDialog(false);
    setDeleteTarget(null);
  };

  // Item CRUD
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ part_number: '', description: '', location: '', assembly_group: '', qty_per_unit: 1 });
    setShowItemDialog(true);
  };

  const openEditItem = (item: BOMTemplateItem) => {
    setEditingItem(item);
    setItemForm({
      part_number: item.part_number,
      description: item.description || '',
      location: item.location || '',
      assembly_group: item.assembly_group || '',
      qty_per_unit: item.qty_per_unit,
    });
    setShowItemDialog(true);
  };

  const handleSaveItem = async () => {
    if (!selectedTemplate || !itemForm.part_number.trim()) return;

    if (editingItem) {
      await updateTemplateItem(editingItem.id, {
        part_number: itemForm.part_number.trim(),
        description: itemForm.description.trim() || null,
        location: itemForm.location.trim() || null,
        assembly_group: itemForm.assembly_group.trim() || null,
        qty_per_unit: itemForm.qty_per_unit,
      });
    } else {
      await addTemplateItem(selectedTemplate.id, {
        part_number: itemForm.part_number.trim(),
        description: itemForm.description.trim() || null,
        location: itemForm.location.trim() || null,
        assembly_group: itemForm.assembly_group.trim() || null,
        qty_per_unit: itemForm.qty_per_unit,
      });
    }

    setShowItemDialog(false);
    await refreshDetail();
  };

  // Extract from orders
  const handleExtract = async () => {
    setExtracting(true);
    setExtractResult(null);
    const result = await extractTemplatesFromOrders();
    setExtractResult(result);
    setExtracting(false);
  };

  // Detail view
  if (selectedTemplate) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTemplate(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{selectedTemplate.name}</h1>
              {selectedTemplate.tool_model && (
                <Badge variant="secondary">{selectedTemplate.tool_model}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {selectedTemplate.items.length} items
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openEditTemplate(selectedTemplate)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Template Items</CardTitle>
            <Button size="sm" onClick={openAddItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {selectedTemplate.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No items yet. Add parts to this template.</p>
              </div>
            ) : (
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 whitespace-nowrap">Part Number</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2 whitespace-nowrap">Location</th>
                      <th className="text-left p-2 whitespace-nowrap">Assembly Group</th>
                      <th className="text-center p-2 whitespace-nowrap">Qty/Unit</th>
                      <th className="text-right p-2 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTemplate.items.map(item => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2 font-mono whitespace-nowrap">{item.part_number}</td>
                        <td className="p-2 text-muted-foreground max-w-[200px] truncate">
                          {item.description || '-'}
                        </td>
                        <td className="p-2 whitespace-nowrap">{item.location || '-'}</td>
                        <td className="p-2 whitespace-nowrap text-xs font-mono text-muted-foreground">
                          {item.assembly_group || '-'}
                        </td>
                        <td className="p-2 text-center">{item.qty_per_unit}</td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => confirmDeleteItem(item)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item Dialog */}
        <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
              <DialogDescription>
                {editingItem ? 'Update the template item details.' : 'Add a new part to this template.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item-part">Part Number *</Label>
                <Input
                  id="item-part"
                  value={itemForm.part_number}
                  onChange={e => setItemForm(f => ({ ...f, part_number: e.target.value }))}
                  placeholder="e.g., 12345-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-desc">Description</Label>
                <Input
                  id="item-desc"
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Part description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-loc">Location</Label>
                  <Input
                    id="item-loc"
                    value={itemForm.location}
                    onChange={e => setItemForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g., A-1-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-qty">Qty per Unit</Label>
                  <Input
                    id="item-qty"
                    type="number"
                    min="1"
                    value={itemForm.qty_per_unit}
                    onChange={e => setItemForm(f => ({ ...f, qty_per_unit: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-assy">Assembly Group</Label>
                <Input
                  id="item-assy"
                  value={itemForm.assembly_group}
                  onChange={e => setItemForm(f => ({ ...f, assembly_group: e.target.value }))}
                  placeholder="e.g., Main Frame"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveItem} disabled={!itemForm.part_number.trim()}>
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Edit Dialog (reused) */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-name">Template Name *</Label>
                <Input
                  id="tpl-name"
                  value={templateForm.name}
                  onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., 230Q BOM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-model">Tool Model</Label>
                <Input
                  id="tpl-model"
                  value={templateForm.tool_model}
                  onChange={e => setTemplateForm(f => ({ ...f, tool_model: e.target.value }))}
                  placeholder="e.g., 230Q"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={!templateForm.name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleteTarget?.type === 'template' ? 'Template' : 'Item'}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteTarget?.name}"?
                {deleteTarget?.type === 'template' && ' This will also delete all items in this template.'}
                {' '}This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">Manage BOM templates for quick order creation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setExtractResult(null); setShowExtractDialog(true); }}>
            <Search className="h-4 w-4 mr-2" />
            Extract from Orders
          </Button>
          <Button onClick={openCreateTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Templates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.toolModels}</div>
            <div className="text-sm text-muted-foreground">Tool Models</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates..."
          className="flex-1"
        />
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {uniqueModels.map(model => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {templates.length === 0
                ? 'No templates yet. Create one or extract from existing orders.'
                : 'No templates match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredTemplates.map(template => (
            <Card
              key={template.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleSelectTemplate(template)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{template.name}</span>
                      {template.tool_model && (
                        <Badge variant="secondary" className="flex-shrink-0">{template.tool_model}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => { e.stopPropagation(); openEditTemplate(template); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={e => { e.stopPropagation(); confirmDeleteTemplate(template); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update the template details.' : 'Create a new BOM template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name2">Template Name *</Label>
              <Input
                id="tpl-name2"
                value={templateForm.name}
                onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., 230Q BOM"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-model2">Tool Model</Label>
              <Input
                id="tpl-model2"
                value={templateForm.tool_model}
                onChange={e => setTemplateForm(f => ({ ...f, tool_model: e.target.value }))}
                placeholder="e.g., 230Q"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!templateForm.name.trim()}>
              {editingTemplate ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This will also delete all items in this template. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract from Orders Dialog */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Templates from Orders</DialogTitle>
            <DialogDescription>
              Scan all existing orders and create templates for each unique BOM. Duplicate BOMs (same parts and quantities) will be merged into a single template.
            </DialogDescription>
          </DialogHeader>

          {extractResult ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                  <div className="text-xl font-bold text-green-700 dark:text-green-400">{extractResult.created}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-xl font-bold">{extractResult.skipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped (duplicates)</div>
                </div>
              </div>
              {extractResult.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                  <p className="font-medium mb-1">Errors:</p>
                  <ul className="list-disc list-inside">
                    {extractResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            extracting && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Extracting templates...</span>
              </div>
            )
          )}

          <DialogFooter>
            {extractResult ? (
              <Button onClick={() => setShowExtractDialog(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowExtractDialog(false)} disabled={extracting}>Cancel</Button>
                <Button onClick={handleExtract} disabled={extracting}>
                  {extracting ? 'Extracting...' : 'Extract'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading detail overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-background/50 z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  );
}
