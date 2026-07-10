
'use client'

import { useState, useMemo } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { QualityCheck } from '@/types';
import { PlusCircle } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const qualityCheckSchema = z.object({
  productionOrderId: z.string().min(1, "Please select a production order."),
  status: z.enum(['pass', 'fail', 'pending']),
  notes: z.string().min(1, "Notes are required for the quality check."),
});

type QualityCheckFormData = z.infer<typeof qualityCheckSchema>;

const statusVariant: { [key in QualityCheck['status']]: 'default' | 'secondary' | 'destructive' } = {
    pass: 'default',
    fail: 'destructive',
    pending: 'secondary',
};

function QualityControlPageInner() {
    const { qualityChecks, setQualityChecks, productionOrders, addActivityLog, user, currentStore, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);

    const form = useForm<QualityCheckFormData>({
        resolver: zodResolver(qualityCheckSchema),
        defaultValues: { productionOrderId: '', status: 'pending', notes: '' },
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const completedProductionOrders = useMemo(() =>
        productionOrders.filter(p => p.status === 'completed'),
        [productionOrders]
    );

    const onSubmit = (data: QualityCheckFormData) => {
        if (!user) return;
        const productionOrder = productionOrders.find(p => p.id === data.productionOrderId);
        if (!productionOrder) return;

        const newCheck: QualityCheck = {
            id: `qc-${Date.now()}`,
            productionOrderId: productionOrder.id,
            productName: productionOrder.productName,
            checkDate: new Date().toISOString(),
            inspectorId: user.id,
            inspectorName: user.name,
            status: data.status,
            notes: data.notes,
            storeId: currentStore?.id,
        };

        setQualityChecks(prev => [newCheck, ...prev]);
        addActivityLog('Quality Check Added', `QC for order ${productionOrder.id} added by ${user.name}`);
        toast({ title: 'Quality Check Logged' });
        setIsFormOpen(false);
        form.reset();
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Quality Control" />
            <Breadcrumb items={[{ label: 'Manufacturing', href: '/manufacturing' }, { label: 'Quality Control' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex justify-end mb-4">
                    {canManage && (
                        <Button size="sm" onClick={() => setIsFormOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Quality Check
                        </Button>
                    )}
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO ID</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Inspector</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {qualityChecks.map(qc => (
                                    <TableRow key={qc.id}>
                                        <TableCell>{qc.productionOrderId}</TableCell>
                                        <TableCell>{qc.productName}</TableCell>
                                        <TableCell>{format(new Date(qc.checkDate), 'PPP')}</TableCell>
                                        <TableCell>{qc.inspectorName}</TableCell>
                                        <TableCell><Badge variant={statusVariant[qc.status]} className="capitalize">{qc.status}</Badge></TableCell>
                                        <TableCell className="max-w-xs truncate">{qc.notes}</TableCell>
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
                    <DialogHeader>
                        <DialogTitle>New Quality Check</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="productionOrderId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Completed Production Order</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select a completed order" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {completedProductionOrders.map(p => <SelectItem key={p.id} value={p.id}>{p.id} - {p.productName}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Result</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="pass">Pass</SelectItem>
                                                <SelectItem value="fail">Fail</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Inspector Notes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Enter findings, measurements, etc." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="submit">Log Check</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

    




// Permission guard lives in a wrapper so all hooks inside QualityControlPageInner
// run unconditionally (React rules-of-hooks).
export default function QualityControlPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'inventory-staff']);
  if (!isAllowed) return null;
  return <QualityControlPageInner />;
}
