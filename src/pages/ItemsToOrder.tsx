import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, ChevronDown, ChevronRight, MapPin, ArrowUpDown, X, Download, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useItemsToOrder } from '@/hooks/useItemsToOrder';
import { cn } from '@/lib/utils';
import { exportItemsToOrderToExcel } from '@/lib/excelExport';

type SortMode = 'part_number' | 'remaining' | 'location';

const ITEMS_TO_ORDER_SORT_KEY = 'items-to-order-sort-preference';

// Alphanumeric sort comparison
function alphanumericCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function ItemsToOrder() {
  const { items, loading } = useItemsToOrder();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem(ITEMS_TO_ORDER_SORT_KEY);
    return (saved as SortMode) || 'remaining';
  });

  // Persist sort preference
  useEffect(() => {
    localStorage.setItem(ITEMS_TO_ORDER_SORT_KEY, sortMode);
  }, [sortMode]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.part_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Sort filtered items
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];

    switch (sortMode) {
      case 'remaining':
        // Sort by remaining quantity (highest first)
        sorted.sort((a, b) => {
          const cmp = b.remaining - a.remaining;
          if (cmp !== 0) return cmp;
          return alphanumericCompare(a.part_number, b.part_number);
        });
        break;
      case 'location':
        // Sort by location, items without location go to end
        sorted.sort((a, b) => {
          const locA = a.location || '';
          const locB = b.location || '';
          if (!locA && locB) return 1;
          if (locA && !locB) return -1;
          if (!locA && !locB) return alphanumericCompare(a.part_number, b.part_number);
          const cmp = alphanumericCompare(locA, locB);
          if (cmp !== 0) return cmp;
          return alphanumericCompare(a.part_number, b.part_number);
        });
        break;
      case 'part_number':
      default:
        sorted.sort((a, b) => alphanumericCompare(a.part_number, b.part_number));
        break;
    }

    return sorted;
  }, [filteredItems, sortMode]);

  const toggleExpanded = (partNumber: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(partNumber)) {
      newExpanded.delete(partNumber);
    } else {
      newExpanded.add(partNumber);
    }
    setExpandedItems(newExpanded);
  };

  // Stats
  const totalItems = items.length;
  const totalQtyNeeded = items.reduce((sum, p) => sum + p.remaining, 0);
  const totalOrders = new Set(items.flatMap(item => item.orders.map(o => o.order_id))).size;

  const handleExport = () => {
    exportItemsToOrderToExcel(items);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Items to Order</h1>
          <p className="text-muted-foreground">
            Parts with no stock available that still need to be picked
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-100 p-2">
                <ShoppingCart className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalItems}</div>
                <p className="text-sm text-muted-foreground">Unique Parts to Order</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalQtyNeeded}</div>
                <p className="text-sm text-muted-foreground">Total Qty Still Needed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-sm text-muted-foreground">Orders Affected</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-2 border-orange-200 bg-orange-50/50">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by part number, description, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-12 text-lg border-2 focus-visible:ring-orange-400"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {/* Filter Options Row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remaining">Sort by Qty Needed (High to Low)</SelectItem>
                    <SelectItem value="part_number">Sort by Part Number</SelectItem>
                    <SelectItem value="location">Sort by Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {searchQuery && (
                <span className="text-sm text-muted-foreground">
                  {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Loading items...</p>
          </CardContent>
        </Card>
      ) : sortedItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? 'No items match your search'
                : 'No items need to be ordered. All parts have stock available!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => {
            const isExpanded = expandedItems.has(item.part_number);

            return (
              <Card
                key={item.part_number}
                className="border-l-4 border-l-orange-400"
              >
                <CardContent className="pt-4">
                  {/* Main Row */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => toggleExpanded(item.part_number)}
                  >
                    <Button variant="ghost" size="icon" className="shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-lg">
                          {item.part_number}
                        </span>
                        {item.location && (
                          <Badge variant="outline" className="gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.location}
                          </Badge>
                        )}
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Out of Stock
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-orange-600">
                          {item.remaining}
                        </span>
                        <span className="text-muted-foreground">needed</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        across {item.orders.length} order{item.orders.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Expanded: Per-Order Breakdown */}
                  {isExpanded && (
                    <div className="mt-4 ml-12 border-t pt-4">
                      <p className="text-sm font-medium mb-2">
                        Orders needing this part:
                      </p>
                      <div className="space-y-2">
                        {item.orders.map((orderInfo) => {
                          const orderRemaining = orderInfo.needed - orderInfo.picked;
                          return (
                            <div
                              key={orderInfo.order_id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded"
                            >
                              <Link
                                to={`/orders/${orderInfo.order_id}`}
                                className="font-medium hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                SO-{orderInfo.so_number}
                              </Link>
                              <div className="flex items-center gap-4">
                                <span className="font-mono">
                                  {orderInfo.picked} / {orderInfo.needed}
                                </span>
                                <Badge variant="outline" className="text-orange-600 border-orange-300">
                                  {orderRemaining} needed
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
