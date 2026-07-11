
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CustomFieldsFormSection } from "@/components/custom-fields/CustomFields";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/Header";
import { TableSkeleton } from '@/components/TableSkeleton';
import { CSVExportButton } from '@/components/CSVExportButton';
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from '@/hooks/use-debounce';
import { useAppContext } from '@/context/AppContext';
import type { Product } from '@/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { isBefore } from 'date-fns/isBefore';
import { differenceInDays } from 'date-fns/differenceInDays';
import { parseISO } from 'date-fns/parseISO';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import ProductDetail from '@/components/ProductDetail';
import Image from 'next/image';
import Link from 'next/link';
import { MoreHorizontal, PlusCircle, Package, Trash2, ImageIcon, X, Upload, CreditCard } from '@/components/icons';
import { PRODUCT_ICONS, resolveIconName } from '@/lib/product-icon';
import { formatNumber, discountedUnitPrice } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useFirestoreQuery } from '@/hooks/use-firestore-query';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, type Query } from 'firebase/firestore';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const INVENTORY_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Product Name', locked: true },
  { id: 'type', label: 'Type' },
  { id: 'stock', label: 'Stock' },
  { id: 'status', label: 'Status' },
  { id: 'price', label: 'Price' },
];

const serviceLinkSchema = z.object({
  productId: z.string().min(1, "Select a product."),
  quantity: z.coerce.number().positive("Qty must be positive."),
});

const productSchema = z.object({
  name: z.string().min(1, "Name is required."),
  kind: z.enum(['product', 'service']).default('product'),
  price: z.coerce.number().positive("Price must be a positive number."),
  cost: z.coerce.number().min(0, "Cost must be a non-negative number."),
  discount: z.coerce.number().min(0, "Discount cannot be negative.").optional(),
  discountType: z.enum(['percent', 'amount']).default('percent'),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative."),
  sku: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  vendorId: z.string().optional(),
  reorderThreshold: z.coerce.number().int().min(0, "Reorder threshold must be non-negative.").optional(),
  expiryDate: z.date().optional().nullable(),
  warrantyDate: z.date().optional().nullable(),
  productType: z.enum(['standard', 'manufactured', 'component']).default('standard'),
  trackingMode: z.enum(['none', 'lot', 'serial']).default('none'),
  serviceLinks: z.array(serviceLinkSchema).default([]),
}).refine(d => d.discountType !== 'percent' || (d.discount ?? 0) <= 100, {
  message: "Percentage discount cannot exceed 100%.", path: ['discount'],
}).refine(d => d.discountType !== 'amount' || (d.discount ?? 0) <= d.price, {
  message: "Discount cannot exceed the price.", path: ['discount'],
});

type ProductFormData = z.infer<typeof productSchema>;

const productTypeVariant: { [key in Product['productType'] & string]: 'default' | 'secondary' | 'outline' } = {
    standard: 'secondary',
    manufactured: 'default',
    component: 'outline'
};

/** Common units of measure offered in the product form; shown on invoice/receipt lines. */
const COMMON_UNITS = ['Pcs', 'Kg', 'g', 'Ltr', 'ml', 'Box', 'Pack', 'Dozen', 'Pair', 'Set', 'm', 'cm', 'Roll', 'Bag', 'Bottle', 'Can', 'Carton', 'Hour'];


export default function InventoryPage() {
  usePageTitle('Inventory');
    const { setProducts, products, vendors, addActivityLog, currencySymbol, user, isDataLoaded, tenantId } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productToView, setProductToView] = useState<Product | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [productToRestock, setProductToRestock] = useState<Product | null>(null);
    const [restockQty, setRestockQty] = useState('');
    const [customData, setCustomData] = useState<Record<string, unknown>>({});
    // Product image (data URI) + optional named icon — shown on POS cards.
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
    const [iconName, setIconName] = useState<string | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 250);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 20;
    const columnVisibility = useColumnVisibility('inventory', INVENTORY_COLUMNS);
    const { isVisible } = columnVisibility;

    const form = useForm<ProductFormData>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            kind: 'product',
            price: 0,
            cost: 0,
            discount: 0,
            discountType: 'percent',
            stock: 0,
            sku: '',
            category: '',
            description: '',
            unitOfMeasure: 'Pcs',
            barcode: '',
            brand: '',
            vendorId: 'none',
            reorderThreshold: 0,
            expiryDate: null,
            warrantyDate: null,
            productType: 'standard',
            trackingMode: 'none',
            serviceLinks: [],
        }
    });

    const { fields: serviceLinkFields, append: appendServiceLink, remove: removeServiceLink } =
        useFieldArray({ control: form.control, name: 'serviceLinks' });
    const watchedKind = useWatch({ control: form.control, name: 'kind' });
    const watchedPrice = useWatch({ control: form.control, name: 'price' });
    const watchedDiscount = useWatch({ control: form.control, name: 'discount' });
    const watchedDiscountType = useWatch({ control: form.control, name: 'discountType' });
    
    // Full Supply Chain access — admin, manager, and cashier (cashiers need to manage
    // stock directly, e.g. urgent restocking) — matching the 'Supply Chain' module grant
    // in rbac.ts. A tenant admin can further customize this via Settings → Roles.
    const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cashier';
    // Delete is admin/manager only in firestore.rules (products delete: isManager) —
    // gate the UI to match so cashiers don't see a Delete action that silently fails.
    const canDelete = user?.role === 'admin' || user?.role === 'manager';

    const productsQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(collection(db, 'tenants', tenantId, 'products'), orderBy('name', 'asc')) as Query<Product>;
    }, [tenantId]);

    const { data: serverProducts } = useFirestoreQuery<Product>(productsQuery);

    const vendorOptions = useMemo(() => [
        { label: 'None', value: 'none' },
        ...vendors.map(v => ({ label: v.name, value: v.id })),
    ], [vendors]);

    const filteredProducts = useMemo(() => {
        if (!debouncedSearch) return serverProducts;
        const lowercasedFilter = debouncedSearch.toLowerCase();
        return serverProducts.filter(product =>
            product.name.toLowerCase().includes(lowercasedFilter) ||
            (product.sku && product.sku.toLowerCase().includes(lowercasedFilter)) ||
            (product.category && product.category.toLowerCase().includes(lowercasedFilter)) ||
            (product.productType && product.productType.toLowerCase().includes(lowercasedFilter))
        );
    }, [serverProducts, debouncedSearch]);

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleRestock = () => {
        if (!productToRestock) return;
        const qty = Number(restockQty);
        if (!Number.isFinite(qty) || qty === 0) {
            toast({ variant: 'destructive', title: 'Enter a quantity', description: 'Use a positive number to add, negative to remove.' });
            return;
        }
        const newStock = Math.max(0, productToRestock.stock + qty);
        setProducts(products.map(p => p.id === productToRestock.id ? { ...p, stock: newStock } : p));
        addActivityLog('Stock Adjusted', `${qty > 0 ? 'Added' : 'Removed'} ${Math.abs(qty)} to ${productToRestock.name} (now ${newStock}).`);
        toast({ title: 'Stock updated', description: `${productToRestock.name} is now at ${newStock}.` });
        setProductToRestock(null);
        setRestockQty('');
    };

    // `duplicate: true` prefills the form from an existing product but saves as a NEW one.
    const handleOpenForm = (product: Product | null = null, { duplicate = false } = {}) => {
        setProductToEdit(duplicate ? null : product);
        setCustomData(product?.customData ?? {});
        setImageUrl(product?.imageUrl);
        setIconName(product?.iconName);
        if (product) {
            form.reset({
              ...product,
              name: duplicate ? `${product.name} (Copy)` : product.name,
              // A copy is a distinct item — don't carry over the unique identifiers.
              sku: duplicate ? '' : (product.sku ?? ''),
              barcode: duplicate ? '' : (product.barcode ?? ''),
              kind: product.kind ?? 'product',
              discount: product.discount ?? 0,
              discountType: product.discountType ?? 'percent',
              unitOfMeasure: product.unitOfMeasure ?? 'Pcs',
              vendorId: product.vendorId ?? 'none',
              reorderThreshold: product.reorderThreshold ?? 0,
              expiryDate: product.expiryDate ? new Date(product.expiryDate) : null,
              warrantyDate: product.warrantyDate ? new Date(product.warrantyDate) : null,
              productType: product.productType ?? 'standard',
              trackingMode: product.trackingMode ?? 'none',
              serviceLinks: product.serviceLinks ?? [],
            });
        } else {
            form.reset({ name: '', kind: 'product', price: 0, cost: 0, discount: 0, discountType: 'percent', stock: 0, sku: '', category: '', description: '', unitOfMeasure: 'Pcs', barcode: '', brand: '', vendorId: 'none', reorderThreshold: 0, expiryDate: null, warrantyDate: null, productType: 'standard', trackingMode: 'none', serviceLinks: [] });
        }
        setIsFormOpen(true);
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        const MAX_BYTES = 512 * 1024; // keep the product doc well under Firestore's 1MB limit
        if (!ALLOWED.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Unsupported file type', description: 'Use a PNG, JPEG, WebP, or SVG image.' });
            event.target.value = '';
            return;
        }
        if (file.size > MAX_BYTES) {
            toast({ variant: 'destructive', title: 'Image too large', description: 'Please use an image under 512KB.' });
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setImageUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const onSubmit = (data: ProductFormData) => {
        const hasCustom = Object.keys(customData).length > 0;
        const isService = data.kind === 'service';
        const productData = {
          ...data,
          vendorId: data.vendorId === 'none' ? undefined : data.vendorId,
          unitOfMeasure: data.unitOfMeasure === 'none' ? undefined : data.unitOfMeasure,
          expiryDate: data.expiryDate ? data.expiryDate.toISOString() : undefined,
          warrantyDate: data.warrantyDate ? data.warrantyDate.toISOString() : undefined,
          reorderThreshold: data.reorderThreshold,
          // Services hold no stock of their own; products keep no service links.
          stock: isService ? 0 : data.stock,
          serviceLinks: isService ? data.serviceLinks.filter(l => l.productId && l.quantity > 0) : [],
          imageUrl: imageUrl || undefined,
          iconName: iconName || undefined,
          ...(hasCustom ? { customData } : {}),
        };

        if (productToEdit) {
            const updatedProducts = products.map(p => p.id === productToEdit.id ? { ...p, ...productData } : p);
            setProducts(updatedProducts);
            toast({ title: "Product Updated", description: `${data.name} has been updated.` });
            addActivityLog('Product Updated', `Updated product: ${data.name} (ID: ${productToEdit.id})`);
        } else {
            const newProduct: Product = {
                id: `prod-${Date.now()}`,
                createdAt: new Date().toISOString(),
                ...productData,
            };
            setProducts([newProduct, ...products]);
            toast({ title: "Product Added", description: `${data.name} has been added to inventory.` });
            addActivityLog('Product Added', `Added new product: ${data.name}`);
        }
        setIsFormOpen(false);
        setProductToEdit(null);
    };
    
    const handleDelete = () => {
        if (!productToDelete) return;
        addActivityLog('Product Deleted', `Deleted product: ${productToDelete.name} (ID: ${productToDelete.id})`);
        setProducts(products.filter(p => p.id !== productToDelete.id));
        toast({ title: "Product Deleted", description: `${productToDelete.name} has been deleted.` });
        setProductToDelete(null);
    };

    const getProductStatus = (product: Product) => {
        const statuses: { text: string; variant: 'destructive' | 'secondary' }[] = [];
        const now = new Date();

        // Services hold no stock of their own — skip stock-based status badges.
        if (product.kind === 'service') return statuses;

        if (product.stock <= 0) {
            statuses.push({ text: 'Out of Stock', variant: 'destructive' });
        } else if (product.reorderThreshold && product.stock <= product.reorderThreshold) {
            statuses.push({ text: 'Low Stock', variant: 'secondary' });
        }

        if (product.expiryDate) {
            const expiry = parseISO(product.expiryDate);
            if (isBefore(expiry, now)) {
                statuses.push({ text: 'Expired', variant: 'destructive' });
            } else if (differenceInDays(expiry, now) <= 30) {
                statuses.push({ text: 'Expires Soon', variant: 'secondary' });
            }
        }
        
        return statuses;
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Inventory" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-end md:items-center gap-4">
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <Input
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    className="w-full md:w-[300px] bg-secondary"
                                />
                                <CSVExportButton
                                    data={filteredProducts as Record<string, unknown>[]}
                                    filename="inventory"
                                    columns={[
                                        { key: 'name' as const, label: 'Name' },
                                        { key: 'sku' as const, label: 'SKU' },
                                        { key: 'category' as const, label: 'Category' },
                                        { key: 'stock' as const, label: 'Stock' },
                                        { key: 'price' as const, label: 'Price' },
                                        { key: 'cost' as const, label: 'Cost' },
                                        { key: 'reorderThreshold' as const, label: 'Reorder Threshold' },
                                    ]}
                                />
                                <ColumnVisibilityMenu visibility={columnVisibility} />
                                <Button asChild variant="outline" size="sm" className="gap-1 w-full sm:w-auto">
                                    <Link href="/pos">
                                        <CreditCard className="h-4 w-4" />
                                        Point of Sale
                                    </Link>
                                </Button>
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
                                        Add Product
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product Name</TableHead>
                                    {isVisible('type') && <TableHead className="hidden md:table-cell">Type</TableHead>}
                                    {isVisible('stock') && <TableHead>Stock</TableHead>}
                                    {isVisible('status') && <TableHead>Status</TableHead>}
                                    {isVisible('price') && <TableHead className="hidden md:table-cell">Price</TableHead>}
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                                <TableSkeleton rows={8} cols={6} />
                            ) : (
                            <TableBody>
                                {paginatedProducts.map(product => {
                                    const statuses = getProductStatus(product);
                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium">
                                                <div 
                                                    className="cursor-pointer hover:underline"
                                                    onClick={() => setProductToView(product)}
                                                >
                                                    {product.name}
                                                </div>
                                                <div className="text-sm text-muted-foreground md:hidden">
                                                    {currencySymbol} {formatNumber(product.price)}
                                                </div>
                                            </TableCell>
                                            {isVisible('type') && (
                                                <TableCell className="hidden md:table-cell">
                                                    {product.kind === 'service' ? (
                                                        <Badge variant="outline" className="capitalize">Service</Badge>
                                                    ) : (
                                                        <Badge variant={productTypeVariant[product.productType || 'standard']} className="capitalize">
                                                            {product.productType || 'Standard'}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            )}
                                            {isVisible('stock') && <TableCell>{product.kind === 'service' ? <span className="text-muted-foreground">—</span> : product.stock}</TableCell>}
                                            {isVisible('status') && (
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {statuses.length > 0 ? (
                                                            statuses.map(status => (
                                                                <Badge key={status.text} variant={status.variant} className="whitespace-nowrap">{status.text}</Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            )}
                                            {isVisible('price') && <TableCell className="hidden md:table-cell">{currencySymbol} {formatNumber(product.price)}</TableCell>}
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!canManage}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                            <span className="sr-only">Toggle menu</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => setProductToView(product)}>View Details</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenForm(product)}>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenForm(product, { duplicate: true })}>Duplicate</DropdownMenuItem>
                                                        {product.kind !== 'service' && (
                                                            <DropdownMenuItem onClick={() => { setProductToRestock(product); setRestockQty(''); }}>Add stock</DropdownMenuItem>
                                                        )}
                                                        {canDelete && (
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setProductToDelete(product)}>Delete</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {paginatedProducts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="p-0">
                                            <EmptyState
                                                icon={Package}
                                                title="No products found"
                                                description="Try adjusting your search or add a new product."
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            )}
                        </Table>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4">
                                <p className="text-sm text-muted-foreground">
                                    Showing {(currentPage - 1) * PAGE_SIZE + 1}â€“{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{productToEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                        <DialogDescription>
                            {productToEdit ? 'Update the details of your product.' : 'Fill out the form to add a new product.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>{watchedKind === 'service' ? 'Service' : 'Product'} Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="kind" render={({ field }) => (
                                    <FormItem><FormLabel>Item Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="product">Product (tracks stock)</SelectItem>
                                                <SelectItem value="service">Service (consumes linked products)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {watchedKind !== 'service' && (
                                    <FormField control={form.control} name="productType" render={({ field }) => (
                                        <FormItem><FormLabel>Product Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="standard">Standard</SelectItem>
                                                    <SelectItem value="manufactured">Manufactured</SelectItem>
                                                    <SelectItem value="component">Component (Raw Material)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                                {watchedKind !== 'service' && (
                                    <FormField control={form.control} name="trackingMode" render={({ field }) => (
                                        <FormItem><FormLabel>Stock Tracking</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">None (quantity only)</SelectItem>
                                                    <SelectItem value="lot">Lot / batch</SelectItem>
                                                    <SelectItem value="serial">Serial number</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the product..." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />

                            {/* POS appearance — image and/or icon shown on Point of Sale cards */}
                            <div className="space-y-3 rounded-lg border p-3">
                                <div>
                                    <Label className="text-sm font-medium">POS appearance</Label>
                                    <p className="text-xs text-muted-foreground">Shown on Point of Sale cards. Upload a photo, or pick an icon — if neither is set, an icon is guessed from the name.</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="relative h-16 w-16 shrink-0 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden">
                                        {imageUrl ? (
                                            <Image src={imageUrl} alt="Product" fill sizes="64px" className="object-cover" unoptimized />
                                        ) : (
                                            (() => { const Ico = PRODUCT_ICONS[resolveIconName(form.watch('name'), iconName)] ?? Package; return <Ico className="h-7 w-7 text-muted-foreground" />; })()
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Input type="file" accept="image/*" onChange={handleImageUpload} className="max-w-xs" />
                                        {imageUrl && (
                                            <Button type="button" variant="ghost" size="sm" className="h-7 w-fit px-2 text-muted-foreground" onClick={() => setImageUrl(undefined)}>
                                                <X className="h-3.5 w-3.5 mr-1" /> Remove image
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Icon (used when no image)</Label>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        <button type="button" onClick={() => setIconName(undefined)}
                                            className={cn('h-9 w-9 rounded-lg border flex items-center justify-center transition-colors', !iconName ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted')}
                                            title="Auto (guess from name)">
                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                        {Object.entries(PRODUCT_ICONS).map(([key, Ico]) => (
                                            <button key={key} type="button" onClick={() => setIconName(key)}
                                                className={cn('h-9 w-9 rounded-lg border flex items-center justify-center transition-colors', iconName === key ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted')}
                                                title={key}>
                                                <Ico className="h-4 w-4" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="sku" render={({ field }) => (
                                    <FormItem><FormLabel>SKU (Stock Keeping Unit)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="category" render={({ field }) => (
                                    <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                                    <FormItem><FormLabel>Unit of Measure</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                {/* keep a legacy free-text unit selectable so editing doesn't lose it */}
                                                {field.value && field.value !== 'none' && !COMMON_UNITS.includes(field.value) && (
                                                    <SelectItem value={field.value}>{field.value}</SelectItem>
                                                )}
                                                {COMMON_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">Shown next to quantities on invoices &amp; receipts.</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="barcode" render={({ field }) => (
                                    <FormItem><FormLabel>Barcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="brand" render={({ field }) => (
                                    <FormItem><FormLabel>Brand</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <FormField control={form.control} name="vendorId" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Default Vendor</FormLabel>
                                    <FormControl>
                                        <Combobox
                                            options={vendorOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder="Select a vendor"
                                            searchPlaceholder="Search vendors..."
                                            emptyText="No vendor found."
                                            className="w-full"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="cost" render={({ field }) => (
                                    <FormItem><FormLabel>Cost</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                {watchedKind !== 'service' && (
                                    <FormField control={form.control} name="stock" render={({ field }) => (
                                        <FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" {...field} disabled={!!productToEdit} /></FormControl>
                                            {productToEdit && <p className="text-xs text-muted-foreground">Use “Add stock” on the row to adjust.</p>}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            {/* Discount — % of price or a fixed amount off, with live final-price preview */}
                            <div className="space-y-3 rounded-lg border p-3">
                                <div>
                                    <Label className="text-sm font-medium">Discount</Label>
                                    <p className="text-xs text-muted-foreground">Auto-applied to this item&apos;s line on invoices &amp; receipts.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="discountType" render={({ field }) => (
                                        <FormItem><FormLabel>Discount Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="percent">Percentage (%)</SelectItem>
                                                    <SelectItem value="amount">Fixed amount ({currencySymbol})</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="discount" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{watchedDiscountType === 'amount' ? `Amount off (${currencySymbol})` : 'Percentage off (%)'}</FormLabel>
                                            <FormControl><Input type="number" step="0.01" min={0} max={watchedDiscountType === 'percent' ? 100 : undefined} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <div className="flex flex-col justify-end pb-1">
                                        <p className="text-sm font-medium text-muted-foreground">Final price</p>
                                        <p className="text-lg font-semibold">
                                            {currencySymbol} {formatNumber(discountedUnitPrice(Number(watchedPrice) || 0, Number(watchedDiscount) || 0, watchedDiscountType))}
                                        </p>
                                        {(Number(watchedDiscount) || 0) > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                was {currencySymbol} {formatNumber(Number(watchedPrice) || 0)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {watchedKind === 'service' && (
                                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <FormLabel className="text-sm">Linked products consumed per use</FormLabel>
                                            <p className="text-xs text-muted-foreground">Each time this service is sold, these products’ stock is reduced by qty × service quantity.</p>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => appendServiceLink({ productId: '', quantity: 1 })}>
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add product
                                        </Button>
                                    </div>
                                    {serviceLinkFields.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-2">No products linked yet.</p>
                                    ) : serviceLinkFields.map((f, index) => (
                                        <div key={f.id} className="flex items-end gap-2">
                                            <FormField control={form.control} name={`serviceLinks.${index}.productId`} render={({ field }) => (
                                                <FormItem className="flex-1"><FormLabel className="text-xs text-muted-foreground">Product</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {products.filter(p => p.kind !== 'service').map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select><FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name={`serviceLinks.${index}.quantity`} render={({ field }) => (
                                                <FormItem className="w-28"><FormLabel className="text-xs text-muted-foreground">Qty / use</FormLabel><FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => removeServiceLink(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <FormField control={form.control} name="reorderThreshold" render={({ field }) => (
                                    <FormItem><FormLabel>Reorder Threshold</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Expiry Date</FormLabel><FormControl><DatePicker date={field.value ?? undefined} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="warrantyDate" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Warranty Date</FormLabel><FormControl><DatePicker date={field.value ?? undefined} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>

                            <CustomFieldsFormSection entity="product" value={customData} onChange={setCustomData} />

                            <DialogFooter className="pt-4">
                                <Button type="submit">{productToEdit ? 'Save Changes' : 'Add Product'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!productToView} onOpenChange={(open) => !open && setProductToView(null)}>
                {productToView && (
                    <ProductDetail
                        product={productToView}
                        onEdit={canManage ? () => { const p = productToView; setProductToView(null); handleOpenForm(p); } : undefined}
                        onDuplicate={canManage ? () => { const p = productToView; setProductToView(null); handleOpenForm(p, { duplicate: true }); } : undefined}
                    />
                )}
            </Dialog>

            <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the product.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!productToRestock} onOpenChange={(open) => { if (!open) { setProductToRestock(null); setRestockQty(''); } }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add stock — {productToRestock?.name}</DialogTitle>
                        <DialogDescription>
                            Current stock: {productToRestock?.stock ?? 0}. Enter a quantity to add (or a negative number to remove) for emergency / contingency restocking.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="restock-qty">Quantity to add</Label>
                        <Input id="restock-qty" type="number" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="e.g. 50" autoFocus />
                        {restockQty !== '' && Number.isFinite(Number(restockQty)) && (
                            <p className="text-xs text-muted-foreground">New stock will be {Math.max(0, (productToRestock?.stock ?? 0) + Number(restockQty))}.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setProductToRestock(null); setRestockQty(''); }}>Cancel</Button>
                        <Button onClick={handleRestock}>Update stock</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
