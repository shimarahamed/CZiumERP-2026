
'use client'

import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { ITAsset, AssetStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid } from 'date-fns';
import { MoreHorizontal, PlusCircle, ArrowUpDown, Filter, Search } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import ITAssetDetail from '@/components/ITAssetDetail';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/TableSkeleton';

const itAssetSchema = z.object({
  // Core
  name: z.string().min(1, "Asset name is required."),
  category: z.string().min(1, "Category is required."),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().min(1, "Serial number is required."),
  description: z.string().optional(),

  // Assignment
  assignedTo: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  
  // Procurement
  purchaseDate: z.date({ required_error: "Purchase date is required." }),
  purchaseCost: z.coerce.number().min(0, "Cost must be a non-negative number."),
  vendorId: z.string().optional(),
  warrantyExpiration: z.date().optional().nullable(),
});

type ITAssetFormData = z.infer<typeof itAssetSchema>;

type SortKey = keyof ITAsset | 'assignedUserName';

type Filters = {
    status: AssetStatus | 'all';
    location: string;
};

const statusVariant: { [key in AssetStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    'in-use': 'default',
    'in-storage': 'secondary',
    'under-maintenance': 'outline',
    'retired': 'destructive'
};


export default function ITAssetsPage() {
    const { itAssets, setItAssets, employees, vendors, addActivityLog, currencySymbol, user: currentUser, currentStore, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [assetToEdit, setAssetToEdit] = useState<ITAsset | null>(null);
    const [assetToDelete, setAssetToDelete] = useState<ITAsset | null>(null);
    const [assetToView, setAssetToView] = useState<ITAsset | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [comboboxSearch, setComboboxSearch] = useState('');
    
    const [filters, setFilters] = useState<Filters>({
        status: 'all',
        location: '',
    });

    const form = useForm<ITAssetFormData>({
        resolver: zodResolver(itAssetSchema),
    });
    
    const canManage = currentUser?.role === 'admin' || currentUser?.role === 'manager';

    const employeeOptions = useMemo(() => 
        [{ label: 'Unassigned', value: 'unassigned' }, ...employees.map(e => ({ label: e.name, value: e.id }))]
    , [employees]);

    const filteredEmployeeOptions = useMemo(() => 
        employeeOptions.filter(e => e.label.toLowerCase().includes(comboboxSearch.toLowerCase()))
    , [employeeOptions, comboboxSearch]);

    const sortedAndFilteredAssets = useMemo(() => {
        let filtered = [...itAssets].filter(asset =>
            currentStore?.id === 'all' || !asset.storeId || asset.storeId === currentStore?.id
        ).map(asset => {
            const assignedUser = employees.find(u => u.id === asset.assignedTo);
            return { ...asset, assignedUserName: assignedUser?.name || 'Unassigned' };
        });

        const lowercasedSearchTerm = searchTerm.toLowerCase();
        
        filtered = filtered.filter(asset => {
            const matchesSearch = searchTerm ? (
                asset.name.toLowerCase().includes(lowercasedSearchTerm) ||
                asset.serialNumber.toLowerCase().includes(lowercasedSearchTerm) ||
                asset.category.toLowerCase().includes(lowercasedSearchTerm)
            ) : true;

            const matchesFilters = (
                (filters.status === 'all' || asset.status === filters.status) &&
                (filters.location ? asset.location?.toLowerCase().includes(filters.location.toLowerCase()) : true)
            );

            return matchesSearch && matchesFilters;
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
    }, [itAssets, employees, filters, sortKey, sortDirection, searchTerm, currentStore?.id]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full"><Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage IT assets.</p></CardContent></Card></main>
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

    const handleOpenForm = (asset: ITAsset | null = null) => {
        setAssetToEdit(asset);
        if (asset) {
            form.reset({
                ...asset,
                purchaseDate: isValid(parseISO(asset.purchaseDate)) ? parseISO(asset.purchaseDate) : new Date(),
                warrantyExpiration: asset.warrantyExpiration && isValid(parseISO(asset.warrantyExpiration)) ? parseISO(asset.warrantyExpiration) : null,
                assignedTo: asset.assignedTo ?? 'unassigned',
                vendorId: asset.vendorId ?? 'unassigned',
            });
        } else {
            form.reset({
                name: '', category: '', manufacturer: '', model: '', serialNumber: '', description: '',
                assignedTo: 'unassigned', department: '', location: '',
                purchaseDate: new Date(), purchaseCost: 0, vendorId: 'unassigned', warrantyExpiration: null,
            });
        }
        setIsFormOpen(true);
    };

    const processSubmit = (data: ITAssetFormData) => {
        const assetData = {
          ...data,
          purchaseDate: format(data.purchaseDate, 'yyyy-MM-dd'),
          warrantyExpiration: data.warrantyExpiration ? format(data.warrantyExpiration, 'yyyy-MM-dd') : undefined,
          assignedTo: data.assignedTo === 'unassigned' ? undefined : data.assignedTo,
          vendorId: data.vendorId === 'unassigned' ? undefined : data.vendorId,
        };

        if (assetToEdit) {
            const updatedAssets = itAssets.map(a => a.id === assetToEdit.id ? { ...a, ...assetData } : a);
            setItAssets(updatedAssets);
            toast({ title: "IT Asset Updated", description: `${data.name} has been updated.` });
            addActivityLog('IT Asset Updated', `Updated IT asset: ${data.name} (ID: ${assetToEdit.id})`);
        } else {
            const newAsset: ITAsset = {
                id: `itasset-${Date.now()}`,
                status: 'in-storage',
                ...assetData,
            };
            setItAssets([newAsset, ...itAssets]);
            toast({ title: "IT Asset Added", description: `${data.name} has been added.` });
            addActivityLog('IT Asset Added', `Added new IT asset: ${data.name}`);
        }
        setIsFormOpen(false);
        setAssetToEdit(null);
    };
    
    const handleDelete = () => {
        if (!assetToDelete) return;
        addActivityLog('IT Asset Deleted', `Deleted asset: ${assetToDelete.name} (ID: ${assetToDelete.id})`);
        setItAssets(itAssets.filter(a => a.id !== assetToDelete.id));
        toast({ title: "IT Asset Deleted", description: `${assetToDelete.name} has been deleted.` });
        setAssetToDelete(null);
    };
    
    const handleFilterChange = (field: keyof Omit<Filters, 'assignedTo'>, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleUpdateAssetFromDetail = (updatedAsset: ITAsset) => {
        setItAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="IT Asset Management" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                                <CardTitle>IT Assets</CardTitle>
                                <CardDescription>A centralized inventory of all IT hardware and equipment.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="search" 
                                        placeholder="Search by name, S/N, category..." 
                                        className="pl-8 sm:w-[300px]"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="gap-2">
                                            <Filter className="h-4 w-4" /> Filter
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <div className="grid gap-4">
                                            <div className="space-y-2"><h4 className="font-medium leading-none">Filters</h4><p className="text-sm text-muted-foreground">Set additional filters for the asset list.</p></div>
                                            <div className="grid gap-2">
                                                <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="filter-status">Status</Label>
                                                    <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value as AssetStatus | 'all')}>
                                                        <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                                                        <SelectContent><SelectItem value="all">All</SelectItem>{Object.keys(statusVariant).map(status => (<SelectItem key={status} value={status} className="capitalize">{status.replace('-', ' ')}</SelectItem>))}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="filter-location">Location</Label><Input id="filter-location" value={filters.location} onChange={(e) => handleFilterChange('location', e.target.value)} className="col-span-2 h-8" /></div>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                                    <PlusCircle className="h-4 w-4" /> Add IT Asset
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Asset Name <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('category')}>Category <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('status')}>Status <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead className="hidden md:table-cell"><Button variant="ghost" onClick={() => handleSort('location')}>Location <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead className="hidden md:table-cell"><Button variant="ghost" onClick={() => handleSort('assignedUserName')}>Assigned To <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                                <TableSkeleton rows={8} cols={6} />
                            ) : (
                            <TableBody>
                                {sortedAndFilteredAssets.map(asset => {
                                    const isMaintenance = asset.status === 'under-maintenance';
                                    return (
                                        <TableRow key={asset.id} className="cursor-pointer" onClick={() => setAssetToView(asset)}>
                                            <TableCell className="font-medium">{asset.name}<div className="text-sm text-muted-foreground md:hidden">{asset.category}</div></TableCell>
                                            <TableCell className="hidden md:table-cell">{asset.category}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={isMaintenance ? 'outline' : statusVariant[asset.status]}
                                                    className={cn("capitalize", isMaintenance && "bg-yellow-100 text-yellow-800 border-yellow-200")}
                                                >
                                                    {asset.status.replace('-', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">{asset.location}</TableCell>
                                            <TableCell className="hidden md:table-cell">{asset.assignedUserName}</TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => setAssetToView(asset)}>View Details</DropdownMenuItem>
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
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader><DialogTitle>{assetToEdit ? 'Edit IT Asset' : 'Add New IT Asset'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-6 py-4 max-h-[80vh] overflow-y-auto px-2">
                           <div>
                                <h3 className="text-lg font-medium">Core Information</h3>
                                <Separator className="my-2" />
                                <div className="space-y-4 pt-2">
                                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Asset Name / Hostname</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="manufacturer" render={({ field }) => (<FormItem><FormLabel>Manufacturer / Brand</FormLabel><FormControl><Input placeholder="e.g., Dell, Apple" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g., Latitude 7420, M2 Macbook Pro" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="e.g., Laptop, Server, Software" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Serial Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                     <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                           </div>

                           <div>
                                <h3 className="text-lg font-medium">Assignment</h3>
                                <Separator className="my-2" />
                                <div className="space-y-4 pt-2">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <FormField control={form.control} name="assignedTo" render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Assigned To / User</FormLabel>
                                                <Combobox
                                                    options={filteredEmployeeOptions}
                                                    value={field.value}
                                                    onValueChange={(value) => {
                                                        field.onChange(value);
                                                        setComboboxSearch("");
                                                    }}
                                                    onSearchChange={setComboboxSearch}
                                                    placeholder="Select an employee..."
                                                    searchPlaceholder="Search employees..."
                                                    emptyText="No employee found."
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department / Business Unit</FormLabel><FormControl><Input placeholder="e.g., Engineering" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location / Site / Office</FormLabel><FormControl><Input placeholder="e.g., Head Office, Westside Mall" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                           </div>
                           
                           <div>
                                <h3 className="text-lg font-medium">Procurement & Financials</h3>
                                <Separator className="my-2" />
                                <div className="space-y-4 pt-2">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="purchaseDate" render={({ field }) => (<FormItem className="flex flex-col pt-2"><FormLabel>Purchase Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                                        <FormField control={form.control} name="purchaseCost" render={({ field }) => (<FormItem><FormLabel>Purchase Cost ({currencySymbol})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="vendorId" render={({ field }) => (
                                            <FormItem><FormLabel>Vendor / Supplier</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger></FormControl>
                                                    <SelectContent><SelectItem value="unassigned">Unknown</SelectItem>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                                                </Select><FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="warrantyExpiration" render={({ field }) => (<FormItem className="flex flex-col pt-2"><FormLabel>Warranty Expiration</FormLabel><FormControl><DatePicker date={field.value ?? undefined} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)}/>
                                    </div>
                                </div>
                           </div>
                            
                            <DialogFooter className="pt-4">
                                 <AlertDialog>
                                     <AlertDialogTrigger asChild><Button type="button">{assetToEdit ? 'Save Changes' : 'Add Asset'}</Button></AlertDialogTrigger>
                                     <AlertDialogContent>
                                         <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will save the changes to the asset.</AlertDialogDescription></AlertDialogHeader>
                                         <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={form.handleSubmit(processSubmit)}>Confirm</AlertDialogAction></AlertDialogFooter>
                                     </AlertDialogContent>
                                 </AlertDialog>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!assetToView} onOpenChange={(open) => { if (!open) setAssetToView(null); }}>
                {assetToView && <ITAssetDetail asset={assetToView} onUpdate={handleUpdateAssetFromDetail} />}
            </Dialog>

            <AlertDialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the asset record.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    
