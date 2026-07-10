
'use client';
import { useRequireRole } from '@/hooks/use-require-role';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from '@/components/ui/checkbox';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { TaxRate } from '@/types';
import { MoreHorizontal, PlusCircle, ArrowUpDown } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';

const taxRateSchema = z.object({
  name: z.string().min(1, "Tax rate name is required."),
  rate: z.coerce.number().min(0, "Rate must be a non-negative number."),
  isDefault: z.boolean().optional(),
  jurisdiction: z.string().optional(),
});

type TaxRateFormData = z.infer<typeof taxRateSchema>;

type SortKey = 'name' | 'rate';

function TaxManagementPageInner() {
    const { taxRates, setTaxRates, addActivityLog, user, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [rateToEdit, setRateToEdit] = useState<TaxRate | null>(null);
    const [rateToDelete, setRateToDelete] = useState<TaxRate | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


    const form = useForm<TaxRateFormData>({
        resolver: zodResolver(taxRateSchema),
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';
    
    const sortedAndFilteredTaxRates = useMemo(() => {
        let filtered = taxRates.filter(rate =>
            rate.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        filtered.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        
        return filtered;
    }, [taxRates, searchTerm, sortKey, sortDirection]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                    <CardContent><p>You do not have permission to manage tax settings.</p></CardContent></Card>
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

    const handleOpenForm = (rate: TaxRate | null = null) => {
        setRateToEdit(rate);
        form.reset(rate || { name: '', rate: 0, isDefault: false, jurisdiction: '' });
        setIsFormOpen(true);
    };

    const processSubmit = (data: TaxRateFormData) => {
        setTaxRates(prev => {
            let newRates = [...prev];
            // If setting a new default, unset the old one
            if (data.isDefault) {
                newRates = newRates.map(r => ({ ...r, isDefault: false }));
            }

            if (rateToEdit) {
                newRates = newRates.map(r => r.id === rateToEdit.id ? { ...r, ...data } : r);
                toast({ title: "Tax Rate Updated" });
                addActivityLog('Tax Rate Updated', `Updated rate: ${data.name}`);
            } else {
                const newRate: TaxRate = { id: `tax-${Date.now()}`, ...data };
                newRates.push(newRate);
                toast({ title: "Tax Rate Added" });
                addActivityLog('Tax Rate Added', `Added new rate: ${data.name}`);
            }
            return newRates;
        });

        setIsFormOpen(false);
        setRateToEdit(null);
    };
    
    const handleDelete = () => {
        if (!rateToDelete) return;
        addActivityLog('Tax Rate Deleted', `Deleted rate: ${rateToDelete.name}`);
        setTaxRates(taxRates.filter(r => r.id !== rateToDelete.id));
        toast({ title: "Tax Rate Deleted" });
        setRateToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Tax Management" />
            <Breadcrumb items={[{ label: 'Finance', href: '/accounting' }, { label: 'Tax Management' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                 <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-4 w-4" /> Add Tax Rate
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Name <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('rate')}>Rate (%) <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead>Jurisdiction</TableHead>
                                    <TableHead>Default</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {sortedAndFilteredTaxRates.map(rate => (
                                    <TableRow key={rate.id}>
                                        <TableCell>{rate.name}</TableCell>
                                        <TableCell>{rate.rate}%</TableCell>
                                        <TableCell>{rate.jurisdiction || <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell>{rate.isDefault && <Badge>Default</Badge>}</TableCell>
                                        <TableCell>
                                            <DropdownMenu><DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenForm(rate)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setRateToDelete(rate)}>Delete</DropdownMenuItem>
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
                    <DialogHeader><DialogTitle>{rateToEdit ? 'Edit Tax Rate' : 'Add New Tax Rate'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="rate" render={({ field }) => (
                                <FormItem><FormLabel>Rate (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="jurisdiction" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jurisdiction (optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., matches a store's Tax Jurisdiction field" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="isDefault" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none"><FormLabel>Set as default tax rate</FormLabel></div>
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit">{rateToEdit ? 'Save Changes' : 'Add Rate'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!rateToDelete} onOpenChange={(open) => !open && setRateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the tax rate.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    

    

    


// Permission guard lives in a wrapper so all hooks inside TaxManagementPageInner
// run unconditionally (React rules-of-hooks).
export default function TaxManagementPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <TaxManagementPageInner />;
}
