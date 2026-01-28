import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'link' | 'ghost';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  actions?: EmptyStateAction[];
  className?: string;
  /** Whether to wrap in a Card component (default: true) */
  withCard?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  actions,
  className,
  withCard = true,
}: EmptyStateProps) {
  const content = (
    <div className={cn('py-8 text-center', className)}>
      {Icon && (
        <Icon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      )}
      {title && (
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
      )}
      <p className="text-muted-foreground">{message}</p>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'outline'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  if (withCard) {
    return (
      <Card>
        <CardContent className="pt-0">{content}</CardContent>
      </Card>
    );
  }

  return content;
}
