
'use client';

import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Invoice, EmailLog } from '@/types';
import { Printer, Mail, Loader2, MessageSquare, Send, Download } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Store as StoreIcon } from '@/components/icons';
import Image from 'next/image';
import { sendTenantEmail, emailShell, escapeHtml, isSmtpConfigured } from '@/lib/email';
import { sendTenantSms, sendTenantWhatsapp, sendAndLogMessage } from '@/lib/messaging';
import { nodeToPdfBase64 } from '@/lib/invoice-pdf';
import { downloadReceiptDocumentPdf } from '@/lib/native-document-pdf';
import { CustomFieldsDisplay } from '@/components/custom-fields/CustomFields';
import { formatDateUK, formatTimeUK } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import { formatNumber, lineTotal, mulMoney, addMoney, percentOf } from '@/lib/money';

interface InvoiceDetailProps {
    invoice: Invoice;
    /** When true, render as a plain block (for side-by-side embedding) instead of a DialogContent. */
    embedded?: boolean;
}

const InvoiceDetail = ({ invoice, embedded = false }: InvoiceDetailProps) => {
    const {
        companyName, companyAddress, currencySymbol, customersMap, themeSettings,
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

    const handlePrint = () => {
        document.body.classList.add('printing-invoice');
        if (embedded) document.body.classList.add('print-only-receipt');
        window.print();
        document.body.classList.remove('printing-invoice');
        document.body.classList.remove('print-only-receipt');
    };

    const handleDownload = async () => {
        if (!printableRef.current || downloading) return;
        setDownloading(true);
        try {
            await downloadReceiptDocumentPdf(invoice, { companyName, companyAddress, currencySymbol, themeSettings });
            toast({ title: 'Receipt downloaded', description: `Receipt ${invoice.id} was saved as a PDF.` });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Could not download PDF', description: err instanceof Error ? err.message : 'Download failed.' });
        } finally {
            setDownloading(false);
        }
    };

    const Wrapper = embedded ? 'div' : DialogContent;
    const Footer = embedded ? 'div' : DialogFooter;
    // Embedded (post-create preview): fixed-height card with its own scroll region,
    // so the Print/Email action row stays pinned at the bottom instead of scrolling
    // away with the document content.
    const wrapperProps = embedded
        ? { className: 'printable-area-container border rounded-lg overflow-hidden bg-white flex flex-col h-full', 'data-print-target': 'receipt' as const }
        : { className: 'sm:max-w-sm max-h-[90vh] p-0 gap-0 printable-area-container flex flex-col', 'data-print-target': 'receipt' as const };

    // Subtotal is the GROSS amount (before any discount); Discount combines every
    // item's own discount plus the invoice-level %, matching the full invoice.
    const grossSubtotal = invoice.items.reduce((acc, item) => acc + mulMoney(item.price, item.quantity), 0);
    const netLines = invoice.items.reduce((acc, item) => acc + lineTotal(item.price, item.quantity, item.discount, item.discountType), 0);
    const itemDiscountsTotal = addMoney(grossSubtotal, -netLines);
    const invoiceDiscountAmount = percentOf(netLines, invoice.discount || 0);
    const discountAmount = addMoney(itemDiscountsTotal, invoiceDiscountAmount);
    const taxAmount = percentOf(addMoney(netLines, -invoiceDiscountAmount), invoice.taxRate || 0);
    const regNumber = themeSettings.companyRegNumber?.trim();
    // Letterhead receipt: the uploaded header artwork replaces the company name
    // (logo stays as-is above it), with a faint logo watermark behind the slip.
    const isLetterhead = themeSettings.receiptTemplate === 'letterhead';
    const letterheadImage = themeSettings.letterheadImageUrl;
    const letterheadWording = themeSettings.letterheadText?.trim();
    const companyEmail = themeSettings.companyEmail?.trim();
    const watermarkSrc = isLetterhead && themeSettings.letterheadWatermark !== false
        ? (themeSettings.logoUrl || letterheadImage)
        : undefined;

    const generateTextReceipt = () => {
      let receipt = `RECEIPT from ${companyName}\n`;
      if (regNumber) receipt += `Reg No: ${regNumber}\n`;
      receipt += `Invoice ID: ${invoice.id}\n`;
      receipt += `Date: ${new Date(invoice.date).toLocaleString()}\n\n`;
      receipt += `Items:\n`;
      invoice.items.forEach(item => {
        const discLabel = item.discountType === 'amount' ? `${currencySymbol} ${formatNumber(item.discount ?? 0)}` : `${item.discount}%`;
        const disc = (item.discount ?? 0) > 0 ? ` -${discLabel}` : '';
        const qty = `${item.quantity} ${item.unit || 'Pcs'}`;
        receipt += `- ${item.productName} (x${qty}) @ ${currencySymbol} ${formatNumber(item.price)}${disc} = ${currencySymbol} ${formatNumber(lineTotal(item.price, item.quantity, item.discount, item.discountType))}\n`;
      });
      receipt += `\nSubtotal: ${currencySymbol} ${formatNumber(grossSubtotal)}\n`;
      if (discountAmount > 0) {
        receipt += `Discount${invoice.discount ? ` (incl. ${invoice.discount}%)` : ''}: -${currencySymbol} ${formatNumber(discountAmount)}\n`;
      }
      if (invoice.taxRate) {
        receipt += `Tax (${invoice.taxRate}%): +${currencySymbol} ${formatNumber(taxAmount)}\n`;
      }
      receipt += `TOTAL: ${currencySymbol} ${formatNumber(invoice.amount)}\n\n`;
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
      const subject = `Your Receipt from ${companyName} (#${invoice.id})`;
      const text = generateTextReceipt();
      const html = emailShell(companyName || '', 'Receipt', `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text)}</pre>`);

      setSending(true);
      try {
        const attachments = printableRef.current
          ? [await nodeToPdfBase64(printableRef.current, `Receipt-${invoice.id}.pdf`, { kind: 'receipt' })]
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

    const handleSendWhatsapp = async () => {
      const customer = invoice.customerId ? customersMap.get(invoice.customerId) : undefined;
      const to = invoice.customerPhone || customer?.phone;
      if (!to) {
        toast({ variant: 'destructive', title: 'Cannot Send WhatsApp', description: 'No phone number is associated with this customer.' });
        return;
      }
      setSendingWhatsapp(true);
      try {
        const pdf = printableRef.current ? await nodeToPdfBase64(printableRef.current, `Receipt-${invoice.id}.pdf`, { kind: 'receipt' }) : undefined;
        const text = `Your receipt ${invoice.id} from ${companyName} — total ${currencySymbol} ${formatNumber(invoice.amount)}.`;
        await sendAndLogMessage(
          { setMessageLogs }, 'whatsapp', 'Sales & Customers', 'invoice-manual-send', to, text, user?.name ?? 'system',
          () => sendTenantWhatsapp({ to, text, pdf })
        );
        toast({ title: 'Receipt sent on WhatsApp', description: `Sent to ${to}.` });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Could not send WhatsApp message', description: err instanceof Error ? err.message : 'Send failed.' });
      } finally {
        setSendingWhatsapp(false);
      }
    };

    const handleSendSms = async () => {
      const customer = invoice.customerId ? customersMap.get(invoice.customerId) : undefined;
      const to = invoice.customerPhone || customer?.phone;
      if (!to) {
        toast({ variant: 'destructive', title: 'Cannot Send SMS', description: 'No phone number is associated with this customer.' });
        return;
      }
      setSendingSms(true);
      try {
        const text = `Your receipt ${invoice.id} from ${companyName} — total ${currencySymbol} ${formatNumber(invoice.amount)}.`;
        await sendAndLogMessage(
          { setMessageLogs }, 'sms', 'Sales & Customers', 'invoice-manual-send', to, text, user?.name ?? 'system',
          () => sendTenantSms({ to, text })
        );
        toast({ title: 'Receipt SMS sent', description: `Sent to ${to}.` });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Could not send SMS', description: err instanceof Error ? err.message : 'Send failed.' });
      } finally {
        setSendingSms(false);
      }
    };

    return (
        <Wrapper {...wrapperProps}>
            {!embedded && (
                <DialogHeader className="sr-only">
                  <DialogTitle>Invoice Receipt for {invoice.id}</DialogTitle>
                </DialogHeader>
            )}
            <div ref={printableRef} className={cn('printable-area receipt force-light-doc bg-white text-black p-4 overflow-y-auto flex-1 min-h-0', isLetterhead && 'relative')}>
                {watermarkSrc && (
                    <Image src={watermarkSrc} alt="" aria-hidden width={300} height={300}
                        className="pointer-events-none absolute inset-0 m-auto w-[45%] max-h-[40%] object-contain opacity-[0.05]" />
                )}
                <div className="text-center mb-4">
                    {isLetterhead && (letterheadImage || letterheadWording) ? (
                        /* Letterhead: logo on the left, header artwork/wordings on the
                           right, both centered as a group at the top of the slip. */
                        <div className="flex items-center justify-center gap-3 mb-2">
                            {themeSettings.logoUrl ? (
                                <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={40} height={40} className="shrink-0" />
                            ) : (
                                <StoreIcon className="h-10 w-10 shrink-0" />
                            )}
                            {letterheadImage ? (
                                <Image src={letterheadImage} alt={companyName || 'Letterhead'} width={200} height={56} className="h-auto max-h-14 w-auto object-contain" />
                            ) : (
                                <h2 className="text-lg font-bold">{letterheadWording}</h2>
                            )}
                        </div>
                    ) : (
                        themeSettings.logoUrl ? (
                            <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={40} height={40} className="mx-auto mb-2"/>
                        ) : (
                            <StoreIcon className="mx-auto h-10 w-10 mb-2" />
                        )
                    )}
                    {!(isLetterhead && (letterheadImage || letterheadWording)) && <h2 className="text-lg font-bold">{companyName}</h2>}
                    <p>{companyAddress}</p>
                    {themeSettings.companyPhone?.trim() && <p>{isLetterhead ? '' : ''}{themeSettings.companyPhone.trim()}</p>}
                    {isLetterhead && companyEmail && <p>Email: {companyEmail}</p>}
                    {themeSettings.companyWebsite?.trim() && <p>{themeSettings.companyWebsite.trim()}</p>}
                    {regNumber && <p>Reg No: {regNumber}</p>}
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
                {invoice.notes && (
                    <div className="mb-2">
                        <span className="block">Note:</span>
                        <span className="block whitespace-pre-wrap text-muted-foreground">{invoice.notes}</span>
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
                        <div className="w-12 text-center">Qty</div>
                        <div className="w-16 text-right">Price ({currencySymbol})</div>
                        <div className="w-16 text-right">Total ({currencySymbol})</div>
                    </div>
                    <div className="border-b border-dashed my-1"></div>
                    {invoice.items.map((item, index) => (
                         <div key={`detail-item-${index}`} className="my-1">
                            <div className="flex">
                                <div className="flex-1 w-0 truncate pr-1">{item.productName}</div>
                                <div className="w-12 shrink-0 text-center">{item.quantity} {item.unit || 'Pcs'}</div>
                                <div className="w-16 shrink-0 text-right break-words">{formatNumber(item.price)}</div>
                                <div className="w-16 shrink-0 text-right break-words">{formatNumber(lineTotal(item.price, item.quantity, item.discount, item.discountType))}</div>
                            </div>
                            {(item.discount ?? 0) > 0 && (
                                <div className="text-[10px] text-muted-foreground pl-2">
                                    Includes {item.discountType === 'amount' ? `${currencySymbol} ${formatNumber(item.discount!)}` : `${item.discount}%`} item discount
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="border-t border-dashed my-2"></div>
                
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{currencySymbol} {formatNumber(grossSubtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                        <div className="flex justify-between">
                            <span>Discount{invoice.discount ? ` (incl. ${invoice.discount}%)` : ''}</span>
                            <span>-{currencySymbol} {formatNumber(discountAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span>Taxes ({invoice.taxRate || 0}%)</span>
                        <span>{currencySymbol} {formatNumber(taxAmount)}</span>
                    </div>
                </div>

                <div className="border-t-2 border-dashed my-2"></div>

                <div className="flex justify-between font-bold text-base">
                    <span>GRAND TOTAL</span>
                    <span>{currencySymbol} {formatNumber(invoice.amount)}</span>
                </div>

                <div className="text-center mt-6">
                    Thank you for your business!
                </div>
            </div>
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
                    <span className="truncate">{downloading ? 'Saving…' : 'Save PDF'}</span>
                </Button>
                <Button onClick={handlePrint} variant="outline" className="flex-1 min-w-0 px-2">
                    <Printer className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="truncate">Print</span>
                </Button>
            </Footer>
        </Wrapper>
    );
};

export default InvoiceDetail;

    
