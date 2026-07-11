
'use client'

import { useState, useMemo } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MoreHorizontal, PlusCircle, Store, CheckCircle, ArrowUpDown } from "@/components/icons";
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
import { useAppContext } from '@/context/AppContext';
import type { Currency, Store as StoreType } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const STORES_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Store Name', locked: true },
  { id: 'status', label: 'Status' },
  { id: 'address', label: 'Address' },
  { id: 'currency', label: 'Currency' },
  { id: 'taxJurisdiction', label: 'Tax Jurisdiction' },
];

const CURRENCIES: Currency[] = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'];

const storeSchema = z.object({
  name: z.string().min(1, "Store name is required."),
  address: z.string().min(1, "Address is required."),
  functionalCurrency: z.string().optional(),
  taxJurisdiction: z.string().optional(),
});

type StoreFormData = z.infer<typeof storeSchema>;
type SortKey = 'name' | 'address';

function StoresPageInner() {
    const { stores, setStores, addActivityLog, user: currentUser, currentStore, selectStore, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const router = useRouter();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [storeToEdit, setStoreToEdit] = useState<StoreType | null>(null);
    const [storeToDelete, setStoreToDelete] = useState<StoreType | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const columnVisibility = useColumnVisibility('stores', STORES_COLUMNS);
    const { isVisible } = columnVisibility;


    const form = useForm<StoreFormData>({
        resolver: zodResolver(storeSchema),
    });

    const canManageStores = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    const filteredStores = useMemo(() => {
        let sortedStores = [...stores].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        if (!searchTerm) return sortedStores;
        
        const lowercasedFilter = searchTerm.toLowerCase();
        return sortedStores.filter(store =>
            store.name.toLowerCase().includes(lowercasedFilter) ||
            store.address.toLowerCase().includes(lowercasedFilter)
        );
    }, [stores, searchTerm, sortKey, sortDirection]);

    if (!canManageStores) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Permission Required</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>You do not have permission to view or manage stores. Please contact an administrator.</p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleOpenForm = (store: StoreType | null = null) => {
        setStoreToEdit(store);
        if (store) {
            form.reset({ name: store.name, address: store.address, functionalCurrency: store.functionalCurrency ?? '', taxJurisdiction: store.taxJurisdiction ?? '' });
        } else {
            form.reset({ name: '', address: '', functionalCurrency: '', taxJurisdiction: '' });
        }
        setIsFormOpen(true);
    };

    const handleSelectStore = (storeId: string) => {
        const store = stores.find(s => s.id === storeId);
        if (store && store.id !== currentStore?.id) {
            selectStore(storeId);
            toast({
                title: "Store Switched",
                description: `You are now managing ${store.name}.`,
            });
            router.push('/');
        }
    };

    const onSubmit = (data: StoreFormData) => {
        const functionalCurrency = data.functionalCurrency ? (data.functionalCurrency as Currency) : undefined;
        const taxJurisdiction = data.taxJurisdiction || undefined;
        if (storeToEdit) {
            const updatedStores = stores.map(s => s.id === storeToEdit.id ? { ...s, name: data.name, address: data.address, functionalCurrency, taxJurisdiction } : s);
            setStores(updatedStores);
            toast({ title: "Store Updated", description: `The details for ${data.name} have been updated.` });
            addActivityLog('Store Updated', `Updated store: ${data.name} (ID: ${storeToEdit.id})`);
        } else {
            const newStore: StoreType = {
                id: `store-${Date.now()}`,
                name: data.name,
                address: data.address,
                functionalCurrency,
                taxJurisdiction,
            };
            setStores([newStore, ...stores]);
            toast({ title: "Store Added", description: `${data.name} has been added.` });
            addActivityLog('Store Added', `Added new store: ${data.name}`);
        }
        setIsFormOpen(false);
        setStoreToEdit(null);
    };
    
    const confirmDelete = () => {
        if (!storeToDelete) return;
        if (storeToDelete.id === currentStore?.id) {
            toast({ variant: 'destructive', title: 'Action Forbidden', description: 'You cannot delete the currently active store.' });
            setStoreToDelete(null);
            return;
        }
        if (stores.length <= 1) {
            toast({ variant: 'destructive', title: 'Action Forbidden', description: 'You cannot delete the last remaining store.' });
            setStoreToDelete(null);
            return;
        }

        addActivityLog('Store Deleted', `Deleted store: ${storeToDelete.name} (ID: ${storeToDelete.id})`);
        setStores(stores.filter(s => s.id !== storeToDelete.id));
        toast({ title: "Store Deleted", description: `${storeToDelete.name} has been deleted.` });
        setStoreToDelete(null);
    };


    return (
        <div className="flex flex-col h-full">
            <Header title="Store Management" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by name or address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    <ColumnVisibilityMenu visibility={columnVisibility} />
                    <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-4 w-4" />
                        Add Store
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {isVisible('status') && <TableHead className="w-[100px]">Status</TableHead>}
                                        <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Store Name <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        {isVisible('address') && <TableHead><Button variant="ghost" onClick={() => handleSort('address')}>Address <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                                        {isVisible('currency') && <TableHead>Currency</TableHead>}
                                        {isVisible('taxJurisdiction') && <TableHead>Tax Jurisdiction</TableHead>}
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                {!isDataLoaded ? (
                                  <TableSkeleton rows={8} cols={6} />
                                ) : (
                                <TableBody>
                                    {filteredStores.map(store => (
                                        <TableRow
                                            key={store.id}
                                            className={cn(
                                                store.id === currentStore?.id && 'bg-muted/50'
                                            )}
                                        >
                                            {isVisible('status') && (
                                            <TableCell>
                                                {store.id === currentStore?.id ? (
                                                    <Badge variant="default" className="gap-1.5 pl-2 pr-3">
                                                        <CheckCircle className="h-3.5 w-3.5"/>
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={() => handleSelectStore(store.id)}>
                                                        Select
                                                    </Button>
                                                )}
                                            </TableCell>
                                            )}
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <Store className="h-4 w-4 text-muted-foreground"/>
                                                <span>{store.name}</span>
                                            </TableCell>
                                            {isVisible('address') && <TableCell>{store.address}</TableCell>}
                                            {isVisible('currency') && <TableCell>{store.functionalCurrency ?? <span className="text-muted-foreground">—</span>}</TableCell>}
                                            {isVisible('taxJurisdiction') && <TableCell>{store.taxJurisdiction ?? <span className="text-muted-foreground">—</span>}</TableCell>}
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            aria-haspopup="true"
                                                            size="icon"
                                                            variant="ghost"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleOpenForm(store)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => setStoreToDelete(store)}
                                                            disabled={store.id === currentStore?.id || stores.length <= 1}
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                )}
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{storeToEdit ? 'Edit Store' : 'Add New Store'}</DialogTitle>
                        <DialogDescription>
                            {storeToEdit ? 'Update the details of your store.' : 'Fill out the form to add a new store.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Store Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea placeholder="123 Main St, Anytown, USA" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="functionalCurrency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Functional Currency (optional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Use tenant default" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Label className="text-xs text-muted-foreground font-normal">Transactions posted to this store in a different currency will be converted at posting time.</Label>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="taxJurisdiction" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tax Jurisdiction (optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., CA, EU-VAT, UAE" {...field} /></FormControl>
                                    <Label className="text-xs text-muted-foreground font-normal">Invoices for this store auto-select the Tax Rate with a matching jurisdiction, if one exists.</Label>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit">{storeToEdit ? 'Save Changes' : 'Add Store'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!storeToDelete} onOpenChange={(open) => !open && setStoreToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the store.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    

    


// Permission guard lives in a wrapper so all hooks inside StoresPageInner
// run unconditionally (React rules-of-hooks).
export default function StoresPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <StoresPageInner />;
}
