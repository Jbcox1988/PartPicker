import { Wrench, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AssemblyFilterPopoverProps {
  assemblies: string[];
  selectedAssemblies: Set<string>;
  onToggleAssembly: (model: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function AssemblyFilterPopover({
  assemblies,
  selectedAssemblies,
  onToggleAssembly,
  onSelectAll,
  onDeselectAll,
}: AssemblyFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-48 justify-between">
          <span className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {selectedAssemblies.size === 0
              ? 'All Assemblies'
              : `${selectedAssemblies.size} Assembly${selectedAssemblies.size !== 1 ? 's' : ''}`}
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
          {assemblies.map((model) => (
            <label
              key={model}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
            >
              <Checkbox
                checked={selectedAssemblies.has(model)}
                onCheckedChange={() => onToggleAssembly(model)}
              />
              <span className="text-sm">{model}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
