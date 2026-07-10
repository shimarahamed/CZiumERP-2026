
'use client';

import React from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Product } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';

interface ProductDetailProps {
    product: Product;
}

const ProductDetail = ({ product }: ProductDetailProps) => {
    const { currencySymbol, vendorsMap, purchaseOrders, lots, serialUnits, warehouses } = useAppContext();
    const vendor = product.vendorId ? vendorsMap.get(product.vendorId) : undefined;
    const productPurchaseHistory = purchaseOrders.filter(po =>
        po.status === 'received' && po.items.some(item => item.productId === product.id)
    );
    const productLots = product.trackingMode === 'lot'
        ? lots.filter(l => l.productId === product.id && !l.deletedAt && l.quantity > 0)
        : [];
    const productSerials = product.trackingMode === 'serial'
        ? serialUnits.filter(s => s.productId === product.id)
        : [];
    const warehouseName = (id: string) => warehouses.find(w => w.id === id)?.name ?? id;

    const DetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
        <div className="flex flex-col">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="text-sm capitalize">{value || 'N/A'}</dd>
        </div>
    );

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>{product.description || 'No description available.'}</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto px-1">
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                    <DetailItem label="SKU" value={product.sku} />
                    <DetailItem label="Category" value={product.category} />
                    <DetailItem label="Product Type" value={product.productType?.replace('-', ' ')} />
                    <DetailItem label="Default Vendor" value={vendor?.name} />
                    <DetailItem label="Price" value={`${currencySymbol} ${product.price.toFixed(2)}`} />
                    <DetailItem label="Cost" value={`${currencySymbol} ${product.cost.toFixed(2)}`} />
                    <DetailItem label="Stock Quantity" value={product.stock} />
                    <DetailItem label="Reorder Threshold" value={product.reorderThreshold} />
                    <DetailItem label="Expiry Date" value={product.expiryDate ? format(parseISO(product.expiryDate), 'PPP') : 'N/A'} />
                    <DetailItem label="Warranty Date" value={product.warrantyDate ? format(parseISO(product.warrantyDate), 'PPP') : 'N/A'} />
                </dl>
                
                {productLots.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Lots</h3>
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Lot #</TableHead>
                                                <TableHead>Warehouse</TableHead>
                                                <TableHead>Expiry</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {productLots
                                                .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))
                                                .map(lot => (
                                                    <TableRow key={lot.id}>
                                                        <TableCell>{lot.lotNumber}</TableCell>
                                                        <TableCell>{warehouseName(lot.warehouseId)}</TableCell>
                                                        <TableCell>{lot.expiryDate ? format(parseISO(lot.expiryDate), 'PPP') : 'N/A'}</TableCell>
                                                        <TableCell className="text-right">{lot.quantity}</TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}

                {productSerials.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Serial Numbers</h3>
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Serial #</TableHead>
                                                <TableHead>Warehouse</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Invoice</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {productSerials
                                                .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
                                                .map(unit => (
                                                    <TableRow key={unit.id}>
                                                        <TableCell>{unit.serialNumber}</TableCell>
                                                        <TableCell>{warehouseName(unit.warehouseId)}</TableCell>
                                                        <TableCell className="capitalize">{unit.status}</TableCell>
                                                        <TableCell>{unit.invoiceId ?? 'N/A'}</TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}

                <Separator />

                {productPurchaseHistory.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium">Purchase History</h3>
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>PO ID</TableHead>
                                            <TableHead>Vendor</TableHead>
                                            <TableHead>Date Received</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {productPurchaseHistory.map(po => {
                                            const item = po.items.find(i => i.productId === product.id)!;
                                            return (
                                                <TableRow key={po.id}>
                                                    <TableCell>{po.id}</TableCell>
                                                    <TableCell>{po.vendorName}</TableCell>
                                                    <TableCell>{po.receivedDate ? format(parseISO(po.receivedDate), 'PPP') : 'N/A'}</TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">{currencySymbol} {item.cost.toFixed(2)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </DialogContent>
    );
};

export default ProductDetail;

    