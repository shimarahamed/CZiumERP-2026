
'use client'

import { useState, useMemo } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { BillOfMaterials, BOMItem } from '@/types';
import { MoreHorizontal, PlusCircle, Trash2 } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const bomItemSchema = z.object({
  componentId: z.string().min(1, "Please select a component."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

const bomSchema = z.object({
  productId: z.string().min(1, "Please select a finished product."),
  items: z.array(bomItemSchema).min(1, "A Bill of Materials must have at least one component."),
});

type BOMFormData = z.infer<typeof bomSchema>;

function BillOfMaterialsPageInner() {
    const { billsOfMaterials, setBillsOfMaterials, products, addActivityLog, user, currentStore, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [bomToEdit, setBomToEdit] = useState<BillOfMaterials | null>(null);
    const [bomToDelete, setBomToDelete] = useState<BillOfMaterials | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<BOMFormData>({
        resolver: zodResolver(bomSchema),
    });
    
    const selectedProductId = form.watch('productId');

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    // Products that can HAVE a BOM. They can be 'manufactured' or 'standard' (for kits), but not 'component'.
    const manufacturableProducts = useMemo(() => 
        products.filter(p => p.productType !== 'component'), 
    [products]);

    // Products that can BE a component. They can be 'component' or 'standard', but not 'manufactured' (to avoid nested BOMs)
    // and cannot be the product being defined itself.
    const componentProducts = useMemo(() => 
        products.filter(p => 
            p.productType !== 'manufactured' && p.id !== selectedProductId
        ), 
    [products, selectedProductId]);

    const filteredBOMs = useMemo(() => {
        let result = billsOfMaterials.filter(bom =>
            currentStore?.id === 'all' || !bom.storeId || bom.storeId === currentStore?.id
        );
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            result = result.filter(bom => bom.productName.toLowerCase().includes(lowercasedFilter));
        }
        return result;
    }, [billsOfMaterials, searchTerm, currentStore]);

    const handleOpenForm = (bom: BillOfMaterials | null = null) => {
        setBomToEdit(bom);
        if (bom) {
            form.reset({
                productId: bom.productId,
                items: bom.items.map(item => ({ componentId: item.componentId, quantity: item.quantity })),
            });
        } else {
            form.reset({
                productId: '',
                items: [{ componentId: '', quantity: 1 }],
            });
        }
        setIsFormOpen(true);
    };

    const onSubmit = (data: BOMFormData) => {
        const product = products.find(p => p.id === data.productId);
        if (!product) return;

        const bomItems: BOMItem[] = data.items.map(item => {
            const component = products.find(p => p.id === item.componentId)!;
            return {
                componentId: component.id,
                componentName: component.name,
                quantity: item.quantity,
            };
        });

        if (bomToEdit) {
            const updatedBOMs = billsOfMaterials.map(b => b.id === bomToEdit.id ? { ...b, productId: product.id, productName: product.name, items: bomItems } : b);
            setBillsOfMaterials(updatedBOMs);
            toast({ title: "BOM Updated", description: `The Bill of Materials for ${product.name} has been updated.` });
            addActivityLog('BOM Updated', `Updated BOM for ${product.name}`);
        } else {
            const newBOM: BillOfMaterials = {
                id: `bom-${Date.now()}`,
                productId: product.id,
                productName: product.name,
                items: bomItems,
                createdAt: new Date().toISOString(),
                storeId: currentStore?.id,
            };
            setBillsOfMaterials([newBOM, ...billsOfMaterials]);
            toast({ title: "BOM Created", description: `A Bill of Materials has been created for ${product.name}.` });
            addActivityLog('BOM Created', `Created BOM for ${product.name}`);
        }
        setIsFormOpen(false);
        setBomToEdit(null);
    };

    const handleDelete = () => {
        if (!bomToDelete) return;
        addActivityLog('BOM Deleted', `Deleted BOM for ${bomToDelete.productName}`);
        setBillsOfMaterials(billsOfMaterials.filter(b => b.id !== bomToDelete.id));
        toast({ title: "BOM Deleted", description: `The Bill of Materials for ${bomToDelete.productName} has been deleted.` });
        setBomToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Bill of Materials (BOM)" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by product name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    {canManage && (
                        <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                            <PlusCircle className="h-4 w-4" /> Add BOM
                        </Button>
                    )}
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Finished Product</TableHead>
                                    <TableHead>Number of Components</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {filteredBOMs.map(bom => (
                                    <TableRow key={bom.id}>
                                        <TableCell className="font-medium">{bom.productName}</TableCell>
                                        <TableCell>{bom.items.length}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!canManage}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenForm(bom)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setBomToDelete(bom)}>Delete</DropdownMenuItem>
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
                        <DialogTitle>{bomToEdit ? 'Edit Bill of Materials' : 'New Bill of Materials'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <FormField
                                control={form.control}
                                name="productId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Finished Product</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select a manufacturable product" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {manufacturableProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <div className="space-y-2">
                                <FormLabel>Components</FormLabel>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex items-start gap-2 p-2 border rounded-lg">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.componentId`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Select component" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {componentProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem className="w-24">
                                                    <FormControl>
                                                        <Input type="number" placeholder="Qty" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ componentId: '', quantity: 1 })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Component
                                </Button>
                                <FormMessage>{form.formState.errors.items?.message || form.formState.errors.items?.root?.message}</FormMessage>
                            </div>

                            <DialogFooter>
                                <Button type="submit">{bomToEdit ? 'Save Changes' : 'Create BOM'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!bomToDelete} onOpenChange={(open) => !open && setBomToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the Bill of Materials for {bomToDelete?.productName}. This action cannot be undone.</AlertDialogDescription>
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

    




// Permission guard lives in a wrapper so all hooks inside BillOfMaterialsPageInner
// run unconditionally (React rules-of-hooks).
export default function BillOfMaterialsPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'inventory-staff']);
  if (!isAllowed) return null;
  return <BillOfMaterialsPageInner />;
}
