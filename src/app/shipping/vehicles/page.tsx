
'use client'

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { Asset, AssetStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, PlusCircle } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';

const vehicleSchema = z.object({
  name: z.string().min(1, "Vehicle name is required."),
  serialNumber: z.string().min(1, "License plate or VIN is required."),
  purchaseDate: z.date({ required_error: "Purchase date is required." }),
  purchaseCost: z.coerce.number().min(0, "Cost must be a non-negative number."),
  status: z.enum(['in-use', 'in-storage', 'under-maintenance', 'retired']),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

const statusVariant: { [key in AssetStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'in-use': 'default',
    'in-storage': 'secondary',
    'under-maintenance': 'outline',
    'retired': 'destructive'
};


export default function VehiclesPage() {
    const { assets, setAssets, addActivityLog, currencySymbol, user: currentUser, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [vehicleToEdit, setVehicleToEdit] = useState<Asset | null>(null);
    const [vehicleToDelete, setVehicleToDelete] = useState<Asset | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<VehicleFormData>({
        resolver: zodResolver(vehicleSchema),
    });

    const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';
    
    const vehicles = useMemo(() => assets.filter(a => a.category === 'Vehicle'), [assets]);

    const filteredVehicles = useMemo(() => {
        if (!searchTerm) return vehicles;
        const lowercasedFilter = searchTerm.toLowerCase();
        return vehicles.filter(v =>
            v.name.toLowerCase().includes(lowercasedFilter) ||
            (v.serialNumber && v.serialNumber.toLowerCase().includes(lowercasedFilter))
        );
    }, [vehicles, searchTerm]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader><CardContent><p>You do not have permission to manage the vehicle fleet.</p></CardContent></Card></main>
            </div>
        );
    }

    const handleOpenForm = (vehicle: Asset | null = null) => {
        setVehicleToEdit(vehicle);
        if (vehicle) {
            form.reset({
                ...vehicle,
                purchaseDate: parseISO(vehicle.purchaseDate),
            });
        } else {
            form.reset({
                name: '',
                serialNumber: '',
                purchaseDate: new Date(),
                purchaseCost: 0,
                status: 'in-use',
            });
        }
        setIsFormOpen(true);
    };

    const onSubmit = (data: VehicleFormData) => {
        const assetData = {
          category: 'Vehicle',
          location: 'Fleet',
          ...data,
          purchaseDate: format(data.purchaseDate, 'yyyy-MM-dd'),
        };

        if (vehicleToEdit) {
            setAssets(assets.map(a => a.id === vehicleToEdit.id ? { ...a, ...assetData } : a));
            toast({ title: "Vehicle Updated" });
            addActivityLog('Vehicle Updated', `Updated vehicle: ${data.name}`);
        } else {
            const newAsset: Asset = { id: `asset-${Date.now()}`, ...assetData, };
            setAssets([newAsset, ...assets]);
            toast({ title: "Vehicle Added" });
            addActivityLog('Vehicle Added', `Added new vehicle: ${data.name}`);
        }
        setIsFormOpen(false);
    };
    
    const handleDelete = () => {
        if (!vehicleToDelete) return;
        addActivityLog('Vehicle Deleted', `Deleted vehicle: ${vehicleToDelete.name}`);
        setAssets(assets.filter(a => a.id !== vehicleToDelete.id));
        toast({ title: "Vehicle Deleted" });
        setVehicleToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Fleet Management" />
            <Breadcrumb items={[{ label: 'Shipping & Logistics', href: '/shipping' }, { label: 'Fleet Management' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by name or license..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-4 w-4" />
                        Add Vehicle
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vehicle Name</TableHead>
                                    <TableHead>License / VIN</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={4} />
                            ) : (
                            <TableBody>
                                {filteredVehicles.map(vehicle => (
                                        <TableRow key={vehicle.id}>
                                            <TableCell className="font-medium">{vehicle.name}</TableCell>
                                            <TableCell>{vehicle.serialNumber}</TableCell>
                                            <TableCell><Badge variant={statusVariant[vehicle.status]} className="capitalize">{vehicle.status.replace('-', ' ')}</Badge></TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleOpenForm(vehicle)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setVehicleToDelete(vehicle)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                )}
                            </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{vehicleToEdit ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Vehicle Name/Identifier</FormLabel><FormControl><Input placeholder="e.g. Delivery Van 01" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="serialNumber" render={({ field }) => (
                                <FormItem><FormLabel>License Plate / VIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Purchase Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="purchaseCost" render={({ field }) => (
                                    <FormItem><FormLabel>Purchase Cost ({currencySymbol})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="in-use">In Use</SelectItem>
                                            <SelectItem value="in-storage">In Storage</SelectItem>
                                            <SelectItem value="under-maintenance">Under Maintenance</SelectItem>
                                            <SelectItem value="retired">Retired</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit">{vehicleToEdit ? 'Save Changes' : 'Add Vehicle'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!vehicleToDelete} onOpenChange={(open) => !open && setVehicleToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the vehicle record.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


