'use client';

import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import FullInvoice from '@/components/FullInvoice';
import InvoiceDetail from '@/components/InvoiceDetail';
import type { Invoice } from '@/types';

/**
 * Shown right after an invoice is created: the full A4 invoice and the POS
 * receipt side by side, each with its own Print / Email buttons, so the user
 * can print whichever they want. Each side scopes its print to just itself via
 * the `print-only-invoice` / `print-only-receipt` body classes.
 */
export default function InvoiceReceiptView({ invoice }: { invoice: Invoice }) {
  return (
    <DialogContent className="max-w-6xl p-0 gap-0 overflow-hidden invoice-receipt-view">
      <DialogHeader className="px-6 pt-6 pb-4 border-b non-printable">
        <DialogTitle className="text-xl">Invoice {invoice.id} created</DialogTitle>
        <DialogDescription>Print or email the full invoice or the receipt.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6 p-4 md:p-6 max-h-[80vh] overflow-y-auto bg-muted/30 items-start">
        {/* Full A4 invoice — the larger, primary document */}
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 non-printable">Full invoice (A4)</p>
          <FullInvoice invoice={invoice} embedded />
        </div>
        {/* POS receipt — a narrow thermal slip, kept compact next to the invoice */}
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 non-printable">Receipt (POS)</p>
          <div className="w-full max-w-[320px] mx-auto lg:mx-0">
            <InvoiceDetail invoice={invoice} embedded />
          </div>
        </div>
      </div>
    </DialogContent>
  );
}
