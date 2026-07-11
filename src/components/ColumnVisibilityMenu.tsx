'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Columns3 } from '@/components/icons';
import type { useColumnVisibility } from '@/hooks/use-column-visibility';

type ColumnVisibilityMenuProps = {
  visibility: ReturnType<typeof useColumnVisibility>;
};

/** Dropdown trigger (usually placed next to Search/Export/Add buttons) letting a user
 *  show/hide non-locked columns for a table. Selection persists per-user via the hook. */
export function ColumnVisibilityMenu({ visibility }: ColumnVisibilityMenuProps) {
  const { columns, isVisible, toggleColumn, resetColumns, hiddenCount } = visibility;
  const toggleable = columns.filter(c => !c.locked);

  if (toggleable.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto">
          <Columns3 className="h-4 w-4" />
          Columns
          {hiddenCount > 0 && <span className="text-xs text-muted-foreground">({hiddenCount} hidden)</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {toggleable.map(col => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={isVisible(col.id)}
            onCheckedChange={(checked) => toggleColumn(col.id, checked)}
            onSelect={(e) => e.preventDefault()}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
        {hiddenCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={resetColumns}>Show all columns</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
