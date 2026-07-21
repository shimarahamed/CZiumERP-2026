
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CustomFieldsFormSection } from "@/components/custom-fields/CustomFields";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { CSVExportButton } from '@/components/CSVExportButton';
import { formatNumber } from '@/lib/money';
import { TableSkeleton } from "@/components/TableSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Customer, Invoice, CustomerTier } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { MoreHorizontal, PlusCircle, ArrowUpDown, Sparkles, Loader2, Eye, Pencil, Trash2, Upload } from '@/components/icons';
import Link from 'next/link';
import { RowContextMenu } from '@/components/RowContextMenu';
import { usePageKeyboard } from '@/hooks/use-page-keyboard';
import { Textarea } from '@/components/ui/textarea';
import { useFirestoreQuery } from '@/hooks/use-firestore-query';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, type Query } from 'firebase/firestore';
import { enrichLead } from '@/ai/flows/enrich-lead-flow';
import { Separator } from '@/components/ui/separator';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const CUSTOMERS_COLUMNS: ColumnDef[] = [
    { id: 'name', label: 'Customer', locked: true },
    { id: 'tier', label: 'Tier' },
    { id: 'loyaltyPoints', label: 'Loyalty Points' },
    { id: 'email', label: 'Email' },
];

const customerSchema = z.object({
    name: z.string().min(1, "Name is required."),
    email: z.union([z.literal(''), z.string().email("Invalid email address.")]).optional(),
    company: z.string().optional(),
    phone: z.union([z.literal(''), z.string().regex(/^[+\d][\d\s\-().]{6,19}$/, "Enter a valid phone number.")]).optional(),
    billingAddress: z.string().optional(),
    shippingAddress: z.string().optional(),
    customerCode: z.string().optional(),
    taxVatNumber: z.string().optional(),
    paymentTerms: z.string().optional(),
    creditLimit: z.coerce.number().min(0).optional(),
    salesperson: z.string().optional(),
    notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

type SortKey = 'name' | 'tier' | 'loyaltyPoints';

const statusVariant: { [key in Invoice['status']]: 'default' | 'secondary' | 'destructive' } = {
    paid: 'default',
    pending: 'secondary',
    overdue: 'destructive',
    refunded: 'secondary',
    'partially-refunded': 'secondary',
    'pending-approval': 'secondary',
};

const tierVariant: { [key in CustomerTier]: 'secondary' | 'default' | 'outline' } = {
    Bronze: 'secondary',
    Silver: 'default',
    Gold: 'outline'
};


export default function CustomersPage() {
  usePageTitle('Customers');
    const { setCustomers, invoices, addActivityLog, currencySymbol, user, themeSettings, customers, isDataLoaded, tenantId } = useAppContext();
    const { toast } = useToast();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [customData, setCustomData] = useState<Record<string, unknown>>({});
    
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 250);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
    const [enrichingCustomerId, setEnrichingCustomerId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const form = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cashier';
    const canEdit = canManage;
    const canAdd = canManage;
    const columnVisibility = useColumnVisibility('customers', CUSTOMERS_COLUMNS);
    const { isVisible } = columnVisibility;

    const customersQuery = useMemo(() => {
        // Firestore does not support sorting by 'tier' directly with an index if it's based on a transform.
        // We will handle tier sorting client-side after fetching.
        const firestoreSortKey = sortKey === 'tier' ? 'name' : sortKey;
        if (!tenantId) return null;
        return query(collection(db, 'tenants', tenantId, 'customers'), orderBy(firestoreSortKey, sortDirection)) as Query<Customer>;
    }, [sortKey, sortDirection, tenantId]);

    const { data: serverCustomers } = useFirestoreQuery<Customer>(customersQuery);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };
    
    const handleEnrichCustomer = async (customerId: string) => {
        const customerToEnrich = customers.find(c => c.id === customerId);
        if (!customerToEnrich || !customerToEnrich.company) {
            toast({ variant: 'destructive', title: 'Cannot Enrich Customer', description: 'Customer must have a company name to enrich.'});
            return;
        }

        setEnrichingCustomerId(customerId);
        try {
            const enrichedData = await enrichLead({ name: customerToEnrich.name, company: customerToEnrich.company });
            
            setCustomers(prevCustomers => prevCustomers.map(c => 
                c.id === customerId ? { ...c, enrichedData } : c
            ));

            if (historyCustomer?.id === customerId) {
                setHistoryCustomer(prev => prev ? {...prev, enrichedData} : null);
            }

            toast({ title: 'Customer Enriched!', description: `Successfully found new data for ${customerToEnrich.company}.` });
        } catch (error) {
            console.error("Error enriching customer:", error);
            toast({ variant: 'destructive', title: 'Enrichment Failed', description: 'Could not fetch data for this customer.'});
        } finally {
            setEnrichingCustomerId(null);
        }
    };


    const handleOpenForm = (customer: Customer | null = null) => {
        setCustomerToEdit(customer);
        setCustomData(customer?.customData ?? {});
        if (customer) {
            form.reset(customer);
        } else {
            form.reset({
                name: '', email: '', company: '', phone: '', billingAddress: '', shippingAddress: '',
                customerCode: '', taxVatNumber: '', paymentTerms: '', creditLimit: undefined, salesperson: '', notes: '',
            });
        }
        setIsFormOpen(true);
    };

    usePageKeyboard({ onNew: canAdd ? () => handleOpenForm() : undefined });

    const onSubmit = (data: CustomerFormData) => {
        // Email uniqueness check (only when an email was provided)
        const emailExists = !!data.email && customers.some(c => c.email?.toLowerCase() === data.email!.toLowerCase() && c.id !== customerToEdit?.id);
        if (emailExists) {
            toast({ variant: 'destructive', title: 'Email Already Exists', description: 'A customer with this email already exists.' });
            return;
        }
        const hasCustom = Object.keys(customData).length > 0;
        if (customerToEdit) {
            const updatedCustomers = customers.map(c =>
                c.id === customerToEdit.id ? { ...c, ...data, ...(hasCustom ? { customData } : {}) } : c
            );
            setCustomers(updatedCustomers);
            toast({ title: "Customer Updated", description: `${data.name}'s details have been updated.` });
            addActivityLog('Customer Updated', `Updated customer: ${data.name} (ID: ${customerToEdit.id})`);
        } else {
            const newCustomer: Customer = {
                id: `cust-${Date.now()}`,
                avatar: '',
                ...data,
                ...(hasCustom ? { customData } : {}),
                loyaltyPoints: 0,
                tier: 'Bronze',
            };
            setCustomers([newCustomer, ...customers]);
            toast({ title: "Customer Added", description: `${data.name} has been added.` });
            addActivityLog('Customer Added', `Added new customer: ${data.name}`);
        }
        setIsFormOpen(false);
        setCustomerToEdit(null);
    };

    const handleDelete = () => {
        if (!customerToDelete) return;
        addActivityLog('Customer Deleted', `Deleted customer: ${customerToDelete.name} (ID: ${customerToDelete.id})`);
        setCustomers(customers.filter(c => c.id !== customerToDelete.id));
        toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been deleted.` });
        setCustomerToDelete(null);
    };

    const filteredCustomers = useMemo(() => {
        let filtered = [...serverCustomers];
        
        if (debouncedSearch) {
            const lowercasedFilter = debouncedSearch.toLowerCase();
            filtered = filtered.filter(customer =>
                customer.name.toLowerCase().includes(lowercasedFilter) ||
                (customer.email ?? '').toLowerCase().includes(lowercasedFilter)
            );
        }

        // Handle client-side sorting for the 'tier' key
        if (sortKey === 'tier') {
            const tierOrder = { 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
            filtered.sort((a, b) => {
                const aValue = tierOrder[a.tier || 'Bronze'];
                const bValue = tierOrder[b.tier || 'Bronze'];
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            });
        }
        
        return filtered;
    }, [serverCustomers, debouncedSearch, sortKey, sortDirection]);

    const customerInvoices = historyCustomer ? invoices.filter(invoice => invoice.customerId === historyCustomer.id) : [];

    return (
        <div className="flex flex-col h-full">
            <Header title="Customers" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                 <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Input
                            placeholder="Search customers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                        />
                        <CSVExportButton
                            data={filteredCustomers as unknown as Record<string, unknown>[]}
                            filename="customers"
                            columns={[
                                { key: 'name' as const, label: 'Name' },
                                { key: 'company' as const, label: 'Company' },
                                { key: 'email' as const, label: 'Email' },
                                { key: 'phone' as const, label: 'Phone' },
                                { key: 'tier' as const, label: 'Tier' },
                                { key: 'loyaltyPoints' as const, label: 'Loyalty Points' },
                            ]}
                        />
                        <ColumnVisibilityMenu visibility={columnVisibility} />
                        {canManage && (
                            <Button asChild variant="outline" size="sm" className="gap-1 w-full sm:w-auto">
                                <Link href="/settings/import">
                                    <Upload className="h-4 w-4" />
                                    Import
                                </Link>
                            </Button>
                        )}
                        {canAdd && (
                            <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                                <PlusCircle className="h-4 w-4" />
                                Add Customer
                            </Button>
                        )}
                    </div>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Customer <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    {isVisible('tier') && <TableHead><Button variant="ghost" onClick={() => handleSort('tier')}>Tier <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                                    {isVisible('loyaltyPoints') && <TableHead className="hidden sm:table-cell"><Button variant="ghost" onClick={() => handleSort('loyaltyPoints')}>Loyalty Points <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                                    {isVisible('email') && <TableHead className="hidden md:table-cell">Email</TableHead>}
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                                <TableSkeleton rows={6} cols={5} />
                            ) : (
                            <TableBody>
                                {filteredCustomers.map(customer => (
                                    <RowContextMenu
                                      key={customer.id}
                                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                      items={[
                                        { label: 'View Details', icon: <Eye className="h-4 w-4" />, onClick: () => setHistoryCustomer(customer) },
                                        ...(canEdit ? [{ label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => handleOpenForm(customer) }] : []),
                                        { separator: true as const },
                                        ...(canManage ? [{ label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => setCustomerToDelete(customer), variant: 'destructive' as const }] : []),
                                      ]}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={customer.avatar} alt={customer.name} data-ai-hint="person user" />
                                                    <AvatarFallback>{customer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                   <span className="truncate">{customer.name}</span>
                                                   <div className="text-muted-foreground sm:hidden flex flex-col">
                                                        <span className="truncate">{customer.email}</span>
                                                        <span>{customer.loyaltyPoints || 0} points</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {isVisible('tier') && (
                                            <TableCell>
                                                <Badge
                                                    variant={tierVariant[customer.tier || 'Bronze']}
                                                    className={customer.tier === 'Gold' ? 'border-amber-500 text-amber-600' : ''}
                                                >
                                                    {customer.tier || 'Bronze'}
                                                </Badge>
                                            </TableCell>
                                        )}
                                        {isVisible('loyaltyPoints') && <TableCell className="hidden sm:table-cell">{customer.loyaltyPoints || 0}</TableCell>}
                                        {isVisible('email') && <TableCell className="hidden md:table-cell">{customer.email}</TableCell>}
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
                                                    <DropdownMenuItem onClick={() => setHistoryCustomer(customer)}>View Details & History</DropdownMenuItem>
                                                    {canEdit && <DropdownMenuItem onClick={() => handleOpenForm(customer)}>Edit</DropdownMenuItem>}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleEnrichCustomer(customer.id); }} disabled={!customer.company || enrichingCustomerId === customer.id}>
                                                        {enrichingCustomerId === customer.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                                        Enrich with AI
                                                    </DropdownMenuItem>
                                                    
                                                    {canManage && <DropdownMenuSeparator />}
                                                    {canManage && <DropdownMenuItem className="text-destructive" onClick={() => setCustomerToDelete(customer)}>Delete</DropdownMenuItem>}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </RowContextMenu>
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
                        <DialogTitle>{customerToEdit ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                        <DialogDescription>
                            {customerToEdit ? 'Update customer details.' : 'Fill in the details to add a new customer.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="company" render={({ field }) => (
                                <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem><FormLabel>Phone <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="billingAddress" render={({ field }) => (
                                <FormItem><FormLabel>Billing Address</FormLabel><FormControl><Textarea placeholder="Enter billing address" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="shippingAddress" render={({ field }) => (
                                <FormItem><FormLabel>Shipping Address</FormLabel><FormControl><Textarea placeholder="Enter shipping address" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Additional details (optional)</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="customerCode" render={({ field }) => (
                                        <FormItem><FormLabel>Customer Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="taxVatNumber" render={({ field }) => (
                                        <FormItem><FormLabel>Tax / VAT Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                                        <FormItem><FormLabel>Payment Terms</FormLabel><FormControl><Input placeholder="e.g. Net 30" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="creditLimit" render={({ field }) => (
                                        <FormItem><FormLabel>Credit Limit</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="salesperson" render={({ field }) => (
                                        <FormItem><FormLabel>Salesperson</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <CustomFieldsFormSection entity="customer" value={customData} onChange={setCustomData} />
                            <DialogFooter className="pt-4">
                                <Button type="submit">
                                    {customerToEdit ? 'Save Changes' : 'Add Customer'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the customer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <Dialog open={!!historyCustomer} onOpenChange={(open) => !open && setHistoryCustomer(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Details for {historyCustomer?.name}</DialogTitle>
                        <DialogDescription>
                            Company: {historyCustomer?.company || 'N/A'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        {historyCustomer?.enrichedData && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-lg flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Enriched Data</h3>
                                <Card>
                                    <CardContent className="p-4 text-sm space-y-2">
                                        <p><strong>Industry:</strong> {historyCustomer.enrichedData.industry}</p>
                                        {historyCustomer.enrichedData.companySize && <p><strong>Company Size:</strong> ~{historyCustomer.enrichedData.companySize} employees</p>}
                                        <p><strong>Summary:</strong> {historyCustomer.enrichedData.summary}</p>
                                    </CardContent>
                                </Card>
                                <Separator />
                            </div>
                        )}
                        <div>
                            <h3 className="font-semibold text-lg">Purchase History</h3>
                            {customerInvoices.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Invoice ID</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customerInvoices.map(invoice => (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-medium">{invoice.id}</TableCell>
                                                <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                                                <TableCell>{currencySymbol} {formatNumber(invoice.amount)}</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={invoice.status} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-muted-foreground pt-4">No invoices found for this customer.</p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}


