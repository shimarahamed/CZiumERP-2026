
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Upload } from "@/components/icons";
import Link from 'next/link';
import { RowContextMenu } from '@/components/RowContextMenu';
import { usePageKeyboard } from '@/hooks/use-page-keyboard';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import type { Vendor } from '@/types';
import { useFirestoreQuery } from '@/hooks/use-firestore-query';
import { TableSkeleton } from '@/components/TableSkeleton';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, type Query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { sendDepartmentEmail } from '@/lib/email';

const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required.").regex(/^[+\d][\d\s\-().]{6,19}$/, "Enter a valid phone number."),
  leadTimeDays: z.coerce.number().int().min(0, "Lead time must be a non-negative number.").optional(),
});

type VendorFormData = z.infer<typeof vendorSchema>;

export default function VendorsPage() {
  usePageTitle('Vendors');
    const { addActivityLog, user, purchaseOrders, currencySymbol, currentStore, tenantId, smtpConfigList, emailTemplates, setEmailLogs, companyName } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [vendorToEdit, setVendorToEdit] = useState<Vendor | null>(null);
    const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<VendorFormData>({
        resolver: zodResolver(vendorSchema),
        defaultValues: {
            name: '',
            contactPerson: '',
            email: '',
            phone: '',
            leadTimeDays: 0,
        }
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const vendorsQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(collection(db, 'tenants', tenantId, 'vendors'), orderBy('name', 'asc')) as Query<Vendor>;
    }, [tenantId]);

    const { data: serverVendors, isLoading: isVendorsLoading } = useFirestoreQuery<Vendor>(vendorsQuery);

    const vendorStats = useMemo(() => {
        const stats = new Map<string, { totalOrders: number; totalSpent: number }>();
        purchaseOrders.forEach(po => {
            if (!stats.has(po.vendorId)) {
                stats.set(po.vendorId, { totalOrders: 0, totalSpent: 0 });
            }
            const currentStats = stats.get(po.vendorId)!;
            currentStats.totalOrders += 1;
            currentStats.totalSpent += po.totalCost;
        });
        return stats;
    }, [purchaseOrders]);
    
    const filteredVendors = useMemo(() => {
        let result = serverVendors.filter(vendor =>
            currentStore?.id === 'all' || !vendor.storeId || vendor.storeId === currentStore?.id
        );
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            result = result.filter(vendor =>
                vendor.name.toLowerCase().includes(lowercasedFilter) ||
                vendor.contactPerson.toLowerCase().includes(lowercasedFilter) ||
                vendor.email.toLowerCase().includes(lowercasedFilter)
            );
        }
        return result;
    }, [serverVendors, searchTerm, currentStore]);

    const handleOpenForm = (vendor: Vendor | null = null) => {
        setVendorToEdit(vendor);
        if (vendor) {
            form.reset({
                ...vendor,
                leadTimeDays: vendor.leadTimeDays ?? 0,
            });
        } else {
            form.reset({ name: '', contactPerson: '', email: '', phone: '', leadTimeDays: 0 });
        }
        setIsFormOpen(true);
    };

    usePageKeyboard({ onNew: canManage ? () => handleOpenForm() : undefined });

    const onSubmit = async (data: VendorFormData) => {
        try {
            if (!tenantId) {
                toast({ variant: 'destructive', title: "Error", description: "Tenant information not available." });
                return;
            }
            if (vendorToEdit) {
                const vendorRef = doc(db, "tenants", tenantId, "vendors", vendorToEdit.id);
                await setDoc(vendorRef, data, { merge: true });
                toast({ title: "Vendor Updated", description: `${data.name} has been updated.` });
                addActivityLog('Vendor Updated', `Updated vendor: ${data.name} (ID: ${vendorToEdit.id})`);
            } else {
                const newVendorId = `vend-${Date.now()}`;
                const vendorRef = doc(db, "tenants", tenantId, "vendors", newVendorId);
                const newVendor: Vendor = {
                    id: newVendorId,
                    storeId: currentStore?.id,
                    ...data,
                };
                await setDoc(vendorRef, newVendor);
                toast({ title: "Vendor Added", description: `${data.name} has been added.` });
                addActivityLog('Vendor Added', `Added new vendor: ${data.name}`);
                void sendDepartmentEmail(
                    { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                    'Supply Chain',
                    'vendor-onboarding',
                    data.email,
                    { vendorName: data.name, contactPerson: data.contactPerson, companyName },
                    user?.name ?? 'system'
                );
            }
            setIsFormOpen(false);
            setVendorToEdit(null);
        } catch (error) {
            console.error("Error saving vendor:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save vendor details." });
        }
    };
    
    const handleDelete = async () => {
        if (!vendorToDelete || !tenantId) return;
        try {
            const vendorRef = doc(db, "tenants", tenantId, "vendors", vendorToDelete.id);
            await deleteDoc(vendorRef);
            toast({ title: "Vendor Deleted", description: `${vendorToDelete.name} has been deleted.` });
            addActivityLog('Vendor Deleted', `Deleted vendor: ${vendorToDelete.name} (ID: ${vendorToDelete.id})`);
        } catch (error) {
            console.error("Error deleting vendor:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not delete vendor." });
        } finally {
            setVendorToDelete(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Vendors" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                                <CardTitle>Vendor Management</CardTitle>
                                <CardDescription>Manage your product suppliers and view their order history.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <Input
                                    placeholder="Search by name, contact, or email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                                />
                                {canManage && (
                                    <Button asChild variant="outline" size="sm" className="gap-1 w-full sm:w-auto">
                                        <Link href="/settings/import">
                                            <Upload className="h-4 w-4" />
                                            Import
                                        </Link>
                                    </Button>
                                )}
                                {canManage && (
                                    <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                                        <PlusCircle className="h-4 w-4" />
                                        Add Vendor
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Contact Person</TableHead>
                                    <TableHead className="hidden md:table-cell text-right">Total Orders</TableHead>
                                    <TableHead className="hidden md:table-cell text-right">Total Spent</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {isVendorsLoading ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {filteredVendors.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No vendors found.</TableCell></TableRow>
                                )}
                                {filteredVendors.map(vendor => {
                                    const stats = vendorStats.get(vendor.id) || { totalOrders: 0, totalSpent: 0 };
                                    return (
                                        <RowContextMenu
                                          key={vendor.id}
                                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                          items={[
                                            ...(canManage ? [{ label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => handleOpenForm(vendor) }] : []),
                                            { separator: true as const },
                                            ...(canManage ? [{ label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => setVendorToDelete(vendor), variant: 'destructive' as const }] : []),
                                          ]}
                                        >
                                            <TableCell className="font-medium truncate">{vendor.name}</TableCell>
                                            <TableCell>
                                                <div className="truncate">{vendor.contactPerson}</div>
                                                <div className="text-sm text-muted-foreground md:hidden">
                                                    {stats.totalOrders} POs ({currencySymbol} {stats.totalSpent.toFixed(2)})
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-right">{stats.totalOrders}</TableCell>
                                            <TableCell className="hidden md:table-cell text-right">{currencySymbol} {stats.totalSpent.toFixed(2)}</TableCell>
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
                                                        <DropdownMenuItem onClick={() => handleOpenForm(vendor)} disabled={!canManage}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setVendorToDelete(vendor)} disabled={!canManage}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </RowContextMenu>
                                    )
                                })}
                            </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{vendorToEdit ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
                        <DialogDescription>
                            {vendorToEdit ? 'Update the details of your vendor.' : 'Fill out the form to add a new vendor.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Vendor Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="contactPerson" render={({ field }) => (
                                <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                 <FormField control={form.control} name="leadTimeDays" render={({ field }) => (
                                    <FormItem><FormLabel>Lead Time (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <DialogFooter>
                                <Button type="submit">{vendorToEdit ? 'Save Changes' : 'Add Vendor'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!vendorToDelete} onOpenChange={(open) => !open && setVendorToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the vendor.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


