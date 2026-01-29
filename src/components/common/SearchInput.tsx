import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Large variant with bigger text and padding */
  large?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  large = false,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          large ? 'left-4 h-5 w-5' : 'left-3 h-4 w-4'
        )}
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          large ? 'pl-12 pr-12 h-12 text-lg border-2 focus-visible:ring-primary' : 'pl-9 pr-9'
        )}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            large ? 'right-2 h-8 w-8' : 'right-1 h-7 w-7'
          )}
          onClick={() => onChange('')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
