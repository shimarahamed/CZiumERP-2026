'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type ContextMenuItem =
  | {
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      variant?: 'default' | 'destructive';
      separator?: never;
    }
  | { separator: true; label?: never; icon?: never; onClick?: never; variant?: never };

interface RowContextMenuProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  className?: string;
}

function ContextMenuPortal({
  position,
  items,
  onClose,
}: {
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if ((e as KeyboardEvent).key === 'Escape') { onClose(); return; }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  const left = Math.min(position.x, window.innerWidth - 200);
  const top = Math.min(position.y, window.innerHeight - 240);

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="min-w-[160px] rounded-md border bg-popover shadow-md py-1 text-popover-foreground"
      role="menu"
    >
      {items.map((item, i) => {
        const itemKey = 'separator' in item && item.separator ? `sep-${i}` : `${item.label}-${i}`;
        if ('separator' in item && item.separator) {
          return <div key={itemKey} className="my-1 h-px bg-border mx-2" />;
        }
        return (
          <button
            key={itemKey}
            role="menuitem"
            onClick={() => { item.onClick!(); onClose(); }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors',
              item.variant === 'destructive' && 'text-destructive hover:text-destructive'
            )}
          >
            {item.icon && <span className="h-4 w-4 shrink-0 flex items-center">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

export function RowContextMenu({ children, items, className }: RowContextMenuProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const close = useCallback(() => setPosition(null), []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <tr
        onContextMenu={handleContextMenu}
        className={cn('cursor-context-menu', className)}
      >
        {children}
      </tr>
      {position && (
        <ContextMenuPortal position={position} items={items} onClose={close} />
      )}
    </>
  );
}
