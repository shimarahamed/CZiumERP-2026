
'use client';

import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { Invoice, EmailLog } from '@/types';
import { Printer, Mail, Loader2, MessageSquare, Send, Download } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Store as StoreIcon } from '@/components/icons';
import Image from 'next/image';
import { addMoney, mulMoney, percentOf, formatNumber, lineTotal } from '@/lib/money';
import { sendTenantEmail, emailShell, escapeHtml, isSmtpConfigured } from '@/lib/email';
import { sendTenantSms, sendTenantWhatsapp, sendAndLogMessage } from '@/lib/messaging';
import { nodeToPdfBase64, downloadNodeAsPdf } from '@/lib/invoice-pdf';
import { CustomFieldsDisplay, useCustomFields } from '@/components/custom-fields/CustomFields';
import { formatDateUK, formatTimeUK } from '@/lib/date-format';
import { cn } from '@/lib/utils';

interface FullInvoiceProps {
    invoice: Invoice;
    /** When true, render as a plain block (for side-by-side embedding) instead of a DialogContent. */
    embedded?: boolean;
}

/**
 * Custom fields for the "lined" template's narrow sidebar box: "Label: Value"
 * on a single line per field, label non-wrapping so a long one (e.g. "Next
 * Service (KM)") never breaks onto its own line and shoves the value (and
 * every field after it) out of place. The shared CustomFieldsDisplay's 2-col
 * grid is meant for wider layouts and doesn't fit this ~16rem sidebar.
 */
function LinedCustomFields({ invoice }: { invoice: Invoice }) {
    const fields = useCustomFields('invoice');
    const data = invoice.customData ?? {};
    const populated = fields.filter(f => data[f.key] !== undefined && data[f.key] !== '' && data[f.key] !== null);
    if (populated.length === 0) return null;
    return (
        <>
            {populated.map(f => (
                <p key={f.key} className="flex gap-1">
                    <span className="text-muted-foreground whitespace-nowrap">{f.label}:</span>
                    <span className="font-medium truncate">{f.fieldType === 'boolean' ? (data[f.key] ? 'Yes' : 'No') : String(data[f.key])}</span>
                </p>
            ))}
        </>
    );
}

const FullInvoice = ({ invoice, embedded = false }: FullInvoiceProps) => {
    const {
        currencySymbol, customersMap, companyName, companyAddress, themeSettings,
        setEmailLogs, setMessageLogs, user, smtpConfigList,
    } = useAppContext();
    const { toast } = useToast();
    const [sending, setSending] = useState(false);
    const [sendingSms, setSendingSms] = useState(false);
    const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const printableRef = useRef<HTMLDivElement>(null);
    const smsEnabled = themeSettings.smsGatewayEnabled === true;
    const whatsappEnabled = themeSettings.whatsappGatewayEnabled === true;
    // Email is hidden until sending is configured. The themeSettings flag is
    // the staff-visible switch; the smtpConfigList fallback covers admins on
    // tenants configured before the flag existed (raw config is admin-only).
    const emailEnabled = themeSettings.emailGatewayEnabled === true
        || isSmtpConfigured(smtpConfigList.find(s => s.id === 'default'));
    const thermalCustomFields = useCustomFields('invoice').filter(f =>
        invoice.customData?.[f.key] !== undefined && invoice.customData?.[f.key] !== '' && invoice.customData?.[f.key] !== null
    );

    const handleDownload = async () => {
        if (!printableRef.current || downloading) return;
        setDownloading(true);
        try {
            await downloadNodeAsPdf(printableRef.current, `Invoice-${invoice.id}.pdf`);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Could not download PDF', description: err instanceof Error ? err.message : 'Download failed.' });
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = () => {
        // When embedded alongside the receipt, scope the print to just the invoice.
        document.body.classList.add('printing-invoice');
        if (embedded) document.body.classList.add('print-only-invoice');
        window.print();
        document.body.classList.remove('printing-invoice');
        document.body.classList.remove('print-only-invoice');
    };

    const Wrapper = embedded ? 'div' : DialogContent;
    const Footer = embedded ? 'div' : DialogFooter;
    // Embedded (post-create preview): fixed-height card with its own scroll region,
    // so the Print/Email action row stays pinned at the bottom instead of scrolling
    // away with the document content.
    const wrapperProps = embedded
        ? { className: 'printable-area-container border rounded-lg overflow-hidden bg-white flex flex-col h-full', 'data-print-target': 'invoice' as const }
        : { className: 'sm:max-w-4xl max-h-[90vh] p-0 gap-0 printable-area-container flex flex-col', 'data-print-target': 'invoice' as const };

    // Integer-cents arithmetic — no float drift on printed documents.
    // Subtotal is the GROSS amount (before any discount). The Discount line
    // combines every item's own discount plus the invoice-level %; tax applies
    // to what remains. Grand total = gross − total discount + tax.
    const grossSubtotal = addMoney(...invoice.items.map(item => mulMoney(item.price, item.quantity)), 0);
    const netLines = addMoney(...invoice.items.map(item => lineTotal(item.price, item.quantity, item.discount, item.discountType)), 0);
    const itemDiscountsTotal = addMoney(grossSubtotal, -netLines);
    const invoiceDiscountAmount = percentOf(netLines, invoice.discount || 0);
    const totalDiscount = addMoney(itemDiscountsTotal, invoiceDiscountAmount);
    const taxAmount = percentOf(addMoney(netLines, -invoiceDiscountAmount), invoice.taxRate || 0);
    /** Plain formatted number — no "%" and no currency symbol, since a line's
     *  discount can be either a percentage or a fixed amount and the column
     *  header + the single currency caption under the table already say which.
     *  Always returns a value (never blank) so the column reads "0.00" rather
     *  than a dash when a line has no discount. */
    const itemDiscountLabel = (item: typeof invoice.items[number]) => formatNumber(item.discount ?? 0);
    /** Same number, but with "%" or the currency symbol reattached — for the
     *  prose-style receipts (thermal slip, plain-text email) where the figure
     *  stands alone in a sentence rather than under a labelled table column. */
    const itemDiscountLabelWithUnit = (item: typeof invoice.items[number]) =>
        item.discountType === 'amount' ? `${currencySymbol}${formatNumber(item.discount ?? 0)}` : `${formatNumber(item.discount ?? 0)}%`;
    // Falls back to "Pcs" for lines saved before unit tracking existed.
    const qtyWithUnit = (item: typeof invoice.items[number]) =>
        `${item.quantity} ${item.unit || 'Pcs'}`;

    // Template + branding controls (tenant-admin configurable in Settings).
    // 'minimal' was renamed to 'lined' (boxed/ruled redesign) — map any tenant
    // doc still holding the old value so it doesn't fall through to classic.
    const savedTemplate = themeSettings.invoiceTemplate as string | undefined;
    const template = savedTemplate === 'minimal' ? 'lined' : (savedTemplate ?? 'classic');
    const showLogo = themeSettings.showLogoOnDocuments !== false;
    const footerText = themeSettings.documentFooter || 'Thank you for your business!';
    const accent = themeSettings.documentAccent || '#1f2937';
    const companyPhone = themeSettings.companyPhone?.trim();
    const companyWebsite = themeSettings.companyWebsite?.trim();
    const regNumber = themeSettings.companyRegNumber?.trim();

    const generateTextReceipt = () => {
      let receipt = `INVOICE from ${companyName}\n`;
      if (regNumber) receipt += `Reg No: ${regNumber}\n`;
      receipt += `Invoice ID: ${invoice.id}\n`;
      receipt += `Date: ${formatDateUK(invoice.date)}  Time: ${formatTimeUK(invoice.createdAt ?? invoice.date)}\n\n`;
      receipt += `Items:\n`;
      invoice.items.forEach(item => {
        const disc = (item.discount ?? 0) > 0 ? ` -${itemDiscountLabelWithUnit(item)}` : '';
        receipt += `- ${item.productName} (x${qtyWithUnit(item)}) @ ${currencySymbol} ${formatNumber(item.price)}${disc} = ${currencySymbol} ${formatNumber(lineTotal(item.price, item.quantity, item.discount, item.discountType))}\n`;
      });
      receipt += `\nSubtotal: ${currencySymbol} ${formatNumber(grossSubtotal)}\n`;
      if (totalDiscount > 0) {
        receipt += `Discount${invoice.discount ? ` (incl. ${invoice.discount}%)` : ''}: -${currencySymbol} ${formatNumber(totalDiscount)}\n`;
      }
      if (invoice.taxRate) {
        receipt += `Tax (${invoice.taxRate}%): +${currencySymbol} ${formatNumber(taxAmount)}\n`;
      }
      receipt += `TOTAL: ${currencySymbol} ${formatNumber(invoice.amount)}\n\n`;
      receipt += `Thank you for your business!`;
      return receipt;
    }

    const handleEmailReceipt = async () => {
      const customer = invoice.customerId && customersMap ? customersMap.get(invoice.customerId) : undefined;
      if (!customer?.email) {
          toast({
              variant: 'destructive',
              title: 'Cannot Email Invoice',
              description: "No email address is associated with this customer.",
          });
          return;
      }
      const subject = `Your Invoice from ${companyName} (#${invoice.id})`;
      const text = generateTextReceipt();
      const html = emailShell(companyName || '', 'Invoice', `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text)}</pre>`);

      setSending(true);
      try {
        const attachments = printableRef.current
          ? [await nodeToPdfBase64(printableRef.current, `Invoice-${invoice.id}.pdf`)]
          : undefined;
        await sendTenantEmail({ to: customer.email, subject, html, text, attachments });
        setEmailLogs(prev => [{
          id: `log-${Date.now()}`,
          department: 'Sales & Customers',
          templateId: 'invoice-manual-send',
          to: customer.email!,
          subject,
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentBy: user?.name ?? 'system',
        } as EmailLog, ...prev]);
        toast({ title: 'Invoice emailed', description: `Sent to ${customer.email}.` });
      } catch (err) {
        setEmailLogs(prev => [{
          id: `log-${Date.now()}`,
          department: 'Sales & Customers',
          templateId: 'invoice-manual-send',
          to: customer.email!,
          subject,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Send failed',
          sentAt: new Date().toISOString(),
          sentBy: user?.name ?? 'system',
        } as EmailLog, ...prev]);
        toast({ variant: 'destructive', title: 'Could not send email', description: err instanceof Error ? err.message : 'Send failed.' });
      } finally {
        setSending(false);
      }
    }

    const handleSendWhatsapp = async () => {
      const customer = invoice.customerId && customersMap ? customersMap.get(invoice.customerId) : undefined;
      const to = invoice.customerPhone || customer?.phone;
      if (!to) {
        toast({ variant: 'destructive', title: 'Cannot Send WhatsApp', description: 'No phone number is associated with this customer.' });
        return;
      }
      setSendingWhatsapp(true);
      try {
        const pdf = printableRef.current ? await nodeToPdfBase64(printableRef.current, `Invoice-${invoice.id}.pdf`) : undefined;
        const text = `Your invoice ${invoice.id} from ${companyName} — total ${currencySymbol} ${formatNumber(invoice.amount)}.`;
        await sendAndLogMessage(
          { setMessageLogs }, 'whatsapp', 'Sales & Customers', 'invoice-manual-send', to, text, user?.name ?? 'system',
          () => sendTenantWhatsapp({ to, text, pdf })
        );
        toast({ title: 'Invoice sent on WhatsApp', description: `Sent to ${to}.` });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Could not send WhatsApp message', description: err instanceof Error ? err.message : 'Send failed.' });
      } finally {
        setSendingWhatsapp(false);
      }
    };

    const handleSendSms = async () => {
      const customer = invoice.customerId && customersMap ? customersMap.get(invoice.customerId) : undefined;
      const to = invoice.customerPhone || customer?.phone;
      if (!to) {
        toast({ variant: 'destructive', title: 'Cannot Send SMS', description: 'No phone number is associated with this customer.' });
        return;
      }
      setSendingSms(true);
      try {
        const text = `Your invoice ${invoice.id} from ${companyName} — total ${currencySymbol} ${formatNumber(invoice.amount)}.`;
        await sendAndLogMessage(
          { setMessageLogs }, 'sms', 'Sales & Customers', 'invoice-manual-send', to, text, user?.name ?? 'system',
          () => sendTenantSms({ to, text })
        );
        toast({ title: 'Invoice SMS sent', description: `Sent to ${to}.` });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Could not send SMS', description: err instanceof Error ? err.message : 'Send failed.' });
      } finally {
        setSendingSms(false);
      }
    };

    const customer = invoice.customerId && customersMap ? customersMap.get(invoice.customerId) : undefined;

    return (
        <Wrapper {...wrapperProps}>
            {!embedded && (
                <DialogHeader className="sr-only">
                  <DialogTitle>Full Invoice for {invoice.id}</DialogTitle>
                </DialogHeader>
            )}
            {template === 'thermal-receipt' ? (
              /* ---- POS thermal receipt (80mm), boxed/ruled to match the "lined" A4 style ---- */
              <div ref={printableRef} className={cn('printable-area force-light-doc bg-white text-black p-3 mx-auto font-mono text-xs overflow-y-auto flex-1 min-h-0 border-2 border-black')} style={{ maxWidth: '300px' }}>
                <div className="text-center space-y-1 mb-2 pb-2 border-b-2 border-black">
                  {showLogo && themeSettings.logoUrl && (
                    <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={40} height={40} className="mx-auto" />
                  )}
                  <p className="font-bold text-sm">{companyName}</p>
                  <p className="whitespace-pre-wrap">{companyAddress}</p>
                  {companyPhone && <p>{companyPhone}</p>}
                  {companyWebsite && <p>{companyWebsite}</p>}
                  {regNumber && <p>Reg No: {regNumber}</p>}
                </div>
                <div className="space-y-0.5 pb-2 mb-2 border-b-2 border-black">
                  <p>Receipt: {invoice.id}</p>
                  <p>Date: {formatDateUK(invoice.date)}</p>
                  <p>Time: {formatTimeUK(invoice.createdAt ?? invoice.date)}</p>
                  <p>Customer: {invoice.customerName || 'Walk-in'}</p>
                  {invoice.customerPhone && <p>Phone: {invoice.customerPhone}</p>}
                  {invoice.paymentMethod && <p className="capitalize">Payment: {invoice.paymentMethod}</p>}
                  {invoice.notes && <p className="whitespace-pre-wrap">Note: {invoice.notes}</p>}
                  {invoice.customData && Object.keys(invoice.customData).length > 0 && thermalCustomFields.map(f => (
                    <p key={f.key}>{f.label}: {f.fieldType === 'boolean' ? (invoice.customData![f.key] ? 'Yes' : 'No') : String(invoice.customData![f.key] ?? '')}</p>
                  ))}
                </div>
                {/* Currency stated once for the item list, not repeated on every line */}
                <div className="flex justify-between text-[10px] text-muted-foreground pb-1">
                  <span>Item</span>
                  <span>Amount ({currencySymbol})</span>
                </div>
                <div className="pb-2 mb-2 border-b-2 border-black divide-y divide-dashed divide-black">
                  {invoice.items.map((item, i) => {
                    const gross = mulMoney(item.price, item.quantity);
                    const net = lineTotal(item.price, item.quantity, item.discount, item.discountType);
                    return (
                      <div key={`item-${i}`} className="py-1 first:pt-0 last:pb-0">
                        <div className="flex justify-between gap-2">
                          <span className="truncate">{item.productName} x{qtyWithUnit(item)}</span>
                          <span className="shrink-0">{formatNumber(net)}</span>
                        </div>
                        {(item.discount ?? 0) > 0 && (
                          <div className="flex justify-between gap-2 pl-2 text-[10px]">
                            <span>({formatNumber(gross)} less {itemDiscountLabelWithUnit(item)} off)</span>
                            <span>-{formatNumber(addMoney(gross, -net))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-0.5 pb-2 mb-2 border-b-2 border-black">
                  <div className="flex justify-between"><span>Subtotal</span><span>{currencySymbol}{formatNumber(grossSubtotal)}</span></div>
                  {totalDiscount > 0 && <div className="flex justify-between"><span>Discount{invoice.discount ? ` (incl. ${invoice.discount}%)` : ''}</span><span>-{currencySymbol}{formatNumber(totalDiscount)}</span></div>}
                  <div className="flex justify-between"><span>Tax {invoice.taxRate || 0}%</span><span>{currencySymbol}{formatNumber(taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-sm mt-1"><span>TOTAL</span><span>{currencySymbol}{formatNumber(invoice.amount)}</span></div>
                </div>
                <p className="text-center whitespace-pre-wrap">{footerText}</p>
              </div>
            ) : template === 'lined' ? (
              /* ---- A4 invoice: lined — outer box + ruled inner boxes, fully gridded table ---- */
              <div ref={printableRef} className={cn('printable-area force-light-doc bg-white text-black p-4 sm:p-6 overflow-y-auto flex-1 min-h-0')}>
                <div className="border border-gray-400">
                  {/* Header box: logo/company left, INVOICE + meta right, ruled divider between */}
                  <div className="flex flex-col sm:flex-row border-b border-gray-400">
                    <div className="flex-1 p-4 sm:border-r sm:border-gray-400">
                      <div className="flex items-center gap-3 mb-2">
                        {showLogo && (themeSettings.logoUrl
                          ? <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={72} height={72} className="object-contain" />
                          : <StoreIcon className="h-9 w-9" />)}
                        <h1 className="text-2xl font-bold">{companyName}</h1>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{companyAddress}</p>
                      {companyPhone && <p className="text-sm">{companyPhone}</p>}
                      {companyWebsite && <p className="text-sm">{companyWebsite}</p>}
                      {regNumber && <p className="text-sm">Reg No: {regNumber}</p>}
                    </div>
                    <div className="sm:w-64 p-4 shrink-0">
                      <h2 className="text-2xl font-bold tracking-wide mb-1"># {invoice.id}</h2>
                      <p className="text-lg font-semibold text-muted-foreground mb-2">INVOICE</p>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between gap-2"><span className="font-semibold">Date:</span><span>{formatDateUK(invoice.date)}</span></div>
                        <div className="flex justify-between gap-2"><span className="font-semibold">Time:</span><span>{formatTimeUK(invoice.createdAt ?? invoice.date)}</span></div>
                        <div className="flex justify-between gap-2"><span className="font-semibold">Status:</span><span className="capitalize font-medium">{invoice.status}</span></div>
                        {invoice.paymentMethod && <div className="flex justify-between gap-2"><span className="font-semibold">Payment:</span><span className="capitalize font-medium">{invoice.paymentMethod}</span></div>}
                      </div>
                    </div>
                  </div>

                  {/* Bill-to box, ruled from header and (when present) from custom fields.
                      Custom fields get their own stacked (label above value) layout here —
                      the shared CustomFieldsDisplay's 2-col grid is too cramped in a sidebar
                      and was wrapping long labels like "Next Service (KM)" onto their own
                      line, which pushed everything below it out of alignment. */}
                  <div className="flex flex-col sm:flex-row border-b border-gray-400">
                    <div className="flex-1 p-4 sm:border-r sm:border-gray-400">
                      <h3 className="font-semibold mb-1 uppercase text-xs tracking-wide">Bill To</h3>
                      <p>{invoice.customerName || 'Walk-in Customer'}</p>
                      {(invoice.customerPhone || customer?.phone) && <p className="text-muted-foreground">{invoice.customerPhone || customer?.phone}</p>}
                      {(invoice.customerEmail || customer?.email) && <p className="text-muted-foreground">{invoice.customerEmail || customer?.email}</p>}
                    </div>
                    {invoice.customData && Object.keys(invoice.customData).length > 0 && (
                      <div className="sm:w-64 p-4 shrink-0 text-sm space-y-1">
                        <LinedCustomFields invoice={invoice} />
                      </div>
                    )}
                  </div>

                  {invoice.notes && (
                    <div className="p-4 border-b border-gray-400">
                      <h3 className="font-semibold mb-1 uppercase text-xs tracking-wide">Additional Details</h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                  )}

                  {/* Item table — ruled outline + header only, no lines between rows
                      (that's what makes this distinctly "lined": the grid frames the
                      table, it doesn't stripe every row). The currency is stated once
                      in the money column headers, not repeated on every row. */}
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-400 bg-black/5">
                        <th className="border-r border-gray-400 p-2 w-10 text-left font-semibold">#</th>
                        <th className="border-r border-gray-400 p-2 text-left font-semibold">Item</th>
                        <th className="border-r border-gray-400 p-2 w-14 text-center font-semibold">Qty</th>
                        <th className="border-r border-gray-400 p-2 w-16 text-center font-semibold">Unit</th>
                        <th className="border-r border-gray-400 p-2 w-28 text-right font-semibold whitespace-nowrap">Unit Price ({currencySymbol})</th>
                        <th className="border-r border-gray-400 p-2 w-24 text-right font-semibold">Discount</th>
                        <th className="p-2 w-28 text-right font-semibold whitespace-nowrap">Total ({currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr key={`invoice-item-${index}`}>
                          <td className="border-r border-gray-400 p-1.5">{index + 1}</td>
                          <td className="border-r border-gray-400 p-1.5 font-medium">{item.productName}</td>
                          <td className="border-r border-gray-400 p-1.5 text-center">{item.quantity}</td>
                          <td className="border-r border-gray-400 p-1.5 text-center">{item.unit || 'Pcs'}</td>
                          <td className="border-r border-gray-400 p-1.5 text-right whitespace-nowrap">{formatNumber(item.price)}</td>
                          <td className="border-r border-gray-400 p-1.5 text-right">{itemDiscountLabel(item)}</td>
                          <td className="p-1.5 text-right whitespace-nowrap">{formatNumber(lineTotal(item.price, item.quantity, item.discount, item.discountType))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Closing rule after the last item row, before totals */}
                  <div className="border-b border-gray-400" />

                  {/* Totals box, ruled off from the table */}
                  <div className="flex justify-end">
                    <div className="w-full sm:w-72 p-4 space-y-2">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{currencySymbol} {formatNumber(grossSubtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Discount{invoice.discount ? ` (incl. ${invoice.discount}%)` : ''}:</span><span className="font-medium text-destructive">-{currencySymbol} {formatNumber(totalDiscount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tax ({invoice.taxRate || 0}%):</span><span className="font-medium">{currencySymbol} {formatNumber(taxAmount)}</span></div>
                      <div className="border-t border-gray-400 pt-2 flex justify-between font-bold text-lg">
                        <span>Grand Total:</span>
                        <span>{currencySymbol} {formatNumber(invoice.amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="mt-4 text-center text-sm text-muted-foreground" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <p className="whitespace-pre-wrap">{footerText}</p>
                </footer>
              </div>
            ) : (
              /* ---- A4 invoice: classic / modern ---- */
              <div ref={printableRef} className={cn('printable-area force-light-doc bg-white text-black p-4 sm:p-8 overflow-y-auto flex-1 min-h-0')}>
                {template === 'modern' && (
                  <div className="-m-4 sm:-m-8 mb-6 sm:mb-8 p-4 sm:p-8 text-white" style={{ backgroundColor: accent }}>
                    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start">
                      <div className="flex items-center gap-3">
                        {showLogo && (themeSettings.logoUrl
                          ? <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={84} height={84} className="rounded-lg bg-white/90 p-1 object-contain" />
                          : <StoreIcon className="h-10 w-10" />)}
                        <div>
                          <h1 className="text-2xl font-bold">{companyName}</h1>
                          <p className="text-sm opacity-90 whitespace-pre-wrap">{companyAddress}</p>
                          {companyPhone && <p className="text-sm opacity-90">{companyPhone}</p>}
                          {companyWebsite && <p className="text-sm opacity-90">{companyWebsite}</p>}
                          {regNumber && <p className="text-sm opacity-90">Reg No: {regNumber}</p>}
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <h2 className="text-3xl font-bold tracking-wide">INVOICE</h2>
                        <p className="opacity-90"># {invoice.id}</p>
                        <div className="mt-2 text-sm space-y-0.5 opacity-90">
                          <p><span className="font-semibold">Date:</span> {formatDateUK(invoice.date)}</p>
                          <p><span className="font-semibold">Time:</span> {formatTimeUK(invoice.createdAt ?? invoice.date)}</p>
                          <p><span className="font-semibold">Status:</span> <span className="capitalize">{invoice.status}</span></p>
                          {invoice.paymentMethod && <p><span className="font-semibold">Payment:</span> <span className="capitalize">{invoice.paymentMethod}</span></p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {template !== 'modern' && (
                  <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        {showLogo && (themeSettings.logoUrl
                          ? <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={72} height={72} className="rounded-lg object-contain" />
                          : <StoreIcon className="h-8 w-8 text-primary" />)}
                        <h1 className="text-2xl font-bold">{companyName}</h1>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap">{companyAddress}</p>
                      {companyPhone && <p className="text-muted-foreground">{companyPhone}</p>}
                      {companyWebsite && <p className="text-muted-foreground">{companyWebsite}</p>}
                      {regNumber && <p className="text-muted-foreground">Reg No: {regNumber}</p>}
                    </div>
                    <div className="sm:text-right">
                      <h2 className="text-3xl font-bold text-gray-800">INVOICE</h2>
                      <p className="text-muted-foreground"># {invoice.id}</p>
                      <div className="mt-2 text-sm space-y-1 sm:text-right">
                        <div className="flex sm:justify-end gap-2">
                            <span className="font-semibold">Invoice Date:</span>
                            <span>{formatDateUK(invoice.date)}</span>
                        </div>
                        <div className="flex sm:justify-end gap-2">
                            <span className="font-semibold">Time:</span>
                            <span>{formatTimeUK(invoice.createdAt ?? invoice.date)}</span>
                        </div>
                        <div className="flex sm:justify-end gap-2">
                            <span className="font-semibold">Status:</span>
                            <span className="capitalize font-medium">{invoice.status}</span>
                        </div>
                        {invoice.paymentMethod && (
                            <div className="flex sm:justify-end gap-2">
                                <span className="font-semibold">Payment:</span>
                                <span className="capitalize font-medium">{invoice.paymentMethod}</span>
                            </div>
                        )}
                      </div>
                    </div>
                  </header>
                )}

                <section className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
                    <div>
                        <h3 className="font-semibold mb-1">Bill To:</h3>
                        <p>{invoice.customerName || 'Walk-in Customer'}</p>
                        {(invoice.customerPhone || customer?.phone) && <p className="text-muted-foreground">{invoice.customerPhone || customer?.phone}</p>}
                        {(invoice.customerEmail || customer?.email) && <p className="text-muted-foreground">{invoice.customerEmail || customer?.email}</p>}
                    </div>
                    {invoice.customData && Object.keys(invoice.customData).length > 0 && (
                        <div className="sm:text-right sm:max-w-xs">
                            <CustomFieldsDisplay entity="invoice" value={invoice.customData} />
                        </div>
                    )}
                </section>

                {invoice.notes && (
                    <section className="mb-8">
                        <h3 className="font-semibold mb-1">Additional Details:</h3>
                        <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                    </section>
                )}

                {template === 'modern' && invoice.customData && Object.keys(invoice.customData).length > 0 && (
                    <section className="mb-8">
                        <CustomFieldsDisplay entity="invoice" value={invoice.customData} />
                    </section>
                )}

                {/* Compact rows (tight padding, smaller text) so an A4 page fits more items */}
                <section className="overflow-x-auto">
                    <Table className="text-sm">
                        <TableHeader>
                            <TableRow className="bg-muted/50"
                              style={template === 'modern' ? { backgroundColor: `${accent}14` } : undefined}>
                                <TableHead className="w-[48px] h-8 py-1">#</TableHead>
                                <TableHead className="h-8 py-1">Item</TableHead>
                                <TableHead className="h-8 py-1 text-center">Qty</TableHead>
                                <TableHead className="h-8 py-1 text-center">Unit</TableHead>
                                <TableHead className="h-8 py-1 text-right">Unit Price ({currencySymbol})</TableHead>
                                <TableHead className="h-8 py-1 text-right">Discount</TableHead>
                                <TableHead className="h-8 py-1 text-right">Total ({currencySymbol})</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.items.map((item, index) => (
                                <TableRow key={`invoice-item-${index}`}>
                                    <TableCell className="py-1.5">{index + 1}</TableCell>
                                    <TableCell className="py-1.5 font-medium">{item.productName}</TableCell>
                                    <TableCell className="py-1.5 text-center">{item.quantity}</TableCell>
                                    <TableCell className="py-1.5 text-center">{item.unit || 'Pcs'}</TableCell>
                                    <TableCell className="py-1.5 text-right">{formatNumber(item.price)}</TableCell>
                                    <TableCell className="py-1.5 text-right">{itemDiscountLabel(item)}</TableCell>
                                    <TableCell className="py-1.5 text-right">{formatNumber(lineTotal(item.price, item.quantity, item.discount, item.discountType))}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>

                <section className="flex justify-end mt-6">
                    <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span className="font-medium">{currencySymbol} {formatNumber(grossSubtotal)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount{invoice.discount ? ` (incl. ${invoice.discount}%)` : ''}:</span>
                            <span className="font-medium text-destructive">-{currencySymbol} {formatNumber(totalDiscount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax ({invoice.taxRate || 0}%):</span>
                            <span className="font-medium">{currencySymbol} {formatNumber(taxAmount)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg" style={template === 'modern' ? { color: accent } : undefined}>
                            <span>Grand Total:</span>
                            <span>{currencySymbol} {formatNumber(invoice.amount)}</span>
                        </div>
                    </div>
                </section>

                <footer className="mt-16 text-center text-sm text-muted-foreground">
                    <p className="whitespace-pre-wrap">{footerText}</p>
                </footer>
              </div>
            )}
            {/* Single row of equal-width actions — never wraps, so every button
                stays visible without scrolling even beside optional channels. */}
            <Footer className={cn('non-printable p-3 border-t flex flex-row flex-nowrap gap-2 shrink-0')}>
                {emailEnabled && (
                    <Button onClick={handleEmailReceipt} variant="outline" className="flex-1 min-w-0 px-2" disabled={sending}>
                        {sending ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4 shrink-0" />}
                        <span className="truncate">{sending ? 'Sending…' : 'Email'}</span>
                    </Button>
                )}
                {whatsappEnabled && (
                    <Button onClick={handleSendWhatsapp} variant="outline" className="flex-1 min-w-0 px-2" disabled={sendingWhatsapp}>
                        {sendingWhatsapp ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4 shrink-0" />}
                        <span className="truncate">{sendingWhatsapp ? 'Sending…' : 'WhatsApp'}</span>
                    </Button>
                )}
                {smsEnabled && (
                    <Button onClick={handleSendSms} variant="outline" className="flex-1 min-w-0 px-2" disabled={sendingSms}>
                        {sendingSms ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <Send className="mr-1.5 h-4 w-4 shrink-0" />}
                        <span className="truncate">{sendingSms ? 'Sending…' : 'SMS'}</span>
                    </Button>
                )}
                <Button onClick={handleDownload} variant="outline" className="flex-1 min-w-0 px-2" disabled={downloading}>
                    {downloading ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <Download className="mr-1.5 h-4 w-4 shrink-0" />}
                    <span className="truncate">{downloading ? 'Saving…' : 'Download'}</span>
                </Button>
                <Button onClick={handlePrint} variant="outline" className="flex-1 min-w-0 px-2">
                    <Printer className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="truncate">Print</span>
                </Button>
            </Footer>
        </Wrapper>
    );
};

export default FullInvoice;
