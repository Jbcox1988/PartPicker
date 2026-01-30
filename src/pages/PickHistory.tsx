import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { exportPickHistoryToExcel, type PickHistoryItem } from '@/lib/excelExport';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  Clock,
  RefreshCw,
  Search,
  User,
  Package,
  Download,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';

interface PickRecord {
  id: string;
  qty_picked: number;
  picked_by: string | null;
  picked_at: string;
  notes: string | null;
  part_number: string;
  description: string | null;
  location: string | null;
  tool_number: string;
  so_number: string;
  order_id: string;
}

const PAGE_SIZE = 50;

// Quick date range presets
const datePresets = [
  { label: 'Today', getValue: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
  { label: 'Yesterday', getValue: () => ({ start: startOfDay(subDays(new Date(), 1)), end: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'This Week', getValue: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'Last 7 Days', getValue: () => ({ start: startOfDay(subDays(new Date(), 6)), end: endOfDay(new Date()) }) },
  { label: 'This Month', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: 'Last 30 Days', getValue: () => ({ start: startOfDay(subDays(new Date(), 29)), end: endOfDay(new Date()) }) },
];

export function PickHistory() {
  const [picks, setPicks] = useState<PickRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Date/time filters - default to today
  const [startDate, setStartDate] = useState(() => format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState(() => format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"));
  const [hasSearched, setHasSearched] = useState(false);

  const fetchPicks = useCallback(async () => {
    try {
      setLoading(true);
      setHasSearched(true);

      // Build the query with date filtering
      const { data, error, count } = await supabase
        .from('picks')
        .select(`
          id,
          qty_picked,
          picked_by,
          picked_at,
          notes,
          line_items!inner (
            part_number,
            description,
            location,
            order_id,
            orders!inner (
              so_number
            )
          ),
          tools!inner (
            tool_number
          )
        `, { count: 'exact' })
        .gte('picked_at', new Date(startDate).toISOString())
        .lte('picked_at', new Date(endDate).toISOString())
        .order('picked_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching picks:', error);
        setPicks([]);
        return;
      }

      // Transform the data
      const transformedPicks: PickRecord[] = (data || []).map((pick: any) => ({
        id: pick.id,
        qty_picked: pick.qty_picked,
        picked_by: pick.picked_by,
        picked_at: pick.picked_at,
        notes: pick.notes,
        part_number: pick.line_items.part_number,
        description: pick.line_items.description,
        location: pick.line_items.location,
        tool_number: pick.tools.tool_number,
        so_number: pick.line_items.orders.so_number,
        order_id: pick.line_items.order_id,
      }));

      setPicks(transformedPicks);
      setTotalCount(count || 0);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching picks:', err);
      setPicks([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, page]);

  // Reset to page 0 when date range changes
  useEffect(() => {
    setPage(0);
  }, [startDate, endDate]);

  // Filter picks by search query
  const filteredPicks = useMemo(() => {
    if (!searchQuery) return picks;
    const query = searchQuery.toLowerCase();
    return picks.filter(pick =>
      (pick.picked_by && pick.picked_by.toLowerCase().includes(query)) ||
      pick.part_number.toLowerCase().includes(query) ||
      pick.so_number.toLowerCase().includes(query) ||
      pick.tool_number.toLowerCase().includes(query) ||
      (pick.description && pick.description.toLowerCase().includes(query)) ||
      (pick.location && pick.location.toLowerCase().includes(query))
    );
  }, [picks, searchQuery]);

  // Group picks by date
  const groupedPicks = useMemo(() => {
    return filteredPicks.reduce((groups, pick) => {
      const date = format(new Date(pick.picked_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(pick);
      return groups;
    }, {} as Record<string, PickRecord[]>);
  }, [filteredPicks]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalQty = filteredPicks.reduce((sum, p) => sum + p.qty_picked, 0);
    const uniqueParts = new Set(filteredPicks.map(p => p.part_number)).size;
    const uniqueUsers = new Set(filteredPicks.filter(p => p.picked_by).map(p => p.picked_by)).size;
    const uniqueOrders = new Set(filteredPicks.map(p => p.so_number)).size;
    return { totalQty, uniqueParts, uniqueUsers, uniqueOrders };
  }, [filteredPicks]);

  // Handle preset selection
  const handlePreset = (preset: typeof datePresets[0]) => {
    const { start, end } = preset.getValue();
    setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
  };

  // Export to Excel
  const handleExport = () => {
    const exportData: PickHistoryItem[] = filteredPicks.map(pick => ({
      picked_at: pick.picked_at,
      picked_by: pick.picked_by,
      qty_picked: pick.qty_picked,
      notes: pick.notes,
      part_number: pick.part_number,
      tool_number: pick.tool_number,
      so_number: pick.so_number,
    }));

    const dateRange = `${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d, yyyy')}`;
    exportPickHistoryToExcel(exportData, `Pick History: ${dateRange}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8" />
            Pick History
          </h1>
          <p className="text-muted-foreground">
            Filter picks by date and time range
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Date & Time Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            {datePresets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handlePreset(preset)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom Date/Time Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Start Date & Time
              </Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                End Date & Time
              </Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={fetchPicks} disabled={loading} className="flex-1 sm:flex-none">
              <Search className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? 'Searching...' : 'Search Picks'}
            </Button>
            {hasSearched && filteredPicks.length > 0 && (
              <Button onClick={handleExport} variant="outline" className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total Picks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{summaryStats.totalQty.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total Qty Picked</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{summaryStats.uniqueParts}</div>
                <p className="text-xs text-muted-foreground">Unique Parts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{summaryStats.uniqueUsers}</div>
                <p className="text-xs text-muted-foreground">Pickers</p>
              </CardContent>
            </Card>
          </div>

          {/* Search Within Results */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search within results by name, part number, SO number, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pick List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Pick Records
              </CardTitle>
              <CardDescription>
                {filteredPicks.length === totalCount
                  ? `${totalCount.toLocaleString()} picks found`
                  : `Showing ${filteredPicks.length} of ${totalCount.toLocaleString()} picks`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPicks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? 'No picks match your search' : 'No picks found in this date range'}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedPicks).map(([date, dayPicks]) => (
                    <div key={date}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background py-1 flex items-center justify-between">
                        <span>{format(new Date(date), 'EEEE, MMMM d, yyyy')}</span>
                        <Badge variant="secondary" className="text-xs">
                          {dayPicks.length} picks
                        </Badge>
                      </h3>
                      <div className="space-y-2">
                        {dayPicks.map((pick) => (
                          <div
                            key={pick.id}
                            className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="mt-0.5">
                              <Package className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {pick.picked_by || 'Unknown'}
                                </span>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  {pick.qty_picked}x
                                </Badge>
                                <Link
                                  to={`/orders/${pick.order_id}`}
                                  className="text-sm text-primary hover:underline"
                                >
                                  SO-{pick.so_number}
                                </Link>
                                <Badge variant="secondary" className="text-xs">
                                  {pick.tool_number}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                <span className="font-mono font-medium">{pick.part_number}</span>
                                {pick.description && (
                                  <span className="text-muted-foreground"> - {pick.description}</span>
                                )}
                              </p>
                              {pick.location && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Location: {pick.location}
                                </p>
                              )}
                              {pick.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 italic">
                                  Note: {pick.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(pick.picked_at), 'h:mm a')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage(p => Math.max(0, p - 1));
                        fetchPicks();
                      }}
                      disabled={page === 0 || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE) || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage(p => p + 1);
                        fetchPicks();
                      }}
                      disabled={!hasMore || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
