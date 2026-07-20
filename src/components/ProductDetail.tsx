
'use client';

import React from 'react';
import Image from 'next/image';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Product } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { formatNumber, discountedUnitPrice } from '@/lib/money';
import { Package, Pencil, Copy } from '@/components/icons';
import { PRODUCT_ICONS, resolveIconName } from '@/lib/product-icon';

interface ProductDetailProps {
    product: Product;
    /** Open the edit form for this product (hidden when the viewer can't manage inventory). */
    onEdit?: () => void;
    /** Open the add form prefilled from this product, saved as a new product. */
    onDuplicate?: () => void;
}

const ProductDetail = ({ product, onEdit, onDuplicate }: ProductDetailProps) => {
    const { currencySymbol, vendorsMap, purchaseOrders, lots, serialUnits, warehouses, productsMap } = useAppContext();
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

    const FallbackIcon = PRODUCT_ICONS[resolveIconName(product.name, product.iconName)] ?? Package;
    const isService = product.kind === 'service';
    const linkedServices = !isService
        ? Array.from(productsMap.values())
            .filter(service => service.kind === 'service' && !service.deletedAt)
            .flatMap(service => {
                const link = service.serviceLinks?.find(item => item.productId === product.id);
                return link ? [{ service, quantity: link.quantity }] : [];
            })
            .sort((a, b) => a.service.name.localeCompare(b.service.name))
        : [];

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {product.name}
                    {isService && <Badge variant="outline">Service</Badge>}
                    {(product.discount ?? 0) > 0 && (
                        <Badge variant="secondary">
                            {product.discountType === 'amount' ? `${currencySymbol} ${formatNumber(product.discount!)} off` : `${product.discount}% off`}
                        </Badge>
                    )}
                </DialogTitle>
                <DialogDescription>{product.description || 'No description available.'}</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto py-4 space-y-6 px-1">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative h-40 w-40 shrink-0 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden mx-auto sm:mx-0">
                        {product.imageUrl ? (
                            <Image src={product.imageUrl} alt={product.name} fill sizes="160px" className="object-cover" unoptimized />
                        ) : (
                            <FallbackIcon className="h-14 w-14 text-muted-foreground" />
                        )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 flex-1 content-start">
                        <DetailItem label="Price" value={`${currencySymbol} ${formatNumber(product.price)}`} />
                        <DetailItem label="Cost" value={`${currencySymbol} ${formatNumber(product.cost)}`} />
                        <DetailItem label="Discount" value={(product.discount ?? 0) > 0
                            ? `${product.discountType === 'amount' ? `${currencySymbol} ${formatNumber(product.discount!)}` : `${product.discount}%`} off (final ${currencySymbol} ${formatNumber(discountedUnitPrice(product.price, product.discount, product.discountType))})`
                            : 'None'} />
                        <DetailItem label="Stock Quantity" value={isService ? '—' : product.stock} />
                    </dl>
                </div>
                <Separator />
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                    <DetailItem label="SKU" value={product.sku} />
                    <DetailItem label="Barcode" value={product.barcode} />
                    <DetailItem label="Category" value={product.category} />
                    <DetailItem label="Brand" value={product.brand} />
                    <DetailItem label="Unit of Measure" value={product.unitOfMeasure} />
                    <DetailItem label="Product Type" value={isService ? 'Service' : product.productType?.replace('-', ' ')} />
                    <DetailItem label="Stock Tracking" value={product.trackingMode && product.trackingMode !== 'none' ? product.trackingMode : 'None'} />
                    <DetailItem label="Bin Location" value={product.binLocation} />
                    <DetailItem label="Default Vendor" value={vendor?.name} />
                    <DetailItem label="Reorder Threshold" value={product.reorderThreshold} />
                    <DetailItem label="Expiry Date" value={product.expiryDate ? format(parseISO(product.expiryDate), 'PPP') : 'N/A'} />
                    <DetailItem label="Warranty Date" value={product.warrantyDate ? format(parseISO(product.warrantyDate), 'PPP') : 'N/A'} />
                    <DetailItem label="Added On" value={product.createdAt ? format(parseISO(product.createdAt), 'PPP') : 'N/A'} />
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

                {isService && (product.serviceLinks?.length ?? 0) > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Linked Products</h3>
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead className="text-right">Qty per Service</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {product.serviceLinks!.map(link => {
                                                const linked = productsMap.get(link.productId);
                                                return (
                                                    <TableRow key={link.productId}>
                                                        <TableCell>{linked?.name ?? 'Unknown product'}</TableCell>
                                                        <TableCell>{linked?.sku ?? 'N/A'}</TableCell>
                                                        <TableCell className="text-right">{link.quantity}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}

                {!isService && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Linked Services</h3>
                            {linkedServices.length > 0 ? (
                                <Card>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Service</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-right">Qty Used per Service</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {linkedServices.map(({ service, quantity }) => (
                                                    <TableRow key={service.id}>
                                                        <TableCell className="font-medium">{service.name}</TableCell>
                                                        <TableCell>{service.category || 'N/A'}</TableCell>
                                                        <TableCell className="text-right">{quantity}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            ) : (
                                <p className="text-sm text-muted-foreground">This product is not linked to any services.</p>
                            )}
                        </div>
                    </>
                )}

                {!isService && (product.stockHistory?.length ?? 0) > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Stock Addition History</h3>
                            <Card>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>User</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">Stock After</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {[...(product.stockHistory ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(entry => (
                                                <TableRow key={entry.id}>
                                                    <TableCell>{format(parseISO(entry.createdAt), 'PPp')}</TableCell>
                                                    <TableCell className="capitalize">{entry.source.replaceAll('-', ' ')}</TableCell>
                                                    <TableCell>{entry.userName || 'N/A'}</TableCell>
                                                    <TableCell className="text-right font-medium">{entry.quantity > 0 ? '+' : ''}{entry.quantity}</TableCell>
                                                    <TableCell className="text-right">{entry.newStock}</TableCell>
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
                                                    <TableCell className="text-right">{currencySymbol} {formatNumber(item.cost)}</TableCell>
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
            {(onEdit || onDuplicate) && (
                <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                    {onDuplicate && (
                        <Button variant="outline" onClick={onDuplicate}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </Button>
                    )}
                    {onEdit && (
                        <Button onClick={onEdit}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Product
                        </Button>
                    )}
                </DialogFooter>
            )}
        </DialogContent>
    );
};

export default ProductDetail;

    
