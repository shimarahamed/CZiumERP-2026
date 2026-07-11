
'use client'

import { useState, useMemo } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { ProductionOrder, ProductionOrderStatus } from '@/types';
import { MoreHorizontal, PlusCircle } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { adjustStock, getDefaultWarehouse } from '@/lib/warehouse';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const PRODUCTION_ORDERS_COLUMNS: ColumnDef[] = [
  { id: 'orderId', label: 'Order ID', locked: true },
  { id: 'product', label: 'Product' },
  { id: 'status', label: 'Status' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'scheduledDates', label: 'Scheduled Dates' },
];

const productionOrderSchema = z.object({
  productId: z.string().min(1, "Please select a product to manufacture."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  scheduledStartDate: z.date({ required_error: "Start date is required." }),
  scheduledEndDate: z.date({ required_error: "End date is required." }),
  notes: z.string().optional(),
});

type ProductionOrderFormData = z.infer<typeof productionOrderSchema>;

const statusVariant: { [key in ProductionOrderStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'planned': 'secondary',
    'in-progress': 'default',
    'completed': 'outline',
    'on-hold': 'secondary',
    'cancelled': 'destructive'
};

function ProductionOrdersPageInner() {
    const { productionOrders, setProductionOrders, products, setProducts, billsOfMaterials, addActivityLog, user, currentStore, isDataLoaded, warehouses, stockLevels, setStockLevels } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState<ProductionOrder | null>(null);
    const [orderToUpdateStatus, setOrderToUpdateStatus] = useState<ProductionOrder | null>(null);
    const columnVisibility = useColumnVisibility('production-orders', PRODUCTION_ORDERS_COLUMNS);
    const { isVisible } = columnVisibility;

    const form = useForm<ProductionOrderFormData>({
        resolver: zodResolver(productionOrderSchema),
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const manufacturableProducts = useMemo(() => 
        products.filter(p => billsOfMaterials.some(bom => bom.productId === p.id)),
    [products, billsOfMaterials]);

    const handleOpenForm = (order: ProductionOrder | null = null) => {
        setOrderToEdit(order);
        if (order) {
            form.reset({
                productId: order.productId,
                quantity: order.quantity,
                scheduledStartDate: new Date(order.scheduledStartDate),
                scheduledEndDate: new Date(order.scheduledEndDate),
                notes: order.notes || '',
            });
        } else {
            form.reset({ productId: '', quantity: 1, scheduledStartDate: new Date(), scheduledEndDate: new Date(), notes: '' });
        }
        setIsFormOpen(true);
    };

    const handleStatusUpdate = (order: ProductionOrder, newStatus: ProductionOrderStatus) => {
        if (newStatus === 'completed') {
            setOrderToUpdateStatus(order); // Open confirmation dialog for completion
        } else {
            setProductionOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
            toast({ title: "Status Updated", description: `Order ${order.id} is now ${newStatus.replace('-', ' ')}.`});
            addActivityLog('Production Order Status Updated', `Set order ${order.id} to ${newStatus}`);
        }
    };
    
    const confirmCompleteOrder = () => {
        if (!orderToUpdateStatus) return;

        const bom = billsOfMaterials.find(b => b.productId === orderToUpdateStatus.productId);
        if (!bom) {
            toast({ variant: 'destructive', title: "Error", description: "BOM not found for this product." });
            setOrderToUpdateStatus(null);
            return;
        }

        // Check stock
        const insufficientStock = bom.items.some(item => {
            const component = products.find(p => p.id === item.componentId);
            return !component || component.stock < item.quantity * orderToUpdateStatus.quantity;
        });

        if (insufficientStock) {
            toast({ variant: 'destructive', title: "Insufficient Component Stock", description: "Cannot complete order, not enough raw materials." });
            setOrderToUpdateStatus(null);
            return;
        }

        const warehouseId = getDefaultWarehouse(warehouses)?.id;
        if (!warehouseId) {
            toast({ variant: 'destructive', title: "No Warehouse Configured", description: "A default warehouse is required to complete production orders." });
            setOrderToUpdateStatus(null);
            return;
        }

        // Update stock levels — components and finished goods both move through the default
        // warehouse; Product.stock is kept in sync as the denormalized total.
        bom.items.forEach(item => {
            adjustStock({ stockLevels, setStockLevels }, item.componentId, warehouseId, -(item.quantity * orderToUpdateStatus.quantity));
        });
        adjustStock({ stockLevels, setStockLevels }, orderToUpdateStatus.productId, warehouseId, orderToUpdateStatus.quantity);

        setProducts(prevProducts => {
            const newProducts = [...prevProducts];
            // Deduct components
            bom.items.forEach(item => {
                const componentIndex = newProducts.findIndex(p => p.id === item.componentId);
                newProducts[componentIndex].stock -= item.quantity * orderToUpdateStatus.quantity;
            });
            // Add finished product
            const finishedProductIndex = newProducts.findIndex(p => p.id === orderToUpdateStatus.productId);
            newProducts[finishedProductIndex].stock += orderToUpdateStatus.quantity;
            return newProducts;
        });

        // Update order status
        setProductionOrders(prev => prev.map(o => o.id === orderToUpdateStatus.id ? { ...o, status: 'completed', actualCompletionDate: new Date().toISOString() } : o));

        toast({ title: "Order Completed", description: `Order ${orderToUpdateStatus.id} completed. Stock levels updated.` });
        addActivityLog('Production Order Completed', `Order ${orderToUpdateStatus.id} completed and stock updated.`);
        setOrderToUpdateStatus(null);
    };

    const onSubmit = (data: ProductionOrderFormData) => {
        const product = products.find(p => p.id === data.productId);
        const bom = billsOfMaterials.find(b => b.productId === data.productId);
        if (!product || !bom) {
            toast({variant: 'destructive', title: 'Error', description: 'Selected product must have a Bill of Materials.'});
            return;
        }
        
        const newOrderData = {
            productId: product.id,
            productName: product.name,
            bomId: bom.id,
            quantity: data.quantity,
            scheduledStartDate: format(data.scheduledStartDate, 'yyyy-MM-dd'),
            scheduledEndDate: format(data.scheduledEndDate, 'yyyy-MM-dd'),
            notes: data.notes,
        };

        if (orderToEdit) {
            setProductionOrders(prev => prev.map(o => o.id === orderToEdit.id ? { ...o, ...newOrderData } : o));
            toast({ title: "Production Order Updated" });
        } else {
            const newOrder: ProductionOrder = {
                id: `prod-ord-${Date.now()}`,
                status: 'planned',
                storeId: currentStore?.id,
                ...newOrderData,
            };
            setProductionOrders(prev => [newOrder, ...prev]);
            toast({ title: "Production Order Created" });
        }
        setIsFormOpen(false);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Production Orders" />
            <Breadcrumb items={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Production Orders' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Production Schedule</CardTitle>
                                <CardDescription>Plan, schedule, and track all manufacturing jobs.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <ColumnVisibilityMenu visibility={columnVisibility} />
                                {canManage && (
                                    <Button size="sm" onClick={() => handleOpenForm()}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> New Production Order
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    {isVisible('product') && <TableHead>Product</TableHead>}
                                    {isVisible('status') && <TableHead>Status</TableHead>}
                                    {isVisible('quantity') && <TableHead>Quantity</TableHead>}
                                    {isVisible('scheduledDates') && <TableHead>Scheduled Dates</TableHead>}
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {productionOrders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell>{order.id}</TableCell>
                                        {isVisible('product') && <TableCell>{order.productName}</TableCell>}
                                        {isVisible('status') && <TableCell><Badge variant={statusVariant[order.status]} className="capitalize">{order.status.replace('-', ' ')}</Badge></TableCell>}
                                        {isVisible('quantity') && <TableCell>{order.quantity}</TableCell>}
                                        {isVisible('scheduledDates') && <TableCell>{format(new Date(order.scheduledStartDate), 'PPP')} - {format(new Date(order.scheduledEndDate), 'PPP')}</TableCell>}
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={!canManage}><MoreHorizontal/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenForm(order)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleStatusUpdate(order, 'in-progress')} disabled={order.status === 'in-progress' || order.status === 'completed'}>Mark In Progress</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusUpdate(order, 'completed')} disabled={order.status === 'completed'}>Mark Completed</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusUpdate(order, 'on-hold')} disabled={order.status === 'on-hold' || order.status === 'completed'}>Place On Hold</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusUpdate(order, 'cancelled')} disabled={order.status === 'completed'} className="text-destructive">Cancel Order</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{orderToEdit ? 'Edit Order' : 'New Production Order'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                             <FormField control={form.control} name="productId" render={({ field }) => (
                                <FormItem><FormLabel>Product to Manufacture</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger></FormControl>
                                        <SelectContent>{manufacturableProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="quantity" render={({ field }) => (
                               <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <FormField control={form.control} name="scheduledStartDate" render={({ field }) => (
                                    <FormItem><FormLabel>Start Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                 <FormField control={form.control} name="scheduledEndDate" render={({ field }) => (
                                    <FormItem><FormLabel>End Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <DialogFooter><Button type="submit">{orderToEdit ? 'Save Changes' : 'Create Order'}</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!orderToUpdateStatus} onOpenChange={(open) => !open && setOrderToUpdateStatus(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Complete Production Order?</AlertDialogTitle>
                        <AlertDialogDescription>This will mark order {orderToUpdateStatus?.id} as &apos;Completed&apos;. Component stock will be deducted and finished product stock will be increased. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCompleteOrder}>Confirm Completion</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}




// Permission guard lives in a wrapper so all hooks inside ProductionOrdersPageInner
// run unconditionally (React rules-of-hooks).
export default function ProductionOrdersPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'inventory-staff']);
  if (!isAllowed) return null;
  return <ProductionOrdersPageInner />;
}
