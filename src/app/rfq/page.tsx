
'use client'

import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from "date-fns";
import { MoreHorizontal, PlusCircle, Trash2, ArrowUpDown } from "@/components/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { useAppContext } from "@/context/AppContext";
import { TableSkeleton } from '@/components/TableSkeleton';
import type { RFQ, RFQItem } from "@/types";
type RFQStatus = RFQ['status'];

const rfqItemSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const rfqSchema = z.object({
  vendorIds: z.array(z.string()).min(1, "At least one vendor must be selected."),
  items: z.array(rfqItemSchema).min(1, "An RFQ must have at least one item."),
});

type RFQFormData = z.infer<typeof rfqSchema>;

type SortKey = 'id' | 'creationDate' | 'status';

const statusVariant: { [key in RFQStatus]: 'default' | 'secondary' | 'outline' } = {
    draft: 'secondary',
    sent: 'default',
    closed: 'outline',
};

export default function RFQPage() {
    const {
        rfqs, setRfqs,
        vendors, products,
        addActivityLog, currentStore, user, isDataLoaded
    } = useAppContext();
    const { toast } = useToast();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [rfqToEdit, setRfqToEdit] = useState<RFQ | null>(null);
    const [rfqToDelete, setRfqToDelete] = useState<RFQ | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('creationDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const form = useForm<RFQFormData>({
        resolver: zodResolver(rfqSchema),
        defaultValues: {
            vendorIds: [],
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });
    
    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const sortedAndFilteredRfqs = useMemo(() => {
        let filtered = rfqs.filter(rfq =>
            rfq.id.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            
            if (sortKey === 'creationDate') {
                 return sortDirection === 'asc' 
                    ? new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime() 
                    : new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [rfqs, searchTerm, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const handleOpenForm = (rfq: RFQ | null = null) => {
        setRfqToEdit(rfq);
        if (rfq) {
            form.reset({
                vendorIds: rfq.vendorIds,
                items: rfq.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
            });
        } else {
            form.reset({
                vendorIds: [],
                items: [{ productId: '', quantity: 1 }],
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = () => {
        if (!rfqToDelete) return;
        setRfqs(rfqs.filter(r => r.id !== rfqToDelete.id));
        addActivityLog('RFQ Deleted', `Deleted RFQ #${rfqToDelete.id}.`);
        toast({ title: "RFQ Deleted" });
        setRfqToDelete(null);
    };

    const onSubmit = (data: RFQFormData) => {
        const newRfqItems: RFQItem[] = data.items.map(item => {
            const product = products.find(p => p.id === item.productId)!;
            return {
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
            };
        });

        if (rfqToEdit) {
            const updatedRfq = {
                ...rfqToEdit,
                items: newRfqItems,
                vendorIds: data.vendorIds,
            };
            setRfqs(rfqs.map(r => r.id === rfqToEdit.id ? updatedRfq : r));
            toast({ title: "RFQ Updated" });
            addActivityLog('RFQ Updated', `Updated RFQ #${rfqToEdit.id}.`);
        } else {
            const newRfq: RFQ = {
                id: `RFQ-${String(rfqs.length + 1).padStart(3, '0')}`,
                storeId: currentStore?.id,
                userId: user?.id,
                userName: user?.name,
                status: 'draft',
                creationDate: format(new Date(), 'yyyy-MM-dd'),
                items: newRfqItems,
                vendorIds: data.vendorIds,
            };
            setRfqs([newRfq, ...rfqs]);
            toast({ title: "RFQ Created" });
            addActivityLog('RFQ Created', `Created RFQ #${newRfq.id}.`);
        }
        setIsFormOpen(false);
        setRfqToEdit(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Request for Quotation" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by RFQ ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    {canManage && (
                        <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                            <PlusCircle className="h-4 w-4" /> Create RFQ
                        </Button>
                    )}
                </div>
                <Card>
                    <CardContent className="p-0">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('id')}>RFQ ID <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('creationDate')}>Date <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('status')}>Status <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead>Vendors</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {sortedAndFilteredRfqs.map(rfq => (
                                    <TableRow key={rfq.id}>
                                        <TableCell className="font-medium">{rfq.id}</TableCell>
                                        <TableCell>{parseISO(rfq.creationDate).toLocaleDateString()}</TableCell>
                                        <TableCell><Badge variant={statusVariant[rfq.status]} className="capitalize">{rfq.status}</Badge></TableCell>
                                        <TableCell>{rfq.vendorIds.length}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!canManage}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenForm(rfq)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setRfqToDelete(rfq)}>Delete</DropdownMenuItem>
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{rfqToEdit ? 'Edit RFQ' : 'Create RFQ'}</DialogTitle>
                        <DialogDescription>{rfqToEdit ? 'Update details.' : 'Fill out the form to create a new RFQ.'}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <div className="space-y-2">
                                <FormLabel>Items</FormLabel>
                                <div className="space-y-2 rounded-lg border p-2">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex items-end gap-2">
                                        <FormField control={form.control} name={`items.${index}.productId`} render={({ field }) => (
                                            <FormItem className="flex-1"><FormControl>
                                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                            <FormItem className="w-24"><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1 })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                                </Button>
                                </div>
                                <FormMessage>{form.formState.errors.items?.message}</FormMessage>
                            </div>

                             <FormField
                                control={form.control}
                                name="vendorIds"
                                render={() => (
                                    <FormItem>
                                    <FormLabel>Vendors to Request From</FormLabel>
                                    <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                                        {vendors.map((vendor) => (
                                        <FormField
                                            key={vendor.id}
                                            control={form.control}
                                            name="vendorIds"
                                            render={({ field }) => {
                                            return (
                                                <FormItem
                                                key={vendor.id}
                                                className="flex flex-row items-center space-x-3 space-y-0"
                                                >
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(vendor.id)}
                                                        onCheckedChange={(checked) => {
                                                            const currentValues = field.value || [];
                                                            const newValue = checked
                                                            ? [...currentValues, vendor.id]
                                                            : currentValues.filter(
                                                                (value) => value !== vendor.id
                                                                );
                                                            field.onChange(newValue);
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">
                                                    {vendor.name}
                                                </FormLabel>
                                                </FormItem>
                                            )
                                            }}
                                        />
                                        ))}
                                    </div>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit">{rfqToEdit ? 'Save Changes' : 'Create RFQ'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!rfqToDelete} onOpenChange={(open) => !open && setRfqToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete RFQ #{rfqToDelete?.id}.</AlertDialogDescription>
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

    

    