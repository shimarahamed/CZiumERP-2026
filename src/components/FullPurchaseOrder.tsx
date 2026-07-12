
'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { PurchaseOrder } from '@/types';
import { Printer } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import { Store as StoreIcon } from '@/components/icons';
import Image from 'next/image';
import { formatNumber } from '@/lib/money';
import { cn } from '@/lib/utils';

interface FullPurchaseOrderProps {
    purchaseOrder: PurchaseOrder;
}

const FullPurchaseOrder = ({ purchaseOrder }: FullPurchaseOrderProps) => {
    const { companyName, companyAddress, currencySymbol, vendors, themeSettings } = useAppContext();

    const handlePrint = () => {
        window.print();
    };

    const vendor = vendors.find(v => v.id === purchaseOrder.vendorId);

    // Purchase orders have their own template setting; 'thermal-receipt' makes
    // no sense on an A4 PO, so it falls through to classic.
    const savedTemplate = themeSettings.purchaseOrderTemplate;
    const template = savedTemplate && savedTemplate !== 'thermal-receipt' ? savedTemplate : 'classic';
    const showLogo = themeSettings.showLogoOnDocuments !== false;
    const accent = themeSettings.documentAccent || '#1f2937';
    const companyPhone = themeSettings.companyPhone?.trim();
    const companyWebsite = themeSettings.companyWebsite?.trim();
    const companyEmail = themeSettings.companyEmail?.trim();
    const regNumber = themeSettings.companyRegNumber?.trim();
    const letterheadImage = themeSettings.letterheadImageUrl;
    const letterheadWording = themeSettings.letterheadText?.trim();
    const watermarkSrc = themeSettings.letterheadWatermark !== false
        ? (themeSettings.logoUrl || letterheadImage)
        : undefined;

    const orderMeta = (
        <>
            <div className="flex justify-between gap-2"><span className="font-semibold">Order Date:</span><span>{new Date(purchaseOrder.orderDate).toLocaleDateString()}</span></div>
            {purchaseOrder.expectedDeliveryDate && (
                <div className="flex justify-between gap-2"><span className="font-semibold">Expected:</span><span>{new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}</span></div>
            )}
            <div className="flex justify-between gap-2"><span className="font-semibold">Status:</span><span className="capitalize font-medium">{purchaseOrder.status}</span></div>
        </>
    );

    const vendorBlock = (
        <div>
            <h3 className="font-semibold mb-1">Vendor:</h3>
            <p>{purchaseOrder.vendorName}</p>
            {vendor && (
                <>
                    <p className="text-muted-foreground">{vendor.contactPerson}</p>
                    <p className="text-muted-foreground">{vendor.email}</p>
                    <p className="text-muted-foreground">{vendor.phone}</p>
                </>
            )}
        </div>
    );

    const itemsTable = template === 'lined' ? (
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="border-b border-gray-400 bg-black/5">
                    <th className="border-r border-gray-400 p-2 w-10 text-left font-semibold">#</th>
                    <th className="border-r border-gray-400 p-2 text-left font-semibold">Item</th>
                    <th className="border-r border-gray-400 p-2 w-20 text-center font-semibold">Qty</th>
                    <th className="border-r border-gray-400 p-2 w-32 text-right font-semibold whitespace-nowrap">Unit Cost ({currencySymbol})</th>
                    <th className="p-2 w-32 text-right font-semibold whitespace-nowrap">Total ({currencySymbol})</th>
                </tr>
            </thead>
            <tbody>
                {purchaseOrder.items.map((item, index) => (
                    <tr key={`po-item-${index}`}>
                        <td className="border-r border-gray-400 p-1.5">{index + 1}</td>
                        <td className="border-r border-gray-400 p-1.5 font-medium">{item.productName}</td>
                        <td className="border-r border-gray-400 p-1.5 text-center">{item.quantity}</td>
                        <td className="border-r border-gray-400 p-1.5 text-right whitespace-nowrap">{formatNumber(item.cost)}</td>
                        <td className="p-1.5 text-right whitespace-nowrap">{formatNumber(item.cost * item.quantity)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    ) : (
        <Table className="text-sm">
            <TableHeader>
                <TableRow className="bg-muted/50" style={template === 'modern' ? { backgroundColor: `${accent}14` } : undefined}>
                    <TableHead className="h-8 py-1">Item</TableHead>
                    <TableHead className="h-8 py-1 text-center">Quantity</TableHead>
                    <TableHead className="h-8 py-1 text-right">Unit Cost ({currencySymbol})</TableHead>
                    <TableHead className="h-8 py-1 text-right">Total ({currencySymbol})</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {purchaseOrder.items.map((item, index) => (
                    <TableRow key={`po-item-${index}`}>
                        <TableCell className="py-1.5 font-medium">{item.productName}</TableCell>
                        <TableCell className="py-1.5 text-center">{item.quantity}</TableCell>
                        <TableCell className="py-1.5 text-right">{formatNumber(item.cost)}</TableCell>
                        <TableCell className="py-1.5 text-right">{formatNumber(item.cost * item.quantity)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    const totalsBlock = (
        <div className="w-full max-w-xs space-y-2">
            <Separator />
            <div className="flex justify-between font-bold text-lg" style={template === 'modern' ? { color: accent } : undefined}>
                <span>Total Order Cost:</span>
                <span>{currencySymbol} {formatNumber(purchaseOrder.totalCost)}</span>
            </div>
        </div>
    );

    const docFooter = (
        <footer className={cn('text-center text-muted-foreground text-sm', template === 'letterhead' ? 'mt-8' : 'mt-16')}>
            <p>Generated by {themeSettings.appName}</p>
        </footer>
    );

    return (
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 gap-0 printable-area-container flex flex-col">
            <DialogHeader className="sr-only">
              <DialogTitle>Purchase Order {purchaseOrder.id}</DialogTitle>
            </DialogHeader>
            {template === 'lined' ? (
              /* ---- Lined: outer box + ruled inner boxes, matching the lined invoice ---- */
              <div className="printable-area force-light-doc bg-white text-black p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
                <div className="border border-gray-400">
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
                      <h2 className="text-2xl font-bold tracking-wide mb-1"># {purchaseOrder.id}</h2>
                      <p className="text-lg font-semibold text-muted-foreground mb-2">PURCHASE ORDER</p>
                      <div className="text-sm space-y-1">{orderMeta}</div>
                    </div>
                  </div>
                  <div className="p-4 border-b border-gray-400 text-sm">{vendorBlock}</div>
                  {itemsTable}
                  <div className="border-b border-gray-400" />
                  <div className="flex justify-end"><div className="p-4">{totalsBlock}</div></div>
                </div>
                {docFooter}
              </div>
            ) : (
              /* ---- Classic / Modern / Letterhead ---- */
              <div className={cn('printable-area force-light-doc bg-white text-black overflow-y-auto flex-1 min-h-0', template === 'letterhead' ? 'relative p-4 sm:p-6' : 'p-4 sm:p-8')}>
                {template === 'letterhead' && watermarkSrc && (
                  /* `absolute` (not `fixed`) so it stays anchored to this scrollable
                     printable-area instead of the browser viewport — `fixed` made it
                     overflow outside the dialog/print bounds. Sized in fixed px (not a
                     % of the container) because at print time `.printable-area`'s height
                     is the FULL multi-page document, so a percentage height would blow up
                     to many times a single A4 page and get clipped by the page edge. */
                  <Image src={watermarkSrc} alt="" aria-hidden width={600} height={600}
                    className="letterhead-watermark pointer-events-none absolute left-0 right-0 top-[75%] -translate-y-1/2 mx-auto w-[60%] max-w-[420px] max-h-[420px] object-contain opacity-[0.05]" />
                )}
                {template === 'letterhead' && (
                  <header className="mb-6">
                    {/* Company logo with the big header artwork/wordings right beside
                        it on the left, company details on the right of the page.
                        Uploaded artwork carries the branding, so the company name
                        text is dropped to avoid saying it twice. */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b-2" style={{ borderColor: accent }}>
                      {/* flex-1 + w-full: the artwork stretches across all the space
                          left between the logo and the details column, with just the
                          gap as breathing room. */}
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        {showLogo && (themeSettings.logoUrl
                          ? <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={72} height={72} className="rounded-lg object-contain shrink-0" />
                          : <StoreIcon className="h-8 w-8 text-primary shrink-0" />)}
                        {letterheadImage ? (
                          <Image src={letterheadImage} alt={companyName || 'Letterhead'} width={600} height={160} className="w-full max-h-16 object-contain object-left" />
                        ) : letterheadWording ? (
                          <h1 className="text-3xl font-bold tracking-wide" style={{ color: accent }}>{letterheadWording}</h1>
                        ) : (
                          <h1 className="text-2xl font-bold">{companyName}</h1>
                        )}
                      </div>
                      <div className="sm:text-right text-xs leading-5 shrink-0">
                        {companyAddress && <p className="whitespace-pre-wrap">{companyAddress}</p>}
                        {companyPhone && <p>Tel: {companyPhone}</p>}
                        {companyEmail && <p>Email: {companyEmail}</p>}
                        {companyWebsite && <p>{companyWebsite}</p>}
                        {regNumber && <p>Reg No: {regNumber}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1 mt-3">
                      <h2 className="text-xl font-bold tracking-wide">PURCHASE ORDER <span className="font-normal text-muted-foreground"># {purchaseOrder.id}</span></h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        <span><span className="font-semibold">Order Date:</span> {new Date(purchaseOrder.orderDate).toLocaleDateString()}</span>
                        {purchaseOrder.expectedDeliveryDate && <span><span className="font-semibold">Expected:</span> {new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}</span>}
                        <span className="capitalize"><span className="font-semibold">Status:</span> {purchaseOrder.status}</span>
                      </div>
                    </div>
                  </header>
                )}
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
                        <h2 className="text-3xl font-bold tracking-wide">PURCHASE ORDER</h2>
                        <p className="opacity-90"># {purchaseOrder.id}</p>
                        <div className="mt-2 text-sm space-y-0.5 opacity-90">{orderMeta}</div>
                      </div>
                    </div>
                  </div>
                )}
                {template !== 'modern' && template !== 'letterhead' && (
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
                      <h2 className="text-3xl font-bold text-gray-800">PURCHASE ORDER</h2>
                      <p className="text-muted-foreground"># {purchaseOrder.id}</p>
                      <div className="mt-2 text-sm space-y-1">{orderMeta}</div>
                    </div>
                  </header>
                )}

                <section className={cn('flex flex-col sm:flex-row justify-between gap-4', template === 'letterhead' ? 'mb-5 text-sm' : 'mb-8')}>
                    {vendorBlock}
                </section>

                <section className="overflow-x-auto">{itemsTable}</section>

                <section className="flex justify-end mt-6">{totalsBlock}</section>

                {docFooter}
              </div>
            )}
            <DialogFooter className="non-printable p-4 border-t flex justify-center shrink-0">
                <Button onClick={handlePrint} variant="outline" className="w-full sm:w-auto">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Purchase Order
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default FullPurchaseOrder;
