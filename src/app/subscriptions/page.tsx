'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Loader2, RefreshCw } from "@/components/icons";
import { formatNumber } from '@/lib/money';
import { RowContextMenu } from '@/components/RowContextMenu';
import { usePageKeyboard } from '@/hooks/use-page-keyboard';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import type { Subscription, Currency } from '@/types';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useRequirePermission } from '@/hooks/use-require-role';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';
import { format, parseISO } from 'date-fns';

const SUBSCRIPTIONS_COLUMNS: ColumnDef[] = [
    { id: 'name', label: 'Subscription', locked: true },
    { id: 'vendor', label: 'Vendor' },
    { id: 'cost', label: 'Cost' },
    { id: 'frequency', label: 'Frequency' },
    { id: 'nextDueDate', label: 'Next Due' },
    { id: 'endDate', label: 'End Date' },
    { id: 'linked', label: 'Linked Items' },
    { id: 'status', label: 'Status' },
];

const CURRENCIES: Currency[] = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'];

const subscriptionSchema = z.object({
    name: z.string().min(1, "Subscription name is required."),
    vendorId: z.string().optional(),
    cost: z.coerce.number().min(0, "Cost must be a non-negative number."),
    currency: z.enum(['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR']).optional(),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    startDate: z.date(),
    endDate: z.date().optional().nullable(),
    status: z.enum(['active', 'paused', 'cancelled']),
    notes: z.string().optional(),
}).refine(d => !d.endDate || d.endDate >= d.startDate, {
    message: "End date can't be before the start date.", path: ['endDate'],
});

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

const statusVariant: { [key in Subscription['status']]: 'default' | 'secondary' | 'destructive' } = {
    active: 'default',
    paused: 'secondary',
    cancelled: 'destructive',
};

export default function SubscriptionsPage() {
    usePageTitle('Subscriptions');
    const { addActivityLog, vendors, products, subscriptions, setSubscriptions, currencySymbol, currencySymbols, tenantId } = useAppContext();
    const { toast } = useToast();
    const canManage = useRequirePermission('Supply Chain', 'edit');
    const canCreate = useRequirePermission('Supply Chain', 'create');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [subscriptionToEdit, setSubscriptionToEdit] = useState<Subscription | null>(null);
    const [subscriptionToDelete, setSubscriptionToDelete] = useState<Subscription | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const columnVisibility = useColumnVisibility('subscriptions', SUBSCRIPTIONS_COLUMNS);
    const { isVisible } = columnVisibility;

    const form = useForm<SubscriptionFormData>({
        resolver: zodResolver(subscriptionSchema),
        defaultValues: {
            name: '', vendorId: 'none', cost: 0, currency: undefined, frequency: 'monthly',
            startDate: new Date(), endDate: null, status: 'active', notes: '',
        },
    });

    const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);

    const linkedProductsBySubscription = useMemo(() => {
        const map = new Map<string, typeof products>();
        products.forEach(p => {
            if (!p.subscriptionId) return;
            const list = map.get(p.subscriptionId) ?? [];
            list.push(p);
            map.set(p.subscriptionId, list);
        });
        return map;
    }, [products]);

    const filteredSubscriptions = useMemo(() => {
        let result = subscriptions;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(q) ||
                (s.vendorId && vendorMap.get(s.vendorId)?.toLowerCase().includes(q))
            );
        }
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }, [subscriptions, searchTerm, vendorMap]);

    const handleOpenForm = (subscription: Subscription | null = null) => {
        setSubscriptionToEdit(subscription);
        if (subscription) {
            form.reset({
                name: subscription.name,
                vendorId: subscription.vendorId ?? 'none',
                cost: subscription.cost,
                currency: subscription.currency,
                frequency: subscription.frequency,
                startDate: parseISO(subscription.startDate),
                endDate: subscription.endDate ? parseISO(subscription.endDate) : null,
                status: subscription.status,
                notes: subscription.notes ?? '',
            });
        } else {
            form.reset({
                name: '', vendorId: 'none', cost: 0, currency: undefined, frequency: 'monthly',
                startDate: new Date(), endDate: null, status: 'active', notes: '',
            });
        }
        setIsFormOpen(true);
    };

    usePageKeyboard({ onNew: canCreate ? () => handleOpenForm() : undefined });

    const onSubmit = async (data: SubscriptionFormData) => {
        setIsSaving(true);
        try {
            if (!tenantId) {
                toast({ variant: 'destructive', title: "Error", description: "Tenant information not available." });
                return;
            }
            const startStr = data.startDate.toISOString();
            const endStr = data.endDate ? data.endDate.toISOString() : undefined;
            const vendorId = data.vendorId === 'none' ? undefined : data.vendorId;
            if (subscriptionToEdit) {
                const ref = doc(db, "tenants", tenantId, "subscriptions", subscriptionToEdit.id);
                const updated: Subscription = {
                    ...subscriptionToEdit,
                    name: data.name,
                    vendorId,
                    cost: data.cost,
                    currency: data.currency || undefined,
                    frequency: data.frequency,
                    startDate: startStr,
                    endDate: endStr,
                    status: data.status,
                    notes: data.notes,
                };
                await setDoc(ref, updated);
                toast({ title: "Subscription Updated", description: `${data.name} has been updated.` });
                addActivityLog('Subscription Updated', `Updated subscription: ${data.name} (ID: ${subscriptionToEdit.id})`);
            } else {
                const newId = `sub-${Date.now()}`;
                const ref = doc(db, "tenants", tenantId, "subscriptions", newId);
                const newSubscription: Subscription = {
                    id: newId,
                    name: data.name,
                    vendorId,
                    cost: data.cost,
                    currency: data.currency || undefined,
                    frequency: data.frequency,
                    startDate: startStr,
                    endDate: endStr,
                    nextDueDate: startStr,
                    status: data.status,
                    notes: data.notes,
                    createdAt: new Date().toISOString(),
                };
                await setDoc(ref, newSubscription);
                toast({ title: "Subscription Added", description: `${data.name} has been added.` });
                addActivityLog('Subscription Added', `Added new subscription: ${data.name}`);
            }
            setIsFormOpen(false);
            setSubscriptionToEdit(null);
        } catch (error) {
            console.error("Error saving subscription:", error);
            const description = error instanceof Error ? error.message : "Could not save subscription details.";
            toast({ variant: 'destructive', title: "Error", description });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!subscriptionToDelete || !tenantId) return;
        setIsDeleting(true);
        try {
            const ref = doc(db, "tenants", tenantId, "subscriptions", subscriptionToDelete.id);
            await deleteDoc(ref);
            toast({ title: "Subscription Deleted", description: `${subscriptionToDelete.name} has been deleted.` });
            addActivityLog('Subscription Deleted', `Deleted subscription: ${subscriptionToDelete.name} (ID: ${subscriptionToDelete.id})`);
            setSubscriptionToDelete(null);
        } catch (error) {
            console.error("Error deleting subscription:", error);
            const description = error instanceof Error ? error.message : "Could not delete subscription.";
            toast({ variant: 'destructive', title: "Error", description });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Subscriptions" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                                <CardTitle>Subscriptions</CardTitle>
                                <CardDescription>
                                    Track recurring costs the business pays (e.g. a shared hosting plan) and see which products
                                    or services resell that cost to customers.
                                </CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <Input
                                    placeholder="Search by name or vendor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                                />
                                <ColumnVisibilityMenu visibility={columnVisibility} />
                                {canCreate && (
                                    <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                                        <PlusCircle className="h-4 w-4" />
                                        Add Subscription
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subscription</TableHead>
                                    {isVisible('vendor') && <TableHead>Vendor</TableHead>}
                                    {isVisible('cost') && <TableHead className="text-right">Cost</TableHead>}
                                    {isVisible('frequency') && <TableHead>Frequency</TableHead>}
                                    {isVisible('nextDueDate') && <TableHead className="hidden md:table-cell">Next Due</TableHead>}
                                    {isVisible('endDate') && <TableHead className="hidden md:table-cell">End Date</TableHead>}
                                    {isVisible('linked') && <TableHead className="hidden md:table-cell">Linked Items</TableHead>}
                                    {isVisible('status') && <TableHead>Status</TableHead>}
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSubscriptions.length === 0 && (
                                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No subscriptions found.</TableCell></TableRow>
                                )}
                                {filteredSubscriptions.map(subscription => {
                                    const linked = linkedProductsBySubscription.get(subscription.id) ?? [];
                                    const linkedRevenue = linked.reduce((sum, p) => sum + p.price, 0);
                                    const margin = linkedRevenue - subscription.cost;
                                    return (
                                        <RowContextMenu
                                          key={subscription.id}
                                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                          items={[
                                            ...(canManage ? [{ label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => handleOpenForm(subscription) }] : []),
                                            { separator: true as const },
                                            ...(canManage ? [{ label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => setSubscriptionToDelete(subscription), variant: 'destructive' as const }] : []),
                                          ]}
                                        >
                                            <TableCell className="font-medium truncate">
                                                <div className="flex items-center gap-2">
                                                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    {subscription.name}
                                                </div>
                                            </TableCell>
                                            {isVisible('vendor') && <TableCell className="truncate">{subscription.vendorId ? vendorMap.get(subscription.vendorId) ?? '—' : '—'}</TableCell>}
                                            {isVisible('cost') && <TableCell className="text-right">{currencySymbol} {formatNumber(subscription.cost)}</TableCell>}
                                            {isVisible('frequency') && <TableCell className="capitalize">{subscription.frequency}</TableCell>}
                                            {isVisible('nextDueDate') && (
                                                <TableCell className="hidden md:table-cell">
                                                    {subscription.nextDueDate ? format(parseISO(subscription.nextDueDate), 'MMM d, yyyy') : '—'}
                                                </TableCell>
                                            )}
                                            {isVisible('endDate') && (
                                                <TableCell className="hidden md:table-cell">
                                                    {subscription.endDate ? format(parseISO(subscription.endDate), 'MMM d, yyyy') : <span className="text-muted-foreground">Ongoing</span>}
                                                </TableCell>
                                            )}
                                            {isVisible('linked') && (
                                                <TableCell className="hidden md:table-cell">
                                                    {linked.length === 0 ? (
                                                        <span className="text-muted-foreground">None</span>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge variant="outline">{linked.length} item{linked.length === 1 ? '' : 's'}</Badge>
                                                            <span className={margin >= 0 ? 'text-xs text-green-600' : 'text-xs text-destructive'}>
                                                                {margin >= 0 ? '+' : ''}{currencySymbol} {formatNumber(margin)} margin
                                                            </span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            )}
                                            {isVisible('status') && (
                                                <TableCell>
                                                    <Badge variant={statusVariant[subscription.status]} className="capitalize">{subscription.status}</Badge>
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleOpenForm(subscription)} disabled={!canManage}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setSubscriptionToDelete(subscription)} disabled={!canManage}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </RowContextMenu>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{subscriptionToEdit ? 'Edit Subscription' : 'Add New Subscription'}</DialogTitle>
                        <DialogDescription>
                            {subscriptionToEdit
                                ? 'Update the details of this recurring cost.'
                                : 'Track a recurring cost the business pays. Link products or services to it from Inventory to see who it\'s resold to.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Subscription Name</FormLabel><FormControl><Input placeholder="e.g. AWS Hosting — Blanket Plan" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="vendorId" render={({ field }) => (
                                    <FormItem><FormLabel>Vendor</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="frequency" render={({ field }) => (
                                    <FormItem><FormLabel>Billing Frequency</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                                <SelectItem value="yearly">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="cost" render={({ field }) => (
                                    <FormItem><FormLabel>Cost per Cycle</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="currency" render={({ field }) => (
                                    <FormItem><FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger></FormControl>
                                            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c} — {currencySymbols[c]}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="startDate" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="endDate" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>End Date</FormLabel>
                                        <FormControl><DatePicker date={field.value ?? undefined} setDate={(d) => field.onChange(d ?? null)} /></FormControl>
                                        <p className="text-xs text-muted-foreground">Leave blank for an ongoing subscription.</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="paused">Paused</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="e.g. 500GB total, 20 client slots" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {subscriptionToEdit ? 'Save Changes' : 'Add Subscription'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!subscriptionToDelete} onOpenChange={(open) => !open && setSubscriptionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the subscription. Any products linked to it will keep their link but the subscription will no longer appear.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
