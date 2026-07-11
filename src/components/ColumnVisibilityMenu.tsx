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
import { ChevronDown, ChevronUp, Columns3 } from '@/components/icons';
import type { useColumnVisibility } from '@/hooks/use-column-visibility';

type ColumnVisibilityMenuProps = {
  visibility: ReturnType<typeof useColumnVisibility>;
};

/** Dropdown trigger (usually placed next to Search/Export/Add buttons) letting a user
 *  show/hide non-locked columns for a table. Selection persists per-user via the hook. */
export function ColumnVisibilityMenu({ visibility }: ColumnVisibilityMenuProps) {
  const { columns, isVisible, toggleColumn, moveColumn, resetColumns, hiddenCount } = visibility;
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
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Show and arrange columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col, index) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={isVisible(col.id)}
            onCheckedChange={(checked) => { if (!col.locked) toggleColumn(col.id, checked); }}
            onSelect={(e) => e.preventDefault()}
            className="pr-2"
          >
            <span className="flex-1">{col.label}</span>
            <span className="ml-2 flex items-center gap-0.5">
              <button type="button" aria-label={`Move ${col.label} left`} disabled={index === 0} className="rounded p-1 hover:bg-accent disabled:opacity-30" onClick={(event) => { event.preventDefault(); event.stopPropagation(); moveColumn(col.id, -1); }}>
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label={`Move ${col.label} right`} disabled={index === columns.length - 1} className="rounded p-1 hover:bg-accent disabled:opacity-30" onClick={(event) => { event.preventDefault(); event.stopPropagation(); moveColumn(col.id, 1); }}>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </span>
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
