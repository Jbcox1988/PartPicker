import { useState, useEffect, useCallback } from 'react';

interface UseKeyboardNavigationOptions<T> {
  items: T[];
  enabled?: boolean;
  onSelect?: (item: T, index: number) => void;
  onAction?: (item: T, index: number) => void;
  getItemId: (item: T) => string;
}

/**
 * Hook for keyboard navigation through a list of items.
 *
 * Keyboard shortcuts:
 * - Arrow Up/Down or j/k: Navigate between items
 * - Enter or Space: Trigger action on selected item
 * - Escape: Clear selection
 * - Home: Go to first item
 * - End: Go to last item
 */
export function useKeyboardNavigation<T>({
  items,
  enabled = true,
  onSelect,
  onAction,
  getItemId,
}: UseKeyboardNavigationOptions<T>) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const selectedItem = selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex]
    : null;

  const selectedId = selectedItem ? getItemId(selectedItem) : null;

  const selectIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setSelectedIndex(index);
      onSelect?.(items[index], index);
    }
  }, [items, onSelect]);

  const selectNext = useCallback(() => {
    if (items.length === 0) return;
    const nextIndex = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, items.length - 1);
    selectIndex(nextIndex);
  }, [items.length, selectedIndex, selectIndex]);

  const selectPrevious = useCallback(() => {
    if (items.length === 0) return;
    const prevIndex = selectedIndex < 0 ? 0 : Math.max(selectedIndex - 1, 0);
    selectIndex(prevIndex);
  }, [items.length, selectedIndex, selectIndex]);

  const selectFirst = useCallback(() => {
    if (items.length > 0) {
      selectIndex(0);
    }
  }, [items.length, selectIndex]);

  const selectLast = useCallback(() => {
    if (items.length > 0) {
      selectIndex(items.length - 1);
    }
  }, [items.length, selectIndex]);

  const clearSelection = useCallback(() => {
    setSelectedIndex(-1);
  }, []);

  const triggerAction = useCallback(() => {
    if (selectedItem && selectedIndex >= 0) {
      onAction?.(selectedItem, selectedIndex);
    }
  }, [selectedItem, selectedIndex, onAction]);

  // Reset selection when items change significantly
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(items.length > 0 ? items.length - 1 : -1);
    }
  }, [items.length, selectedIndex]);

  // Keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          selectNext();
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          selectPrevious();
          break;
        case 'Enter':
        case ' ':
          if (selectedItem) {
            e.preventDefault();
            triggerAction();
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearSelection();
          break;
        case 'Home':
          e.preventDefault();
          selectFirst();
          break;
        case 'End':
          e.preventDefault();
          selectLast();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, selectedItem, selectNext, selectPrevious, selectFirst, selectLast, clearSelection, triggerAction]);

  return {
    selectedIndex,
    selectedId,
    selectedItem,
    selectIndex,
    selectNext,
    selectPrevious,
    selectFirst,
    selectLast,
    clearSelection,
    triggerAction,
  };
}
