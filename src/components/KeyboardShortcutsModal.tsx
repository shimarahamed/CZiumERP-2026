
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const shortcuts = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette / search' },
  { keys: ['N'], description: 'New record (on list pages, when not typing)' },
  { keys: ['?'], description: 'Show this keyboard shortcuts guide' },
  { keys: ['Escape'], description: 'Close dialog or palette' },
  { keys: ['Tab'], description: 'Move focus to next element' },
  { keys: ['Shift', 'Tab'], description: 'Move focus to previous element' },
  { keys: ['Enter'], description: 'Confirm / activate focused item' },
  { keys: ['Alt', '←'], description: 'Go back (browser history)' },
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {shortcuts.map((s, i) => (
            <div key={`shortcut-${i}`} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, ki) => (
                  <span key={`key-${i}-${ki}`} className="flex items-center gap-1">
                    {ki > 0 && <span className="text-xs text-muted-foreground">+</span>}
                    <kbd className="text-xs bg-muted border px-1.5 py-0.5 rounded font-mono">{k}</kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">Press <kbd className="bg-muted border px-1 py-0.5 rounded text-xs">?</kbd> anytime to toggle this panel</p>
      </DialogContent>
    </Dialog>
  );
}
