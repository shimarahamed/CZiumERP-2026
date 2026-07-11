
'use client'

import { useState, useMemo } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { useForm } from 'react-hook-form';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { Asset, AssetStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { MoreHorizontal, PlusCircle, ArrowUpDown, Filter } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const ASSETS_COLUMNS: ColumnDef[] = [
    { id: 'name', label: 'Asset Name', locked: true },
    { id: 'category', label: 'Category' },
    { id: 'status', label: 'Status' },
    { id: 'location', label: 'Location' },
    { id: 'assignedTo', label: 'Assigned To' },
];

const assetSchema = z.object({
  name: z.string().min(1, "Asset name is required."),
  category: z.string().min(1, "Category is required."),
  serialNumber: z.string().optional(),
  purchaseDate: z.date({ required_error: "Purchase date is required." }),
  purchaseCost: z.coerce.number().min(0, "Cost must be a non-negative number."),
  status: z.enum(['in-use', 'in-storage', 'under-maintenance', 'retired']),
  location: z.string().min(1, "Location is required."),
  assignedTo: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

type SortKey = keyof Asset | 'assignedUserName';

type Filters = {
    name: string;
    category: string;
    status: AssetStatus | 'all';
    location: string;
    assignedTo: string;
};

const statusVariant: { [key in AssetStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'in-use': 'default',
    'in-storage': 'secondary',
    'under-maintenance': 'outline',
    'retired': 'destructive'
};


function AssetsPageInner() {
    const { assets, setAssets, users, stores, addActivityLog, currencySymbol, user: currentUser, usersMap, storesMap, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
    const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    
    const [filters, setFilters] = useState<Filters>({
        name: '',
        category: '',
        status: 'all',
        location: '',
        assignedTo: '',
    });

    const form = useForm<AssetFormData>({
        resolver: zodResolver(assetSchema),
    });

    const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';
    const columnVisibility = useColumnVisibility('assets', ASSETS_COLUMNS);
    const { isVisible } = columnVisibility;

    const sortedAndFilteredAssets = useMemo(() => {
        let filtered = [...assets].map(asset => {
            const assignedUser = asset.assignedTo ? usersMap.get(asset.assignedTo) : undefined;
            return { ...asset, assignedUserName: assignedUser?.name || 'Unassigned' };
        });

        filtered = filtered.filter(asset => {
            return (
                (filters.name ? asset.name.toLowerCase().includes(filters.name.toLowerCase()) : true) &&
                (filters.category ? asset.category.toLowerCase().includes(filters.category.toLowerCase()) : true) &&
                (filters.status === 'all' || asset.status === filters.status) &&
                (filters.location ? asset.location.toLowerCase().includes(filters.location.toLowerCase()) : true) &&
                (filters.assignedTo ? asset.assignedUserName.toLowerCase().includes(filters.assignedTo.toLowerCase()) : true)
            );
        });

        filtered.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            
            if (sortKey === 'purchaseCost') {
                return sortDirection === 'asc' ? a.purchaseCost - b.purchaseCost : b.purchaseCost - a.purchaseCost;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }

            return 0;
        });

        return filtered;
    }, [assets, usersMap, filters, sortKey, sortDirection]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Card>
                        <CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                        <CardContent><p>You do not have permission to view or manage assets. Please contact an administrator.</p></CardContent>
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

    const handleOpenForm = (asset: Asset | null = null) => {
        setAssetToEdit(asset);
        if (asset) {
            const purchaseDate = parseISO(asset.purchaseDate);
            form.reset({
                ...asset,
                purchaseDate: isValid(purchaseDate) ? purchaseDate : new Date(),
                assignedTo: asset.assignedTo ?? 'none',
            });
        } else {
            form.reset({
                name: '',
                category: '',
                serialNumber: '',
                purchaseDate: new Date(),
                purchaseCost: 0,
                status: 'in-storage',
                location: '',
                assignedTo: 'none',
            });
        }
        setIsFormOpen(true);
    };

    const processSubmit = (data: AssetFormData) => {
        const assetData = {
          ...data,
          purchaseDate: format(data.purchaseDate, 'yyyy-MM-dd'),
          assignedTo: data.assignedTo === 'none' ? undefined : data.assignedTo,
        };

        if (assetToEdit) {
            const updatedAssets = assets.map(a => a.id === assetToEdit.id ? { ...a, ...assetData } : a);
            setAssets(updatedAssets);
            toast({ title: "Asset Updated", description: `${data.name} has been updated.` });
            addActivityLog('Asset Updated', `Updated asset: ${data.name} (ID: ${assetToEdit.id})`);
        } else {
            const newAsset: Asset = {
                id: `asset-${Date.now()}`,
                ...assetData,
            };
            setAssets([newAsset, ...assets]);
            toast({ title: "Asset Added", description: `${data.name} has been added.` });
            addActivityLog('Asset Added', `Added new asset: ${data.name}`);
        }
        setIsFormOpen(false);
        setAssetToEdit(null);
    };
    
    const handleDelete = () => {
        if (!assetToDelete) return;
        addActivityLog('Asset Deleted', `Deleted asset: ${assetToDelete.name} (ID: ${assetToDelete.id})`);
        setAssets(assets.filter(a => a.id !== assetToDelete.id));
        toast({ title: "Asset Deleted", description: `${assetToDelete.name} has been deleted.` });
        setAssetToDelete(null);
    };
    
    const handleFilterChange = (field: keyof Filters, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Asset Management" />
            <Breadcrumb items={[{ label: 'Finance', href: '/accounting/assets' }, { label: 'Asset Management' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Filter className="h-4 w-4" /> Filter
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Filters</h4>
                                    <p className="text-sm text-muted-foreground">Set filters for the asset list.</p>
                                </div>
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="filter-name">Name</Label>
                                        <Input id="filter-name" value={filters.name} onChange={(e) => handleFilterChange('name', e.target.value)} className="col-span-2 h-8" />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="filter-category">Category</Label>
                                        <Input id="filter-category" value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)} className="col-span-2 h-8" />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="filter-status">Status</Label>
                                        <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value as AssetStatus | 'all')}>
                                            <SelectTrigger className="col-span-2 h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                {Object.keys(statusVariant).map(status => (
                                                    <SelectItem key={status} value={status} className="capitalize">{status.replace('-', ' ')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="filter-location">Location</Label>
                                        <Input id="filter-location" value={filters.location} onChange={(e) => handleFilterChange('location', e.target.value)} className="col-span-2 h-8" />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="filter-assignedTo">Assigned To</Label>
                                        <Input id="filter-assignedTo" value={filters.assignedTo} onChange={(e) => handleFilterChange('assignedTo', e.target.value)} className="col-span-2 h-8" />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <ColumnVisibilityMenu visibility={columnVisibility} />
                    <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-4 w-4" />
                        Add Asset
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => handleSort('name')}>
                                            Asset Name <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    {isVisible('category') && (
                                    <TableHead>
                                         <Button variant="ghost" onClick={() => handleSort('category')}>
                                            Category <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    )}
                                    {isVisible('status') && (
                                    <TableHead>
                                         <Button variant="ghost" onClick={() => handleSort('status')}>
                                            Status <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    )}
                                    {isVisible('location') && (
                                    <TableHead className="hidden md:table-cell">
                                        <Button variant="ghost" onClick={() => handleSort('location')}>
                                            Location <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    )}
                                    {isVisible('assignedTo') && (
                                    <TableHead className="hidden md:table-cell">
                                        <Button variant="ghost" onClick={() => handleSort('assignedUserName')}>
                                            Assigned To <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    )}
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {sortedAndFilteredAssets.map(asset => {
                                    const locationName = storesMap.get(asset.location)?.name || asset.location;
                                    return (
                                        <TableRow key={asset.id}>
                                            <TableCell className="font-medium">
                                                {asset.name}
                                                <div className="text-sm text-muted-foreground md:hidden">
                                                    {asset.category}
                                                </div>
                                            </TableCell>
                                            {isVisible('category') && <TableCell className="hidden md:table-cell">{asset.category}</TableCell>}
                                            {isVisible('status') && <TableCell><Badge variant={statusVariant[asset.status]} className="capitalize">{asset.status.replace('-', ' ')}</Badge></TableCell>}
                                            {isVisible('location') && <TableCell className="hidden md:table-cell">{locationName}</TableCell>}
                                            {isVisible('assignedTo') && <TableCell className="hidden md:table-cell">{asset.assignedUserName}</TableCell>}
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
                                                        <DropdownMenuItem onClick={() => handleOpenForm(asset)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setAssetToDelete(asset)}>Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{assetToEdit ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Asset Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="category" render={({ field }) => (
                                    <FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="e.g., IT Equipment" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="serialNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Serial Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Purchase Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="purchaseCost" render={({ field }) => (
                                    <FormItem><FormLabel>Purchase Cost ({currencySymbol})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                 <FormField control={form.control} name="location" render={({ field }) => (
                                    <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g., Head Office or Store ID" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="assignedTo" render={({ field }) => (
                                <FormItem><FormLabel>Assigned To</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Unassigned</SelectItem>
                                            {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )} />
                            
                            <DialogFooter className="pt-4">
                                <Button type="submit">{assetToEdit ? 'Save Changes' : 'Add Asset'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the asset record.</AlertDialogDescription>
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

    



// Permission guard lives in a wrapper so all hooks inside AssetsPageInner
// run unconditionally (React rules-of-hooks).
export default function AssetsPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <AssetsPageInner />;
}
