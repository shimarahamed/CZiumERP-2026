
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

interface FullPurchaseOrderProps {
    purchaseOrder: PurchaseOrder;
}

const FullPurchaseOrder = ({ purchaseOrder }: FullPurchaseOrderProps) => {
    const { companyName, companyAddress, currencySymbol, vendors, themeSettings } = useAppContext();
    
    const handlePrint = () => {
        window.print();
    };

    const vendor = vendors.find(v => v.id === purchaseOrder.vendorId);

    return (
        <DialogContent className="sm:max-w-4xl p-0 printable-area-container">
            <DialogHeader className="sr-only">
              <DialogTitle>Purchase Order {purchaseOrder.id}</DialogTitle>
            </DialogHeader>
            <div className="printable-area bg-white text-black p-8">
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             {themeSettings.logoUrl ? (
                                <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={32} height={32} />
                            ) : (
                                <StoreIcon className="h-8 w-8 text-primary" />
                            )}
                            <h1 className="text-2xl font-bold">{companyName}</h1>
                        </div>
                        <p className="text-muted-foreground">{companyAddress}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-3xl font-bold text-gray-800">PURCHASE ORDER</h2>
                        <p className="text-muted-foreground"># {purchaseOrder.id}</p>
                    </div>
                </header>
                
                <section className="flex justify-between mb-8">
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
                    <div className="text-right">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="font-semibold">Order Date:</span>
                            <span>{new Date(purchaseOrder.orderDate).toLocaleDateString()}</span>
                             {purchaseOrder.expectedDeliveryDate && (
                                <>
                                    <span className="font-semibold">Expected Delivery:</span>
                                    <span>{new Date(purchaseOrder.expectedDeliveryDate).toLocaleDateString()}</span>
                                </>
                             )}
                            <span className="font-semibold">Status:</span>
                            <span className="capitalize font-medium">{purchaseOrder.status}</span>
                        </div>
                    </div>
                </section>

                <section>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center">Quantity</TableHead>
                                <TableHead className="text-right">Unit Cost</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {purchaseOrder.items.map((item, index) => (
                                <TableRow key={`po-item-${index}`}>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{currencySymbol} {formatNumber(item.cost)}</TableCell>
                                    <TableCell className="text-right">{currencySymbol} {formatNumber(item.cost * item.quantity)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>

                <section className="flex justify-end mt-8">
                    <div className="w-full max-w-xs space-y-2">
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total Order Cost:</span>
                            <span>{currencySymbol} {formatNumber(purchaseOrder.totalCost)}</span>
                        </div>
                    </div>
                </section>

                <footer className="mt-16 text-center text-muted-foreground text-sm">
                    <p>Generated by {themeSettings.appName}</p>
                </footer>
            </div>
            <DialogFooter className="non-printable p-4 border-t flex justify-center">
                <Button onClick={handlePrint} variant="outline" className="w-full sm:w-auto">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Purchase Order
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default FullPurchaseOrder;
