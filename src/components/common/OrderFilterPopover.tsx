import { Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Order {
  id: string;
  so_number: string;
}

interface OrderFilterPopoverProps {
  orders: Order[];
  selectedOrders: Set<string>;
  onToggleOrder: (orderId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function OrderFilterPopover({
  orders,
  selectedOrders,
  onToggleOrder,
  onSelectAll,
  onDeselectAll,
}: OrderFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-48 justify-between">
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {selectedOrders.size === 0
              ? 'All Orders'
              : `${selectedOrders.size} Order${selectedOrders.size !== 1 ? 's' : ''}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 border-b flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8"
            onClick={onSelectAll}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8"
            onClick={onDeselectAll}
          >
            Clear
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {orders.map((order) => (
            <label
              key={order.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
            >
              <Checkbox
                checked={selectedOrders.has(order.id)}
                onCheckedChange={() => onToggleOrder(order.id)}
              />
              <span className="text-sm">SO-{order.so_number}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
