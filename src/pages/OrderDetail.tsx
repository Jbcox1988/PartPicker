import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Package, Pencil, X, Save, CheckCircle, AlertCircle, Download, Clock, Plus, ChevronDown, ChevronRight, FileText, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { PickingInterface } from '@/components/picking/PickingInterface';
import { PrintPickList } from '@/components/picking/PrintPickList';
import { LineItemDialog } from '@/components/picking/LineItemDialog';
import { DeleteConfirmDialog } from '@/components/picking/DeleteConfirmDialog';
import { SaveAsTemplateDialog } from '@/components/dialogs/SaveAsTemplateDialog';
import { ManageToolsDialog } from '@/components/dialogs/ManageToolsDialog';
import { useOrder, useOrders } from '@/hooks/useOrders';
import { useBOMTemplates } from '@/hooks/useBOMTemplates';
import { usePicks } from '@/hooks/usePicks';
import { useLineItems, type LineItemInput } from '@/hooks/useLineItems';
import { useIssues } from '@/hooks/useIssues';
import { useSettings } from '@/hooks/useSettings';
import type { Tool, LineItem, IssueType } from '@/types';
import { formatDate, getStatusColor, getDueDateStatus, getDueDateColors, cn } from '@/lib/utils';
import { exportOrderToExcel } from '@/lib/excelExport';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { order, tools, lineItems, loading, error: orderError, refresh, addTool, deleteTool, generateNextToolNumber } = useOrder(id);

  const { updateOrder } = useOrders();
  const { lineItemsWithPicks, picks, recordPick, undoPick, getPicksForTool, getPickHistory, getPicksForAllTools, batchUpdateAllocations } = usePicks(id);
  const { addLineItem, updateLineItem, deleteLineItem, loading: lineItemLoading } = useLineItems(id);
  const { reportIssue, hasOpenIssue } = useIssues(id);
  const { getUserName } = useSettings();
  const { createTemplateFromOrder } = useBOMTemplates();
  const [isEditing, setIsEditing] = useState(false);
  const [showCompletionSuggestion, setShowCompletionSuggestion] = useState(false);
  const [currentToolId, setCurrentToolId] = useState<string | undefined>(undefined);
  const [isOrderInfoExpanded, setIsOrderInfoExpanded] = useState(false);
  const [editForm, setEditForm] = useState({
    so_number: '',
    po_number: '',
    customer_name: '',
    tool_model: '',
    order_date: '',
    due_date: '',
    notes: '',
  });

  // Tool management state
  const [isManageToolsOpen, setIsManageToolsOpen] = useState(false);
  // Filter by tool - 'all' shows all tools, or specific tool ID
  const [toolFilter, setToolFilter] = useState<string>('all');

  // Line item management state
  const [isAddLineItemOpen, setIsAddLineItemOpen] = useState(false);
  const [lineItemToEdit, setLineItemToEdit] = useState<LineItem | null>(null);
  const [lineItemToDelete, setLineItemToDelete] = useState<LineItem | null>(null);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);

  // Calculate overall progress (must be before hooks that depend on it)
  const totalNeeded = lineItemsWithPicks.reduce(
    (sum, item) => sum + item.total_qty_needed,
    0
  );
  const totalPicked = lineItemsWithPicks.reduce(
    (sum, item) => sum + item.total_picked,
    0
  );
  const progressPercent =
    totalNeeded > 0 ? Math.round((totalPicked / totalNeeded) * 100) : 0;

  const isFullyPicked = progressPercent === 100 && totalNeeded > 0;

  // Set initial current tool ID when tools load
  useEffect(() => {
    if (tools.length > 0 && !currentToolId) {
      setCurrentToolId(tools[0].id);
    }
  }, [tools, currentToolId]);

  // Auto-suggest completion when 100% picked and order is still active
  useEffect(() => {
    if (isFullyPicked && order?.status === 'active') {
      setShowCompletionSuggestion(true);
    } else {
      setShowCompletionSuggestion(false);
    }
  }, [isFullyPicked, order?.status]);


  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (orderError) {
    return (
      <div className="space-y-4">
        <Link
          to="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Link>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600 font-medium">Error loading order</p>
            <p className="text-red-500 text-sm mt-2">{orderError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          to="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Link>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Order not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    await updateOrder(order.id, { status: newStatus as 'active' | 'complete' | 'cancelled' });
    refresh();
  };

  const handleMarkComplete = async () => {
    if (!order) return;
    await updateOrder(order.id, { status: 'complete' });
    setShowCompletionSuggestion(false);
    refresh();
  };

  const startEditing = () => {
    setEditForm({
      so_number: order.so_number || '',
      po_number: order.po_number || '',
      customer_name: order.customer_name || '',
      tool_model: order.tool_model || '',
      order_date: order.order_date || '',
      due_date: order.due_date || '',
      notes: order.notes || '',
    });
    setIsEditing(true);
  };

  const saveChanges = async () => {
    await updateOrder(order.id, {
      so_number: editForm.so_number || order.so_number,
      po_number: editForm.po_number || null,
      customer_name: editForm.customer_name || null,
      tool_model: editForm.tool_model || null,
      order_date: editForm.order_date || null,
      due_date: editForm.due_date || null,
      notes: editForm.notes || null,
    });
    setIsEditing(false);
    refresh();
  };

  const handleExport = () => {
    if (!order) return;
    exportOrderToExcel(order, tools, lineItemsWithPicks, picks);
  };

  const handleSaveAsTemplate = async (name: string, toolModel: string | null): Promise<boolean> => {
    const result = await createTemplateFromOrder(name, toolModel, lineItems);
    return result !== null;
  };

  // Line item management handlers
  const handleAddLineItem = async (input: LineItemInput): Promise<boolean> => {
    const result = await addLineItem(input);
    if (result) {
      refresh();
      return true;
    }
    return false;
  };

  const handleEditLineItem = async (lineItemId: string, input: LineItemInput): Promise<boolean> => {
    const result = await updateLineItem(lineItemId, input);
    if (result) {
      refresh();
      return true;
    }
    return false;
  };

  const handleDeleteLineItem = async (lineItemId: string): Promise<boolean> => {
    const result = await deleteLineItem(lineItemId);
    if (result) {
      refresh();
      return true;
    }
    return false;
  };

  // Tool management handlers
  const handleAddToolFromDialog = async (toolNumber: string, serialNumber?: string): Promise<Tool | null> => {
    const newTool = await addTool(toolNumber, serialNumber);
    if (newTool) {
      setCurrentToolId(newTool.id);
    }
    return newTool;
  };

  const handleDeleteToolFromDialog = async (toolId: string): Promise<boolean> => {
    const success = await deleteTool(toolId);
    if (success) {
      // If we deleted the current tool, switch to first remaining tool
      if (currentToolId === toolId) {
        const remainingTools = tools.filter(t => t.id !== toolId);
        if (remainingTools.length > 0) {
          setCurrentToolId(remainingTools[0].id);
        } else {
          setCurrentToolId(undefined);
        }
      }
      // Reset filter if it was filtering by the deleted tool
      if (toolFilter === toolId) {
        setToolFilter('all');
      }
    }
    return success;
  };

  // Pick all remaining tools for a specific line item
  const handlePickAllRemainingTools = async (lineItemId: string): Promise<void> => {
    const lineItem = lineItems.find(li => li.id === lineItemId);
    if (!lineItem) return;

    const allToolsPicksMap = getPicksForAllTools();
    const userName = getUserName();

    const pickPromises = tools
      .filter(t => {
        const toolPicks = allToolsPicksMap.get(t.id);
        const picked = toolPicks?.get(lineItemId) || 0;
        return picked < lineItem.qty_per_unit;
      })
      .map(t => {
        const toolPicks = allToolsPicksMap.get(t.id);
        const picked = toolPicks?.get(lineItemId) || 0;
        const remaining = lineItem.qty_per_unit - picked;
        return recordPick(lineItemId, t.id, remaining, userName);
      });

    await Promise.all(pickPromises);
  };

  // Calculate picks for a specific tool to show in delete confirmation
  const getToolPickCount = (toolId: string): number => {
    const toolPicks = getPicksForTool(toolId);
    return Array.from(toolPicks.values()).reduce((sum, qty) => sum + qty, 0);
  };

  return (
    <div className="space-y-4">
      {/* Completion Suggestion Alert */}
      {showCompletionSuggestion && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">All items picked!</AlertTitle>
          <AlertDescription className="text-green-700">
            This order is 100% picked and ready to be marked complete.
            <div className="mt-2">
              <Button size="sm" onClick={handleMarkComplete} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Complete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCompletionSuggestion(false)}
                className="ml-2 text-green-700 hover:text-green-800"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Completed Order Banner */}
      {order.status === 'complete' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Order Complete</AlertTitle>
          <AlertDescription className="text-green-700">
            This order has been marked as complete.
          </AlertDescription>
        </Alert>
      )}

      {/* Cancelled Order Banner */}
      {order.status === 'cancelled' && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Order Cancelled</AlertTitle>
          <AlertDescription className="text-red-700">
            This order has been cancelled.
          </AlertDescription>
        </Alert>
      )}

      {/* Overdue Order Banner */}
      {order.status === 'active' && getDueDateStatus(order.due_date).status === 'overdue' && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Order Overdue</AlertTitle>
          <AlertDescription className="text-red-700">
            This order was due on {formatDate(order.due_date)} and is now {getDueDateStatus(order.due_date).label.toLowerCase()}.
          </AlertDescription>
        </Alert>
      )}

      {/* Due Soon Banner */}
      {order.status === 'active' && getDueDateStatus(order.due_date).status === 'due-soon' && (
        <Alert className="border-amber-200 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Order Due Soon</AlertTitle>
          <AlertDescription className="text-amber-700">
            {getDueDateStatus(order.due_date).label} ({formatDate(order.due_date)}).
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="space-y-3">
        <Link
          to="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Link>

        {/* Title and Status Row */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl sm:text-2xl font-bold">SO-{order.so_number}</h1>
          <Select value={order.status} onValueChange={handleStatusChange}>
            <SelectTrigger className={`w-24 sm:w-28 h-8 text-xs sm:text-sm ${getStatusColor(order.status)}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          {/* Mark Complete Button - only show when 100% picked and not already complete */}
          {isFullyPicked && order.status === 'active' && (
            <Button size="sm" onClick={handleMarkComplete} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Mark </span>Complete
            </Button>
          )}
        </div>

        {/* Progress Bar - Full Width on Mobile */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Progress:</span>
          <Progress value={progressPercent} className="h-2 flex-1 min-w-0" />
          <span className="text-sm font-semibold whitespace-nowrap">{progressPercent}%</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">({totalPicked}/{totalNeeded})</span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          {lineItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsSaveTemplateOpen(true)}>
              <FileText className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Save Template</span>
            </Button>
          )}
          {tools.length > 0 && (
            <PrintPickList
              order={order}
              tools={tools}
              lineItems={lineItems}
              getPicksForTool={getPicksForTool}
              currentToolId={currentToolId}
            />
          )}
        </div>
      </div>

      {/* Order Info Card - Collapsible */}
      <Card className="overflow-hidden">
        <CardHeader
          className="flex flex-row items-center justify-between py-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => !isEditing && setIsOrderInfoExpanded(!isOrderInfoExpanded)}
        >
          <div className="flex items-center gap-2">
            {isOrderInfoExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-base">Order Information</CardTitle>
            {/* Summary when collapsed */}
            {!isOrderInfoExpanded && !isEditing && (
              <span className="text-sm text-muted-foreground ml-2">
                {[
                  order.customer_name,
                  order.po_number && `PO: ${order.po_number}`,
                  order.tool_model,
                  order.due_date && `Due: ${formatDate(order.due_date)}`
                ].filter(Boolean).join(' • ') || 'No details'}
              </span>
            )}
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {!isEditing ? (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setIsOrderInfoExpanded(true); startEditing(); }}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveChanges}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        {(isOrderInfoExpanded || isEditing) && (
          <CardContent className="pt-0 pb-4">
            {!isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">SO Number</p>
                  <p className="font-medium">{order.so_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{order.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PO Number</p>
                  <p className="font-medium">{order.po_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tool Model</p>
                  <p className="font-medium">{order.tool_model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tools</p>
                  <p className="font-medium">{tools.length} tool(s) {tools.length > 0 && `(${tools.map(t => t.tool_number).join(', ')})`}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="font-medium">{formatDate(order.order_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  {(() => {
                    const dueDateInfo = getDueDateStatus(order.due_date);
                    const dueDateColors = getDueDateColors(dueDateInfo.status);
                    const isComplete = order.status === 'complete';

                    if (!order.due_date) {
                      return <p className="font-medium">-</p>;
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-medium",
                          !isComplete && dueDateColors.text
                        )}>
                          {formatDate(order.due_date)}
                        </p>
                        {!isComplete && dueDateInfo.status !== 'no-date' && (
                          <Badge
                            variant="outline"
                            className={cn("text-xs", dueDateColors.badge)}
                          >
                            {dueDateInfo.status === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {dueDateInfo.status === 'due-soon' && <Clock className="h-3 w-3 mr-1" />}
                            {dueDateInfo.label}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium">{order.notes || '-'}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit_so">SO Number</Label>
                  <Input
                    id="edit_so"
                    value={editForm.so_number}
                    onChange={(e) => setEditForm({ ...editForm, so_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_customer">Customer</Label>
                  <Input
                    id="edit_customer"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_po">PO Number</Label>
                  <Input
                    id="edit_po"
                    value={editForm.po_number}
                    onChange={(e) => setEditForm({ ...editForm, po_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_model">Tool Model</Label>
                  <Input
                    id="edit_model"
                    value={editForm.tool_model}
                    onChange={(e) => setEditForm({ ...editForm, tool_model: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_order_date">Order Date</Label>
                  <Input
                    id="edit_order_date"
                    type="date"
                    value={editForm.order_date}
                    onChange={(e) => setEditForm({ ...editForm, order_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_due_date">Due Date</Label>
                  <Input
                    id="edit_due_date"
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <Label htmlFor="edit_notes">Notes</Label>
                  <Input
                    id="edit_notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Picking Interface - Unified View */}
      {tools.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tools defined for this order</p>
            <p className="text-sm text-muted-foreground mt-2">
              Import an Excel file with tool definitions or add tools manually
            </p>
            <Button className="mt-4" onClick={() => setIsManageToolsOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Unified Picking Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {/* Title and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold">Picking</h2>
              <Badge variant="secondary" className="text-xs">{lineItems.length} parts</Badge>
              <Badge variant="outline" className="text-xs">{tools.length} tool(s)</Badge>
            </div>

            {/* Tool Progress Pills - Scrollable on mobile */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1 -mb-1">
              {tools.map((tool) => {
                const toolPicks = getPicksForTool(tool.id);
                const toolTotal = lineItems.reduce(
                  (sum, item) => sum + item.qty_per_unit,
                  0
                );
                const toolPicked = Array.from(toolPicks.values()).reduce(
                  (sum, qty) => sum + qty,
                  0
                );
                const toolProgress =
                  toolTotal > 0 ? Math.round((toolPicked / toolTotal) * 100) : 0;

                return (
                  <div
                    key={tool.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0',
                      toolProgress === 100
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : toolProgress > 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {tool.tool_number}
                    {toolProgress === 100 && (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {toolProgress > 0 && toolProgress < 100 && (
                      <span>{toolProgress}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Tool Dropdown */}
            {tools.length > 1 && (
              <div className="flex items-center gap-1">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={toolFilter} onValueChange={setToolFilter}>
                  <SelectTrigger className="h-8 w-32 sm:w-40">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tools</SelectItem>
                    {tools.map((tool) => (
                      <SelectItem key={tool.id} value={tool.id}>
                        {tool.tool_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manage Tools Button */}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setIsManageToolsOpen(true)}>
              <Settings className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Manage Tools</span>
            </Button>

            <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={() => setIsAddLineItemOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Add Part</span>
            </Button>
          </div>

          {/* Tool Display Row */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">Tools:</span>
            {tools.map((tool) => (
              <Badge key={tool.id} variant="outline" className="gap-1">
                {tool.tool_number}
                {tool.serial_number && (
                  <span className="text-muted-foreground font-normal">
                    (SN: {tool.serial_number})
                  </span>
                )}
              </Badge>
            ))}
          </div>

          {/* Unified Picking Interface */}
          <Card>
            <CardContent className="pt-4">
              <PickingInterface
                tool={tools.find(t => t.id === currentToolId) || tools[0]}
                allTools={tools}
                orderId={order.id}
                lineItems={lineItems}
                lineItemsWithPicks={lineItemsWithPicks}
                picks={picks}
                onRecordPick={recordPick}
                onUndoPick={undoPick}
                getPicksForTool={getPicksForTool}
                getPicksForAllTools={getPicksForAllTools}
                getPickHistory={getPickHistory}
                onPickAllRemainingTools={handlePickAllRemainingTools}
                onReportIssue={async (lineItemId, orderId, issueType, description, reportedBy) => {
                  const result = await reportIssue(lineItemId, orderId, issueType, description, reportedBy);
                  return result !== null;
                }}
                hasOpenIssue={hasOpenIssue}
                onBatchUpdateAllocations={batchUpdateAllocations}
                toolFilter={toolFilter}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manage Tools Dialog */}
      <ManageToolsDialog
        open={isManageToolsOpen}
        onOpenChange={setIsManageToolsOpen}
        tools={tools}
        soNumber={order.so_number}
        onAddTool={handleAddToolFromDialog}
        onDeleteTool={handleDeleteToolFromDialog}
        getToolPickCount={getToolPickCount}
        generateNextToolNumber={() => generateNextToolNumber(order.so_number, tools)}
      />

      {/* Add Line Item Dialog */}
      <LineItemDialog
        open={isAddLineItemOpen}
        onOpenChange={setIsAddLineItemOpen}
        onSave={async (input) => {
          const success = await handleAddLineItem(input);
          if (success) setIsAddLineItemOpen(false);
          return success;
        }}
        isLoading={lineItemLoading}
      />

      {/* Edit Line Item Dialog */}
      <LineItemDialog
        open={lineItemToEdit !== null}
        onOpenChange={(open) => !open && setLineItemToEdit(null)}
        onSave={async (input) => {
          if (!lineItemToEdit) return false;
          const success = await handleEditLineItem(lineItemToEdit.id, input);
          if (success) setLineItemToEdit(null);
          return success;
        }}
        lineItem={lineItemToEdit}
        isLoading={lineItemLoading}
      />

      {/* Delete Line Item Confirmation */}
      <DeleteConfirmDialog
        open={lineItemToDelete !== null}
        onOpenChange={(open) => !open && setLineItemToDelete(null)}
        onConfirm={async () => {
          if (!lineItemToDelete) return;
          await handleDeleteLineItem(lineItemToDelete.id);
          setLineItemToDelete(null);
        }}
        lineItem={lineItemToDelete}
        isLoading={lineItemLoading}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        lineItems={lineItems}
        defaultToolModel={order.tool_model || undefined}
        onSave={handleSaveAsTemplate}
      />
    </div>
  );
}
