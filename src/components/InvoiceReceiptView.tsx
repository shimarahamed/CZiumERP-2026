'use client';

import { useEffect } from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import FullInvoice from '@/components/FullInvoice';
import InvoiceDetail from '@/components/InvoiceDetail';
import { AlertTriangle, CheckCircle, Loader2 } from '@/components/icons';
import type { Invoice } from '@/types';

/** Outbox sync state pill for POS sales posted in the background. */
function PostStatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.postStatus === 'queued') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Syncing…
      </span>
    );
  }
  if (invoice.postStatus === 'posted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="h-3 w-3" /> Posted
      </span>
    );
  }
  if (invoice.postStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" /> Posting failed{invoice.postError ? ` — ${invoice.postError}` : ''}
      </span>
    );
  }
  return null;
}

/** Prints just the targeted document, reusing the same body-class convention
 *  FullInvoice/InvoiceDetail use for their own Print buttons. */
function printDocument(target: 'invoice' | 'receipt') {
  document.body.classList.add('printing-invoice', target === 'invoice' ? 'print-only-invoice' : 'print-only-receipt');
  window.print();
  document.body.classList.remove('printing-invoice', 'print-only-invoice', 'print-only-receipt');
}

/**
 * Shown right after an invoice is created: the full A4 invoice and the POS
 * receipt side by side, each with its own Print / Email buttons, so the user
 * can print whichever they want. Each side scopes its print to just itself via
 * the `print-only-invoice` / `print-only-receipt` body classes.
 *
 * Keyboard shortcuts (while this dialog is open): F11 prints the full invoice,
 * F12 prints the receipt — lets a cashier print without reaching for the mouse.
 */
export default function InvoiceReceiptView({ invoice }: { invoice: Invoice }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') { e.preventDefault(); printDocument('invoice'); }
      else if (e.key === 'F12') { e.preventDefault(); printDocument('receipt'); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    // NOTE: the width override must carry the `sm:` prefix — the dialog base
    // styles set `sm:max-w-lg`, which beats an unprefixed `max-w-*` at ≥640px
    // and previously shrank this preview to a small dialog.
    <DialogContent className="w-[97vw] sm:max-w-[min(1500px,97vw)] h-[94vh] sm:max-h-[94vh] p-0 gap-0 overflow-hidden invoice-receipt-view flex flex-col">
      <DialogHeader className="px-6 pt-6 pb-4 border-b non-printable shrink-0">
        <DialogTitle className="text-xl flex items-center gap-3 flex-wrap">
          Invoice {invoice.id} created
          <PostStatusBadge invoice={invoice} />
        </DialogTitle>
        <DialogDescription>
          Print or email the full invoice or the receipt. Shortcut: <kbd className="px-1 py-0.5 rounded border bg-muted text-xs font-mono">F11</kbd> prints the invoice, <kbd className="px-1 py-0.5 rounded border bg-muted text-xs font-mono">F12</kbd> prints the receipt.
        </DialogDescription>
      </DialogHeader>
      {/* overflow-hidden here (not overflow-y-auto): each card below manages its
          own internal scroll region under a pinned footer, so the outer grid
          must never scroll itself or the action buttons would scroll away too. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6 p-4 md:p-6 overflow-hidden bg-muted/30 items-start flex-1 min-h-0">
        {/* Full A4 invoice — the larger, primary document */}
        <div className="flex flex-col h-full min-h-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 non-printable shrink-0">Full invoice (A4) — F11 to print</p>
          <FullInvoice invoice={invoice} embedded />
        </div>
        {/* POS receipt — a narrow thermal slip, kept compact next to the invoice */}
        <div className="flex flex-col h-full min-h-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 non-printable shrink-0">Receipt (POS) — F12 to print</p>
          <div className="w-full max-w-[320px] mx-auto lg:mx-0 min-h-0 flex-1 flex flex-col">
            <InvoiceDetail invoice={invoice} embedded />
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
