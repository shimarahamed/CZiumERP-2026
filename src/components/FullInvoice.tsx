
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { Invoice, EmailLog } from '@/types';
import { Printer, Mail, Loader2 } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Store as StoreIcon } from '@/components/icons';
import Image from 'next/image';
import { addMoney, mulMoney, percentOf } from '@/lib/money';
import { isSmtpConfigured, sendTenantEmail, emailShell, escapeHtml } from '@/lib/email';
import { CustomFieldsDisplay, useCustomFields } from '@/components/custom-fields/CustomFields';
import { formatDateUK, formatTimeUK } from '@/lib/date-format';

interface FullInvoiceProps {
    invoice: Invoice;
    /** When true, render as a plain block (for side-by-side embedding) instead of a DialogContent. */
    embedded?: boolean;
}

const FullInvoice = ({ invoice, embedded = false }: FullInvoiceProps) => {
    const { currencySymbol, customersMap, companyName, companyAddress, themeSettings, smtpConfigList, setEmailLogs, user } = useAppContext();
    const { toast } = useToast();
    const [sending, setSending] = useState(false);
    const thermalCustomFields = useCustomFields('invoice').filter(f =>
        invoice.customData?.[f.key] !== undefined && invoice.customData?.[f.key] !== '' && invoice.customData?.[f.key] !== null
    );

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
    const wrapperProps = embedded
        ? { className: 'printable-area-container border rounded-lg overflow-hidden bg-white', 'data-print-target': 'invoice' as const }
        : { className: 'sm:max-w-4xl p-0 printable-area-container', 'data-print-target': 'invoice' as const };

    // Integer-cents arithmetic — no float drift on printed documents
    const subtotal = addMoney(...invoice.items.map(item => mulMoney(item.price, item.quantity)), 0);
    const discountAmount = percentOf(subtotal, invoice.discount || 0);
    const taxAmount = percentOf(addMoney(subtotal, -discountAmount), invoice.taxRate || 0);

    // Template + branding controls (tenant-admin configurable in Settings)
    const template = themeSettings.invoiceTemplate ?? 'classic';
    const showLogo = themeSettings.showLogoOnDocuments !== false;
    const footerText = themeSettings.documentFooter || 'Thank you for your business!';
    const accent = themeSettings.documentAccent || '#1f2937';
    const companyPhone = themeSettings.companyPhone?.trim();
    const companyWebsite = themeSettings.companyWebsite?.trim();

    const generateTextReceipt = () => {
      let receipt = `INVOICE from ${companyName}\n`;
      receipt += `Invoice ID: ${invoice.id}\n`;
      receipt += `Date: ${new Date(invoice.date).toLocaleDateString()}\n\n`;
      receipt += `Items:\n`;
      invoice.items.forEach(item => {
        receipt += `- ${item.productName} (x${item.quantity}) @ ${currencySymbol} ${item.price.toFixed(2)}\n`;
      });
      receipt += `\nSubtotal: ${currencySymbol} ${subtotal.toFixed(2)}\n`;
      if (invoice.discount) {
        receipt += `Discount (${invoice.discount}%): -${currencySymbol} ${discountAmount.toFixed(2)}\n`;
      }
      if (invoice.taxRate) {
        receipt += `Tax (${invoice.taxRate}%): +${currencySymbol} ${taxAmount.toFixed(2)}\n`;
      }
      receipt += `TOTAL: ${currencySymbol} ${invoice.amount.toFixed(2)}\n\n`;
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

      const smtp = smtpConfigList.find(s => s.id === 'default');
      if (!isSmtpConfigured(smtp)) {
          toast({
              variant: 'destructive',
              title: 'Email not configured',
              description: 'Set up SMTP in Settings → Email Notifications first.',
          });
          return;
      }

      const subject = `Your Invoice from ${companyName} (#${invoice.id})`;
      const text = generateTextReceipt();
      const html = emailShell(companyName || '', 'Invoice', `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text)}</pre>`);

      setSending(true);
      try {
        await sendTenantEmail(smtp, { to: customer.email, subject, html, text });
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

    const customer = invoice.customerId && customersMap ? customersMap.get(invoice.customerId) : undefined;

    return (
        <Wrapper {...wrapperProps}>
            {!embedded && (
                <DialogHeader className="sr-only">
                  <DialogTitle>Full Invoice for {invoice.id}</DialogTitle>
                </DialogHeader>
            )}
            {template === 'thermal-receipt' ? (
              /* ---- POS thermal receipt (80mm) ---- */
              <div className="printable-area force-light-doc bg-white text-black p-4 mx-auto font-mono text-xs" style={{ maxWidth: '300px' }}>
                <div className="text-center space-y-1 mb-3">
                  {showLogo && themeSettings.logoUrl && (
                    <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={40} height={40} className="mx-auto" />
                  )}
                  <p className="font-bold text-sm">{companyName}</p>
                  <p className="whitespace-pre-wrap">{companyAddress}</p>
                  {companyPhone && <p>Tel: {companyPhone}</p>}
                  {companyWebsite && <p>{companyWebsite}</p>}
                </div>
                <div className="border-t border-dashed border-black my-2" />
                <p>Receipt: {invoice.id}</p>
                <p>Date: {formatDateUK(invoice.date)}</p>
                <p>Time: {formatTimeUK(invoice.createdAt ?? invoice.date)}</p>
                <p>Customer: {invoice.customerName || 'Walk-in'}</p>
                {invoice.customerPhone && <p>Phone: {invoice.customerPhone}</p>}
                {invoice.paymentMethod && <p className="capitalize">Payment: {invoice.paymentMethod}</p>}
                {invoice.customData && Object.keys(invoice.customData).length > 0 && thermalCustomFields.map(f => (
                  <p key={f.key}>{f.label}: {f.fieldType === 'boolean' ? (invoice.customData![f.key] ? 'Yes' : 'No') : String(invoice.customData![f.key] ?? '')}</p>
                ))}
                <div className="border-t border-dashed border-black my-2" />
                {invoice.items.map((item, i) => (
                  <div key={`item-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">{item.productName} x{item.quantity}</span>
                    <span className="shrink-0">{currencySymbol}{mulMoney(item.price, item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-black my-2" />
                <div className="flex justify-between"><span>Subtotal</span><span>{currencySymbol}{subtotal.toFixed(2)}</span></div>
                {(invoice.discount || 0) > 0 && <div className="flex justify-between"><span>Discount {invoice.discount}%</span><span>-{currencySymbol}{discountAmount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span>Tax {invoice.taxRate || 0}%</span><span>{currencySymbol}{taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-sm mt-1"><span>TOTAL</span><span>{currencySymbol}{invoice.amount.toFixed(2)}</span></div>
                <div className="border-t border-dashed border-black my-2" />
                <p className="text-center whitespace-pre-wrap">{footerText}</p>
              </div>
            ) : (
              /* ---- A4 invoice: classic / modern / minimal ---- */
              <div className="printable-area force-light-doc bg-white text-black p-4 sm:p-8">
                {template === 'modern' && (
                  <div className="-m-4 sm:-m-8 mb-6 sm:mb-8 p-4 sm:p-8 text-white" style={{ backgroundColor: accent }}>
                    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start">
                      <div className="flex items-center gap-3">
                        {showLogo && (themeSettings.logoUrl
                          ? <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={40} height={40} className="rounded bg-white/90 p-1" />
                          : <StoreIcon className="h-8 w-8" />)}
                        <div>
                          <h1 className="text-2xl font-bold">{companyName}</h1>
                          <p className="text-sm opacity-90 whitespace-pre-wrap">{companyAddress}</p>
                          {companyPhone && <p className="text-sm opacity-90">Tel: {companyPhone}</p>}
                          {companyWebsite && <p className="text-sm opacity-90">{companyWebsite}</p>}
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <h2 className="text-3xl font-bold tracking-wide">INVOICE</h2>
                        <p className="opacity-90"># {invoice.id}</p>
                      </div>
                    </div>
                  </div>
                )}
                {template !== 'modern' && (
                  <header className={`flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 ${template === 'minimal' ? 'border-b pb-6' : ''}`}>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        {showLogo && (themeSettings.logoUrl
                          ? <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={32} height={32} />
                          : template === 'classic' ? <StoreIcon className="h-8 w-8 text-primary" /> : null)}
                        <h1 className={template === 'minimal' ? 'text-xl font-semibold tracking-tight' : 'text-2xl font-bold'}>{companyName}</h1>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap">{companyAddress}</p>
                      {companyPhone && <p className="text-muted-foreground">Tel: {companyPhone}</p>}
                      {companyWebsite && <p className="text-muted-foreground">{companyWebsite}</p>}
                    </div>
                    <div className="sm:text-right">
                      <h2 className={template === 'minimal' ? 'text-2xl font-light tracking-[0.3em] text-gray-500' : 'text-3xl font-bold text-gray-800'}>INVOICE</h2>
                      <p className="text-muted-foreground"># {invoice.id}</p>
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
                    <div className="sm:text-right space-y-1">
                        <div className="flex sm:justify-end gap-2">
                            <span className="font-semibold">Invoice Date:</span>
                            <span>{formatDateUK(invoice.date)}</span>
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
                </section>

                {invoice.customData && Object.keys(invoice.customData).length > 0 && (
                    <section className="mb-8">
                        <CustomFieldsDisplay entity="invoice" value={invoice.customData} />
                    </section>
                )}

                <section className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className={template === 'minimal' ? 'border-b-2 border-black hover:bg-transparent' : 'bg-muted/50'}
                              style={template === 'modern' ? { backgroundColor: `${accent}14` } : undefined}>
                                <TableHead className="w-[60px]">#</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center">Qty</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.items.map((item, index) => (
                                <TableRow key={`invoice-item-${index}`}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{currencySymbol} {item.price.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{currencySymbol} {mulMoney(item.price, item.quantity).toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>

                <section className="flex justify-end mt-8">
                    <div className="w-full max-w-xs space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span className="font-medium">{currencySymbol} {subtotal.toFixed(2)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount ({invoice.discount || 0}%):</span>
                            <span className="font-medium text-destructive">-{currencySymbol} {discountAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax ({invoice.taxRate || 0}%):</span>
                            <span className="font-medium">{currencySymbol} {taxAmount.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg" style={template === 'modern' ? { color: accent } : undefined}>
                            <span>Total:</span>
                            <span>{currencySymbol} {invoice.amount.toFixed(2)}</span>
                        </div>
                    </div>
                </section>

                <footer className={`mt-16 text-center text-sm ${template === 'minimal' ? 'border-t pt-4 text-gray-400' : 'text-muted-foreground'}`}>
                    <p className="whitespace-pre-wrap">{footerText}</p>
                </footer>
              </div>
            )}
            <Footer className="non-printable p-4 border-t flex flex-col sm:flex-row gap-2">
                 <Button onClick={handleEmailReceipt} variant="outline" className="w-full" disabled={sending}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    {sending ? 'Sending…' : 'Email Invoice'}
                </Button>
                <Button onClick={handlePrint} variant="outline" className="w-full">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Invoice
                </Button>
            </Footer>
        </Wrapper>
    );
};

export default FullInvoice;
