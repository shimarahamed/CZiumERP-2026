
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { Warehouse } from '@/types';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const WAREHOUSES_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Warehouse Name', locked: true },
  { id: 'default', label: 'Default' },
  { id: 'linkedStore', label: 'Linked Store' },
  { id: 'address', label: 'Address' },
];

const warehouseSchema = z.object({
  name: z.string().min(1, "Warehouse name is required."),
  storeId: z.string().optional(),
  address: z.string().optional(),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

function WarehousesPageInner() {
    const { warehouses, setWarehouses, stores, addActivityLog, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [warehouseToEdit, setWarehouseToEdit] = useState<Warehouse | null>(null);
    const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const columnVisibility = useColumnVisibility('warehouses', WAREHOUSES_COLUMNS);
    const { isVisible } = columnVisibility;

    const form = useForm<WarehouseFormData>({
        resolver: zodResolver(warehouseSchema),
        defaultValues: { name: '', storeId: 'none', address: '' },
    });

    const activeWarehouses = useMemo(() => warehouses.filter(w => !w.deletedAt), [warehouses]);

    const filteredWarehouses = useMemo(() => {
        if (!searchTerm) return activeWarehouses;
        const lowered = searchTerm.toLowerCase();
        return activeWarehouses.filter(w =>
            w.name.toLowerCase().includes(lowered) ||
            (w.address ?? '').toLowerCase().includes(lowered)
        );
    }, [activeWarehouses, searchTerm]);

    const handleOpenForm = (warehouse: Warehouse | null = null) => {
        setWarehouseToEdit(warehouse);
        if (warehouse) {
            form.reset({ name: warehouse.name, storeId: warehouse.storeId ?? 'none', address: warehouse.address ?? '' });
        } else {
            form.reset({ name: '', storeId: 'none', address: '' });
        }
        setIsFormOpen(true);
    };

    const onSubmit = (data: WarehouseFormData) => {
        const payload = { name: data.name, storeId: data.storeId === 'none' ? undefined : data.storeId, address: data.address || undefined };
        if (warehouseToEdit) {
            setWarehouses(warehouses.map(w => w.id === warehouseToEdit.id ? { ...w, ...payload } : w));
            toast({ title: "Warehouse Updated", description: `${data.name} has been updated.` });
            addActivityLog('Warehouse Updated', `Updated warehouse: ${data.name} (ID: ${warehouseToEdit.id})`);
        } else {
            const newWarehouse: Warehouse = {
                id: `wh-${Date.now()}`,
                isDefault: activeWarehouses.length === 0,
                ...payload,
            };
            setWarehouses([newWarehouse, ...warehouses]);
            toast({ title: "Warehouse Added", description: `${data.name} has been added.` });
            addActivityLog('Warehouse Added', `Added new warehouse: ${data.name}`);
        }
        setIsFormOpen(false);
        setWarehouseToEdit(null);
    };

    const makeDefault = (warehouse: Warehouse) => {
        setWarehouses(warehouses.map(w => ({ ...w, isDefault: w.id === warehouse.id })));
        addActivityLog('Default Warehouse Changed', `${warehouse.name} is now the default warehouse.`);
        toast({ title: "Default Warehouse Updated", description: `${warehouse.name} is now the default.` });
    };

    const confirmDelete = () => {
        if (!warehouseToDelete) return;
        if (warehouseToDelete.isDefault) {
            toast({ variant: 'destructive', title: 'Action Forbidden', description: 'You cannot delete the default warehouse. Set another warehouse as default first.' });
            setWarehouseToDelete(null);
            return;
        }
        if (activeWarehouses.length <= 1) {
            toast({ variant: 'destructive', title: 'Action Forbidden', description: 'You cannot delete the last remaining warehouse.' });
            setWarehouseToDelete(null);
            return;
        }
        // Soft delete — stock history in StockLevel docs referencing this warehouse stays intact.
        setWarehouses(warehouses.map(w => w.id === warehouseToDelete.id ? { ...w, deletedAt: new Date().toISOString() } : w));
        addActivityLog('Warehouse Deleted', `Deleted warehouse: ${warehouseToDelete.name} (ID: ${warehouseToDelete.id})`);
        toast({ title: "Warehouse Deleted", description: `${warehouseToDelete.name} has been deleted.` });
        setWarehouseToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Warehouse Management" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card className="mb-4">
                    <CardHeader>
                        <CardTitle>Warehouses</CardTitle>
                        <CardDescription>Physical stock-keeping locations. Products track stock separately per warehouse — receive, sell, and count against the right one.</CardDescription>
                    </CardHeader>
                </Card>
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
                        Add Warehouse
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {isVisible('default') && <TableHead className="w-[100px]">Default</TableHead>}
                                        <TableHead>Warehouse Name</TableHead>
                                        {isVisible('linkedStore') && <TableHead>Linked Store</TableHead>}
                                        {isVisible('address') && <TableHead>Address</TableHead>}
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                {!isDataLoaded ? (
                                  <TableSkeleton rows={6} cols={5} />
                                ) : (
                                <TableBody>
                                    {filteredWarehouses.length === 0 && (
                                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No warehouses found.</TableCell></TableRow>
                                    )}
                                    {filteredWarehouses.map(warehouse => (
                                        <TableRow key={warehouse.id}>
                                            {isVisible('default') && (
                                                <TableCell>
                                                    {warehouse.isDefault ? (
                                                        <Badge variant="default" className="gap-1.5 pl-2 pr-3">
                                                            <CheckCircle className="h-3.5 w-3.5"/>
                                                            Default
                                                        </Badge>
                                                    ) : (
                                                        <Button variant="outline" size="sm" onClick={() => makeDefault(warehouse)}>
                                                            Make Default
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <Store className="h-4 w-4 text-muted-foreground"/>
                                                <span>{warehouse.name}</span>
                                            </TableCell>
                                            {isVisible('linkedStore') && <TableCell>{stores.find(s => s.id === warehouse.storeId)?.name ?? '—'}</TableCell>}
                                            {isVisible('address') && <TableCell>{warehouse.address ?? '—'}</TableCell>}
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleOpenForm(warehouse)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => setWarehouseToDelete(warehouse)}
                                                            disabled={warehouse.isDefault || activeWarehouses.length <= 1}
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
                        <DialogTitle>{warehouseToEdit ? 'Edit Warehouse' : 'Add New Warehouse'}</DialogTitle>
                        <DialogDescription>
                            {warehouseToEdit ? 'Update the details of this warehouse.' : 'Fill out the form to add a new warehouse.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Warehouse Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="storeId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Linked Store (optional)</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="address" render={({ field }) => (
                                <FormItem><FormLabel>Address (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="submit">{warehouseToEdit ? 'Save Changes' : 'Add Warehouse'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!warehouseToDelete} onOpenChange={(open) => !open && setWarehouseToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove the warehouse from selection. Its historical stock records are kept.</AlertDialogDescription>
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

// Permission guard lives in a wrapper so all hooks inside WarehousesPageInner
// run unconditionally (React rules-of-hooks).
export default function WarehousesPage() {
  // firestore.rules gates warehouse writes to tenant admins only (creating a location is
  // an admin action, matching how Stores is gated) — the page-level guard mirrors that.
  const isAllowed = useRequireRole(['admin']);
  if (!isAllowed) return null;
  return <WarehousesPageInner />;
}
