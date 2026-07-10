
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import Header from "@/components/Header";
import { PageSkeleton } from '@/components/PageSkeleton';
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import type { Invoice, Refund, InvoiceItem } from "@/types";
import { Undo2, Loader2 } from "@/components/icons";
import { db } from "@/lib/firebase";
import { runTransaction, doc } from "firebase/firestore";

const refundItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  price: z.number(),
  maxQuantity: z.number(),
  refundQuantity: z.coerce.number().int().min(0),
  selected: z.boolean(),
}).refine(data => data.refundQuantity <= data.maxQuantity, {
  message: "Cannot refund more than purchased.",
  path: ["refundQuantity"],
}).refine(data => !data.selected || data.refundQuantity > 0, {
  message: "Quantity must be at least 1.",
  path: ["refundQuantity"],
});

const returnSchema = z.object({
  invoiceId: z.string().min(1, "Please select an invoice."),
  reason: z.string().min(1, "A reason for the return is required."),
  items: z.array(refundItemSchema).min(1).refine(items => items.some(item => item.selected), {
    message: "You must select at least one item to refund.",
  }),
});

type ReturnFormData = z.infer<typeof returnSchema>;

export default function ReturnsPage() {
  usePageTitle('Returns');
    const {
        invoices, setInvoices,
        products, setProducts,
        refunds, setRefunds,
        addActivityLog,
        currentStore,
        currencySymbol,
        isDataLoaded,
        tenantId
    } = useAppContext();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    const form = useForm<ReturnFormData>({
        resolver: zodResolver(returnSchema),
        defaultValues: {
            invoiceId: '',
            reason: '',
            items: [],
        },
    });

    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "items"
    });
    
    const watchedItemsRaw = useWatch({
        control: form.control,
        name: 'items'
    });
    const watchedItems = useMemo(() => watchedItemsRaw || [], [watchedItemsRaw]);

    const paidInvoices = useMemo(() => 
        invoices.filter(inv => inv.storeId === currentStore?.id && (inv.status === 'paid' || inv.status === 'partially-refunded')),
        [invoices, currentStore]
    );

    const handleInvoiceChange = (invoiceId: string) => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (invoice) {
            setSelectedInvoice(invoice);
            const refundableItems = invoice.items
                .filter(item => item.quantity > 0)
                .map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    price: item.price,
                    maxQuantity: item.quantity,
                    refundQuantity: 0,
                    selected: false,
                }));
            replace(refundableItems);
            form.setValue('invoiceId', invoice.id);
            form.clearErrors('items');
        } else {
            setSelectedInvoice(null);
            replace([]);
            form.setValue('invoiceId', '');
        }
    };
    
    const totalRefundAmount = useMemo(() => {
        return watchedItems.reduce((total, item) => {
            if (item.selected) {
                const quantity = Number(item.refundQuantity) || 0;
                return total + (item.price * quantity);
            }
            return total;
        }, 0);
    }, [watchedItems]);

    const onSubmit = async (data: ReturnFormData) => {
        setIsLoading(true);

        const refundedItemsFromForm = data.items.filter(item => item.selected && item.refundQuantity > 0);
        const invoice = invoices.find(inv => inv.id === data.invoiceId);
        if (!invoice) {
            toast({ variant: 'destructive', title: 'Error', description: 'Invoice not found.' });
            setIsLoading(false);
            return;
        }

        // Build updated invoice state
        const updatedInvoiceItems = invoice.items.map(item => {
            const refundedItem = refundedItemsFromForm.find(r => r.productId === item.productId);
            return refundedItem ? { ...item, quantity: item.quantity - refundedItem.refundQuantity } : item;
        });
        const remainingCount = updatedInvoiceItems.reduce((total, item) => total + item.quantity, 0);
        const newStatus = remainingCount <= 0 ? 'refunded' : 'partially-refunded';

        const newRefund: Refund = {
            id: `REF-${Date.now()}`,
            invoiceId: data.invoiceId,
            storeId: currentStore?.id,
            items: refundedItemsFromForm.map(i => ({
                productId: i.productId,
                productName: i.productName,
                quantity: i.refundQuantity,
                price: i.price,
            })),
            amount: totalRefundAmount,
            reason: data.reason,
            date: new Date().toISOString(),
        };

        try {
            if (!tenantId) {
                throw new Error('No tenant selected');
            }
            // Atomic transaction: update invoice + products + create refund in one write
            await runTransaction(db, async (transaction) => {
                // Update invoice
                transaction.set(doc(db, 'tenants', tenantId, 'invoices', invoice.id), {
                    ...invoice,
                    items: updatedInvoiceItems,
                    status: newStatus,
                }, { merge: true });

                // Update product stock
                refundedItemsFromForm.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        transaction.set(doc(db, 'tenants', tenantId, 'products', product.id), {
                            ...product,
                            stock: product.stock + item.refundQuantity,
                        }, { merge: true });
                    }
                });

                // Create refund record
                transaction.set(doc(db, 'tenants', tenantId, 'refunds', newRefund.id), newRefund);
            });

            // Optimistic local update
            setInvoices(invoices.map(inv => inv.id === invoice.id ? { ...inv, items: updatedInvoiceItems, status: newStatus as Invoice['status'] } : inv));
            setProducts(products.map(p => {
                const refundedItem = refundedItemsFromForm.find(r => r.productId === p.id);
                return refundedItem ? { ...p, stock: p.stock + refundedItem.refundQuantity } : p;
            }));
            setRefunds([newRefund, ...refunds]);

            addActivityLog('Refund Processed', `Processed refund of ${currencySymbol} ${totalRefundAmount.toFixed(2)} for invoice ${data.invoiceId}. Reason: ${data.reason}`);
            toast({ title: 'Refund Processed Successfully' });
            form.reset();
            setSelectedInvoice(null);
            replace([]);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Refund Failed', description: 'Could not process refund. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isDataLoaded) return <PageSkeleton hasFilters={false} rows={6} cols={4} />;

    return (
        <div className="flex flex-col h-full">
            <Header title="Process Returns & Refunds" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Returns & Refunds</CardTitle>
                        <CardDescription>Process item-level or full refunds for completed sales.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="invoiceId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Select Invoice to Refund</FormLabel>
                                                <Select onValueChange={(value) => {
                                                    field.onChange(value);
                                                    handleInvoiceChange(value);
                                                }} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a paid invoice" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {paidInvoices.map(invoice => (
                                                            <SelectItem key={invoice.id} value={invoice.id}>
                                                                {invoice.id} - {invoice.customerName || 'Walk-in'} - {currencySymbol} {invoice.amount.toFixed(2)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="reason"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Reason for Return</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="e.g., Damaged item, wrong size, etc." {...field} disabled={!selectedInvoice}/>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                {selectedInvoice && (
                                    <div className="space-y-4">
                                        <h3 className="font-medium">Select Items to Refund from Invoice {selectedInvoice.id}</h3>
                                        <Card>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-12">
                                                                <Checkbox 
                                                                    checked={fields.length > 0 && watchedItems.every(item => item.selected)}
                                                                    onCheckedChange={(checked) => {
                                                                        const currentItems = form.getValues('items');
                                                                        const newItems = fields.map((field, index) => ({
                                                                            ...currentItems[index],
                                                                            selected: !!checked,
                                                                            refundQuantity: checked ? field.maxQuantity : 0,
                                                                        }));
                                                                        replace(newItems);
                                                                    }}
                                                                />
                                                            </TableHead>
                                                            <TableHead>Product</TableHead>
                                                            <TableHead className="text-right">Price</TableHead>
                                                            <TableHead className="text-center">Available</TableHead>
                                                            <TableHead className="w-32">Refund Qty</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {fields.map((field, index) => (
                                                            <TableRow key={field.id}>
                                                                <TableCell>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`items.${index}.selected`}
                                                                        render={({ field: checkboxField }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <Checkbox
                                                                                        checked={checkboxField.value}
                                                                                        onCheckedChange={(checked) => {
                                                                                            checkboxField.onChange(checked);
                                                                                            form.setValue(`items.${index}.refundQuantity`, checked ? field.maxQuantity : 0);
                                                                                        }}
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>{field.productName}</TableCell>
                                                                <TableCell className="text-right">{currencySymbol} {field.price.toFixed(2)}</TableCell>
                                                                <TableCell className="text-center">{field.maxQuantity}</TableCell>
                                                                <TableCell>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`items.${index}.refundQuantity`}
                                                                        render={({ field: quantityField }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <Input type="number" {...quantityField} disabled={!watchedItems[index]?.selected} />
                                                                                </FormControl>
                                                                                <FormMessage className="text-xs"/>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                        <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>

                                        <div className="flex justify-end pt-4">
                                            <div className="text-right">
                                                <p className="text-muted-foreground">Total Refund Amount</p>
                                                <p className="text-2xl font-bold">{currencySymbol} {totalRefundAmount.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <Button type="submit" disabled={isLoading || !selectedInvoice || totalRefundAmount <= 0}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Undo2 className="mr-2 h-4 w-4" />
                                            Process Refund
                                        </>
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

