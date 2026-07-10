
'use client'

import { useState, useMemo } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { ApprovalWorkflow, VendorBill, VendorBillStatus, PurchaseOrder } from '@/types';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, ArrowUpDown } from '@/components/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { TableSkeleton } from '@/components/TableSkeleton';
import { sendDepartmentEmail } from '@/lib/email';
import { buildApprovalWorkflow } from '@/lib/approvals';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';

const billSchema = z.object({
  purchaseOrderId: z.string().min(1, "A Purchase Order is required."),
  amount: z.coerce.number().positive("Amount must be positive."),
  billDate: z.date(),
  dueDate: z.date(),
});

type BillFormData = z.infer<typeof billSchema>;

const statusVariant: { [key in VendorBillStatus]: 'default' | 'secondary' | 'destructive' } = {
  unpaid: 'secondary',
  paid: 'default',
  cancelled: 'destructive'
};

function PayablesPageInner() {
    const { vendorBills, setVendorBills, purchaseOrders, vendors, addActivityLog, user, users, employees, themeSettings, approvalWorkflows, setApprovalWorkflows, currencySymbol, isDataLoaded, companyName, smtpConfigList, emailTemplates, setEmailLogs } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [billToEdit, setBillToEdit] = useState<VendorBill | null>(null);
    const [reviewingBill, setReviewingBill] = useState<VendorBill | null>(null);
    const [sortKey, setSortKey] = useState<'dueDate' | 'vendorName' | 'amount'>('dueDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const workflowForBill = (bill: VendorBill) =>
        approvalWorkflows.find(w => w.entityType === 'vendor-bill' && w.entityId === bill.id && w.finalStatus === 'in-progress');
    
    const form = useForm<BillFormData>({
        resolver: zodResolver(billSchema),
    });

    const receivedPOsWithoutBills = useMemo(() => 
        purchaseOrders.filter(po => 
            po.status === 'received' && !vendorBills.some(bill => bill.purchaseOrderId === po.id)
        ), 
    [purchaseOrders, vendorBills]);

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const sortedBills = useMemo(() => {
        return [...vendorBills].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [vendorBills, sortKey, sortDirection]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full"><Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage accounts payable.</p></CardContent></Card></main>
            </div>
        );
    }
    
    const handleSort = (key: 'dueDate' | 'vendorName' | 'amount') => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleOpenForm = (bill: VendorBill | null = null) => {
        setBillToEdit(bill);
        if (bill) {
            form.reset({
                purchaseOrderId: bill.purchaseOrderId,
                amount: bill.amount,
                billDate: parseISO(bill.billDate),
                dueDate: parseISO(bill.dueDate),
            });
        } else {
            form.reset({ purchaseOrderId: '', amount: 0, billDate: new Date(), dueDate: new Date() });
        }
        setIsFormOpen(true);
    };

    const handlePOChange = (poId: string) => {
        const po = purchaseOrders.find(p => p.id === poId);
        if (po) {
            form.setValue('amount', po.totalCost);
        }
    };

    const onSubmit = (data: BillFormData) => {
        const po = purchaseOrders.find(p => p.id === data.purchaseOrderId);
        if (!po) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selected Purchase Order not found.' });
            return;
        }

        const newBillData = {
            purchaseOrderId: po.id,
            vendorId: po.vendorId,
            vendorName: po.vendorName,
            amount: data.amount,
            items: po.items,
            billDate: format(data.billDate, 'yyyy-MM-dd'),
            dueDate: format(data.dueDate, 'yyyy-MM-dd'),
        };

        if (billToEdit) {
            setVendorBills(prev => prev.map(b => b.id === billToEdit.id ? { ...b, ...newBillData } : b));
            toast({ title: 'Bill Updated' });
        } else {
            const billId = `bill-${Date.now()}`;
            const workflow = user
                ? buildApprovalWorkflow('vendor-bill', billId, `Bill ${billId} — ${po.vendorName}`, data.amount, user, themeSettings.approvalRules, users, po.storeId, employees)
                : null;
            const newBill: VendorBill = {
                id: billId,
                status: 'unpaid',
                requiresApproval: !!workflow,
                ...newBillData,
            };
            setVendorBills(prev => [newBill, ...prev]);
            if (workflow) setApprovalWorkflows(prev => [workflow, ...prev]);
            toast({ title: 'Bill Created' });
            const vendor = vendors.find(v => v.id === po.vendorId);
            if (vendor?.email) {
                void sendDepartmentEmail(
                    { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                    'Finance',
                    'vendor-bill-received',
                    vendor.email,
                    { vendorName: vendor.name, amount: `${currencySymbol} ${data.amount.toFixed(2)}` },
                    user?.name ?? 'system'
                );
            }
        }
        setIsFormOpen(false);
    };
    
    const handleStatusChange = (billId: string, status: VendorBillStatus) => {
        setVendorBills(prev => prev.map(b => b.id === billId ? {...b, status} : b));
        toast({ title: 'Bill Status Updated' });
    }

    const onBillWorkflowChange = (wf: ApprovalWorkflow) => {
        setApprovalWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
        if (wf.finalStatus === 'approved') {
            setVendorBills(prev => prev.map(b => b.id === wf.entityId ? { ...b, requiresApproval: false } : b));
            addActivityLog('Vendor Bill Approved', `Bill ${wf.entityId} cleared for payment.`);
        } else if (wf.finalStatus === 'rejected') {
            setVendorBills(prev => prev.map(b => b.id === wf.entityId ? { ...b, status: 'cancelled', requiresApproval: false } : b));
            addActivityLog('Vendor Bill Rejected', `Bill ${wf.entityId} was rejected and cancelled.`);
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Accounts Payable" />
            <Breadcrumb items={[{ label: 'Finance', href: '/accounting' }, { label: 'Accounts Payable' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                 <div className="flex justify-end mb-4">
                    <Button size="sm" onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" /> Enter New Bill</Button>
                </div>
                <Card>
                    <CardHeader><CardTitle>Vendor Bills</CardTitle><CardDescription>Manage and pay bills from your vendors.</CardDescription></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('vendorName')}>Vendor <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead>PO Ref</TableHead>
                                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('dueDate')}>Due Date <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {sortedBills.map(bill => (
                                    <TableRow key={bill.id}>
                                        <TableCell className="font-medium">
                                            {bill.vendorName}
                                            {bill.autoGenerated && <Badge variant="outline" className="ml-2 text-xs font-normal">Auto</Badge>}
                                        </TableCell>
                                        <TableCell>{bill.purchaseOrderId}</TableCell>
                                        <TableCell className="text-right">{currencySymbol}{bill.amount.toFixed(2)}</TableCell>
                                        <TableCell>{format(parseISO(bill.dueDate), 'PPP')}</TableCell>
                                        <TableCell><Badge variant={statusVariant[bill.status]} className="capitalize">{bill.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleOpenForm(bill)}>Edit</DropdownMenuItem>
                                                    {bill.status === 'unpaid' && bill.requiresApproval && (
                                                        <DropdownMenuItem onClick={() => setReviewingBill(bill)}>Review approval</DropdownMenuItem>
                                                    )}
                                                    {bill.status === 'unpaid' && !bill.requiresApproval && <DropdownMenuItem onClick={() => handleStatusChange(bill.id, 'paid')}>Mark as Paid</DropdownMenuItem>}
                                                     {bill.status === 'paid' && <DropdownMenuItem onClick={() => handleStatusChange(bill.id, 'unpaid')}>Mark as Unpaid</DropdownMenuItem>}
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
                    <DialogHeader><DialogTitle>{billToEdit ? 'Edit Bill' : 'Enter New Bill'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                             <FormField
                                control={form.control}
                                name="purchaseOrderId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>From Purchase Order (Optional)</FormLabel>
                                    <Select onValueChange={(value) => { field.onChange(value); handlePOChange(value); }} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a received PO"/></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {receivedPOsWithoutBills.map(po => <SelectItem key={po.id} value={po.id}>{po.id} - {po.vendorName}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormDescription>Select a PO to auto-fill amount.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )}
                            />
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="billDate" render={({ field }) => (
                                    <FormItem><FormLabel>Bill Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="dueDate" render={({ field }) => (
                                    <FormItem><FormLabel>Due Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                             <DialogFooter><Button type="submit">{billToEdit ? 'Save Changes' : 'Create Bill'}</Button></DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!reviewingBill} onOpenChange={(open) => !open && setReviewingBill(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Review bill approval</DialogTitle></DialogHeader>
                    {reviewingBill && (
                        <ApprovalWorkflowPanel
                            entityType="vendor-bill"
                            entityId={reviewingBill.id}
                            entityTitle={`Bill ${reviewingBill.id} — ${reviewingBill.vendorName}`}
                            workflow={workflowForBill(reviewingBill)}
                            onWorkflowChange={onBillWorkflowChange}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}




// Permission guard lives in a wrapper so all hooks inside PayablesPageInner
// run unconditionally (React rules-of-hooks).
export default function PayablesPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <PayablesPageInner />;
}
