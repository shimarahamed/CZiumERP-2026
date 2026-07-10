
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Invoice, EmailLog } from '@/types';
import { Printer, Mail, Loader2 } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Store as StoreIcon } from '@/components/icons';
import Image from 'next/image';
import { isSmtpConfigured, sendTenantEmail, emailShell, escapeHtml } from '@/lib/email';
import { CustomFieldsDisplay } from '@/components/custom-fields/CustomFields';
import { formatDateUK, formatTimeUK } from '@/lib/date-format';

interface InvoiceDetailProps {
    invoice: Invoice;
    /** When true, render as a plain block (for side-by-side embedding) instead of a DialogContent. */
    embedded?: boolean;
}

const InvoiceDetail = ({ invoice, embedded = false }: InvoiceDetailProps) => {
    const { companyName, companyAddress, currencySymbol, customersMap, themeSettings, smtpConfigList, setEmailLogs, user } = useAppContext();
    const { toast } = useToast();
    const [sending, setSending] = useState(false);

    const handlePrint = () => {
        document.body.classList.add('printing-invoice');
        if (embedded) document.body.classList.add('print-only-receipt');
        window.print();
        document.body.classList.remove('printing-invoice');
        document.body.classList.remove('print-only-receipt');
    };

    const Wrapper = embedded ? 'div' : DialogContent;
    const Footer = embedded ? 'div' : DialogFooter;
    const wrapperProps = embedded
        ? { className: 'printable-area-container border rounded-lg overflow-hidden bg-white', 'data-print-target': 'receipt' as const }
        : { className: 'sm:max-w-sm p-0 printable-area-container', 'data-print-target': 'receipt' as const };

    const subtotal = invoice.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const discountAmount = subtotal * ((invoice.discount || 0) / 100);
    const taxAmount = (subtotal - discountAmount) * ((invoice.taxRate || 0) / 100);

    const generateTextReceipt = () => {
      let receipt = `RECEIPT from ${companyName}\n`;
      receipt += `Invoice ID: ${invoice.id}\n`;
      receipt += `Date: ${new Date(invoice.date).toLocaleString()}\n\n`;
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
      const customer = invoice.customerId ? customersMap.get(invoice.customerId) : undefined;
      if (!customer?.email) {
          toast({
              variant: 'destructive',
              title: 'Cannot Email Receipt',
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

      const subject = `Your Receipt from ${companyName} (#${invoice.id})`;
      const text = generateTextReceipt();
      const html = emailShell(companyName || '', 'Receipt', `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text)}</pre>`);

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
        toast({ title: 'Receipt emailed', description: `Sent to ${customer.email}.` });
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

    return (
        <Wrapper {...wrapperProps}>
            {!embedded && (
                <DialogHeader className="sr-only">
                  <DialogTitle>Invoice Receipt for {invoice.id}</DialogTitle>
                </DialogHeader>
            )}
            <div className="printable-area receipt force-light-doc bg-white text-black p-4">
                <div className="text-center mb-4">
                    {themeSettings.logoUrl ? (
                        <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={40} height={40} className="mx-auto mb-2"/>
                    ) : (
                        <StoreIcon className="mx-auto h-10 w-10 mb-2" />
                    )}
                    <h2 className="text-lg font-bold">{companyName}</h2>
                    <p>{companyAddress}</p>
                    {themeSettings.companyPhone?.trim() && <p>Tel: {themeSettings.companyPhone.trim()}</p>}
                    {themeSettings.companyWebsite?.trim() && <p>{themeSettings.companyWebsite.trim()}</p>}
                </div>
                <div className="border-t border-dashed my-2"></div>
                <div className="flex justify-between">
                    <span>Invoice #:</span>
                    <span>{invoice.id}</span>
                </div>
                <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{formatDateUK(invoice.date)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Time:</span>
                    <span>{formatTimeUK(invoice.createdAt ?? invoice.date)}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="capitalize">{invoice.status}</span>
                </div>
                {invoice.paymentMethod && (
                    <div className="flex justify-between">
                        <span>Payment:</span>
                        <span className="capitalize">{invoice.paymentMethod}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="truncate">{invoice.customerName || 'Walk-in Customer'}</span>
                </div>
                {invoice.customerPhone && (
                    <div className="flex justify-between mb-2">
                        <span>Phone:</span>
                        <span className="truncate">{invoice.customerPhone}</span>
                    </div>
                )}
                {invoice.customData && Object.keys(invoice.customData).length > 0 && (
                    <>
                        <div className="border-t border-dashed my-2"></div>
                        <CustomFieldsDisplay entity="invoice" value={invoice.customData} />
                    </>
                )}
                <div className="border-t border-dashed my-2"></div>

                <div>
                    <div className="flex font-bold">
                        <div className="flex-1">Item</div>
                        <div className="w-8 text-center">Qty</div>
                        <div className="w-16 text-right">Price</div>
                        <div className="w-16 text-right">Total</div>
                    </div>
                    <div className="border-b border-dashed my-1"></div>
                    {invoice.items.map((item, index) => (
                         <div key={`detail-item-${index}`} className="flex my-1">
                            <div className="flex-1 w-0 truncate pr-1">{item.productName}</div>
                            <div className="w-8 shrink-0 text-center">{item.quantity}</div>
                            <div className="w-16 shrink-0 text-right break-words">{currencySymbol} {item.price.toFixed(2)}</div>
                            <div className="w-16 shrink-0 text-right break-words">{currencySymbol} {(item.quantity * item.price).toFixed(2)}</div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-dashed my-2"></div>
                
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{currencySymbol} {subtotal.toFixed(2)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Discount ({invoice.discount || 0}%)</span>
                        <span>-{currencySymbol} {discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Taxes ({invoice.taxRate || 0}%)</span>
                        <span>{currencySymbol} {taxAmount.toFixed(2)}</span>
                    </div>
                </div>

                <div className="border-t-2 border-dashed my-2"></div>

                <div className="flex justify-between font-bold text-base">
                    <span>TOTAL</span>
                    <span>{currencySymbol} {invoice.amount.toFixed(2)}</span>
                </div>

                <div className="text-center mt-6">
                    Thank you for your business!
                </div>
            </div>
            <Footer className="non-printable p-4 border-t flex flex-col sm:flex-row gap-2">
                 <Button onClick={handleEmailReceipt} variant="outline" className="w-full" disabled={sending}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    {sending ? 'Sending…' : 'Email Receipt'}
                </Button>
                <Button onClick={handlePrint} variant="outline" className="w-full">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                </Button>
            </Footer>
        </Wrapper>
    );
};

export default InvoiceDetail;

    