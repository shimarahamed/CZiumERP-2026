
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
import type { Product, ProductCategory } from '@/types';
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
import { MoreHorizontal, PlusCircle, Package, Trash2, ImageIcon, X, Upload, CreditCard, List, ChevronUp, ChevronDown, ArrowUpDown } from '@/components/icons';
import { PRODUCT_ICONS, resolveIconName } from '@/lib/product-icon';
import { formatNumber, discountedUnitPrice } from '@/lib/money';
import { cn } from '@/lib/utils';
import { calculateStockAdjustment } from '@/lib/stock-adjustment';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const INVENTORY_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Product Name', locked: true },
  { id: 'sku', label: 'SKU' },
  { id: 'type', label: 'Type' },
  { id: 'stock', label: 'Stock' },
  { id: 'status', label: 'Status' },
  { id: 'price', label: 'MRP' },
  { id: 'finalPrice', label: 'Final Price' },
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
  discountType: z.enum(['percent', 'amount']).default('amount'),
  stock: z.coerce.number().min(0, "Stock cannot be negative."),
  sku: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  vendorId: z.string().optional(),
  subscriptionId: z.string().optional(),
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
const COMMON_UNITS = ['Pcs', 'Kg', 'g', 'Ltr', 'ml', 'Box', 'Pack', 'Dozen', 'Pair', 'Set', 'm', 'cm', 'Roll', 'Bag', 'Bottle', 'Can', 'Carton', 'Hour', 'Day', 'Week', 'Month', 'Year'];


export default function InventoryPage() {
  usePageTitle('Inventory');
    const { setProducts, products, productCategories, setProductCategories, vendors, subscriptions, addActivityLog, currencySymbol, user, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productToView, setProductToView] = useState<Product | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [replacementProductId, setReplacementProductId] = useState('');
    const [pendingMerge, setPendingMerge] = useState<{ existing: Product; incoming: Product } | null>(null);
    const [productToRestock, setProductToRestock] = useState<Product | null>(null);
    const [restockQty, setRestockQty] = useState('');
    const [restockMode, setRestockMode] = useState<'add' | 'remove' | 'set'>('add');
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);
    const [customData, setCustomData] = useState<Record<string, unknown>>({});
    // Product image (data URI) + optional named icon — shown on POS cards.
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
    const [iconName, setIconName] = useState<string | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 250);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 20;
    const columnVisibility = useColumnVisibility('inventory', INVENTORY_COLUMNS);
    const { isVisible, columns: orderedColumns } = columnVisibility;
    const SORTABLE_COLUMNS = new Set(['name', 'sku', 'stock', 'price', 'finalPrice']);
    const [sortColumn, setSortColumn] = useState<string>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (columnId: string) => {
        if (!SORTABLE_COLUMNS.has(columnId)) return;
        if (sortColumn === columnId) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(columnId);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const form = useForm<ProductFormData>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            kind: 'product',
            price: 0,
            cost: 0,
            discount: 0,
            discountType: 'amount',
            stock: 0,
            sku: '',
            category: '',
            description: '',
            unitOfMeasure: 'Pcs',
            barcode: '',
            brand: '',
            vendorId: 'none',
            subscriptionId: 'none',
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

    const vendorOptions = useMemo(() => [
        { label: 'None', value: 'none' },
        ...vendors.map(v => ({ label: v.name, value: v.id })),
    ], [vendors]);

    const subscriptionOptions = useMemo(() => [
        { label: 'None', value: 'none' },
        ...subscriptions.map(s => ({ label: s.name, value: s.id })),
    ], [subscriptions]);

    const categoryOptions = useMemo(() => {
        const names = new Map<string, string>();
        productCategories.forEach(category => {
            const name = category.name.trim();
            if (name) names.set(name.toLowerCase(), name);
        });
        products.forEach(product => {
            const name = product.category?.trim();
            if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
        });
        return [...names.values()]
            .sort((a, b) => a.localeCompare(b))
            .map(name => ({ label: name, value: name }));
    }, [productCategories, products]);

    const addCategory = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const existing = categoryOptions.find(option => option.label.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            form.setValue('category', existing.value, { shouldDirty: true, shouldValidate: true });
            return;
        }
        const newCategory: ProductCategory = {
            id: `cat-${Date.now()}`,
            name: trimmed,
            createdAt: new Date().toISOString(),
        };
        setProductCategories([newCategory, ...productCategories]);
        form.setValue('category', trimmed, { shouldDirty: true, shouldValidate: true });
        addActivityLog('Category Added', `Added product category: ${trimmed}`);
        toast({ title: 'Category added', description: `${trimmed} is now available for products.` });
    };

    const [customUnits, setCustomUnits] = useState<string[]>([]);

    const unitOptions = useMemo(() => {
        const names = new Map<string, string>();
        COMMON_UNITS.forEach(u => names.set(u.toLowerCase(), u));
        customUnits.forEach(u => { if (!names.has(u.toLowerCase())) names.set(u.toLowerCase(), u); });
        products.forEach(product => {
            const u = product.unitOfMeasure?.trim();
            if (u && !names.has(u.toLowerCase())) names.set(u.toLowerCase(), u);
        });
        return [...names.values()].map(name => ({ label: name, value: name }));
    }, [customUnits, products]);

    const addUnit = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const existing = unitOptions.find(option => option.label.toLowerCase() === trimmed.toLowerCase());
        if (!existing) setCustomUnits(prev => [trimmed, ...prev]);
        form.setValue('unitOfMeasure', existing?.value ?? trimmed, { shouldDirty: true, shouldValidate: true });
    };

    const confirmDeleteCategory = () => {
        if (!categoryToDelete) return;
        const categoryName = categoryToDelete.name.trim();
        setProductCategories(productCategories.filter(category => category.name.trim().toLowerCase() !== categoryName.toLowerCase()));
        setProducts(products.map(product =>
            product.category?.trim().toLowerCase() === categoryName.toLowerCase()
                ? { ...product, category: undefined }
                : product
        ));
        addActivityLog('Category Deleted', `Deleted product category: ${categoryName}`);
        toast({ title: 'Category deleted', description: `${categoryName} was removed from matching products.` });
        setCategoryToDelete(null);
    };

    const filteredProducts = useMemo(() => {
        const lowercasedFilter = debouncedSearch.toLowerCase();
        const matched = !debouncedSearch ? [...products] : products.filter(product =>
            product.name.toLowerCase().includes(lowercasedFilter) ||
            (product.sku && product.sku.toLowerCase().includes(lowercasedFilter)) ||
            (product.category && product.category.toLowerCase().includes(lowercasedFilter)) ||
            (product.productType && product.productType.toLowerCase().includes(lowercasedFilter))
        );

        const dir = sortDirection === 'asc' ? 1 : -1;
        matched.sort((a, b) => {
            switch (sortColumn) {
                case 'sku':
                    return dir * (a.sku ?? '').localeCompare(b.sku ?? '');
                case 'stock':
                    return dir * ((a.stock ?? 0) - (b.stock ?? 0));
                case 'price':
                    return dir * (a.price - b.price);
                case 'finalPrice':
                    return dir * (
                        discountedUnitPrice(a.price, a.discount ?? 0, a.discountType ?? 'percent') -
                        discountedUnitPrice(b.price, b.discount ?? 0, b.discountType ?? 'percent')
                    );
                case 'name':
                default:
                    return dir * a.name.localeCompare(b.name);
            }
        });
        return matched;
    }, [products, debouncedSearch, sortColumn, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleRestock = () => {
        if (!productToRestock) return;
        const qty = Number(restockQty);
        if (!Number.isFinite(qty) || qty === 0) {
            toast({ variant: 'destructive', title: 'Enter a quantity', description: 'Use a numeric value for stock adjustments.' });
            return;
        }

        const adjustment = calculateStockAdjustment(productToRestock.stock, qty, restockMode);
        const newStock = adjustment.newStock;
        const historyEntry = {
            id: `stock-${Date.now()}`,
            quantity: adjustment.appliedQty,
            previousStock: productToRestock.stock,
            newStock,
            createdAt: new Date().toISOString(),
            source: 'manual' as const,
            userName: user?.name,
        };
        setProducts(products.map(p => p.id === productToRestock.id ? { ...p, stock: newStock, stockHistory: [...(p.stockHistory ?? []), historyEntry] } : p));
        const actionLabel = restockMode === 'add' ? 'Added' : restockMode === 'remove' ? 'Removed' : 'Set';
        const detailText = restockMode === 'set'
            ? `Set ${productToRestock.name} stock to ${newStock}.`
            : `${actionLabel} ${Math.abs(qty)} ${restockMode === 'remove' ? 'from' : 'to'} ${productToRestock.name} (now ${newStock}).`;
        addActivityLog('Stock Adjusted', detailText);
        toast({ title: 'Stock updated', description: `${productToRestock.name} is now at ${newStock}.` });
        setProductToRestock(null);
        setRestockQty('');
        setRestockMode('add');
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
              name: product.name,
              // Keeping name/SKU lets a duplicate be recognized and merged.
              stock: product.stock ?? 0,
              sku: product.sku ?? '',
              barcode: duplicate ? '' : (product.barcode ?? ''),
              kind: product.kind ?? 'product',
              discount: product.discount ?? 0,
              discountType: product.discountType ?? 'percent',
              unitOfMeasure: product.unitOfMeasure ?? 'Pcs',
              vendorId: product.vendorId ?? 'none',
              subscriptionId: product.subscriptionId ?? 'none',
              reorderThreshold: product.reorderThreshold ?? 0,
              expiryDate: product.expiryDate ? new Date(product.expiryDate) : null,
              warrantyDate: product.warrantyDate ? new Date(product.warrantyDate) : null,
              productType: product.productType ?? 'standard',
              trackingMode: product.trackingMode ?? 'none',
              serviceLinks: product.serviceLinks ?? [],
            });
        } else {
            form.reset({ name: '', kind: 'product', price: 0, cost: 0, discount: 0, discountType: 'amount', stock: 0, sku: '', category: '', description: '', unitOfMeasure: 'Pcs', barcode: '', brand: '', vendorId: 'none', subscriptionId: 'none', reorderThreshold: 0, expiryDate: null, warrantyDate: null, productType: 'standard', trackingMode: 'none', serviceLinks: [] });
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
          subscriptionId: data.subscriptionId === 'none' ? undefined : data.subscriptionId,
          unitOfMeasure: data.unitOfMeasure === 'none' ? undefined : data.unitOfMeasure,
          expiryDate: data.expiryDate ? data.expiryDate.toISOString() : undefined,
          warrantyDate: data.warrantyDate ? data.warrantyDate.toISOString() : undefined,
          reorderThreshold: data.reorderThreshold,
          // Services hold no stock of their own; products keep no service links.
          stock: isService ? 0 : Number(data.stock),
          serviceLinks: isService ? data.serviceLinks.filter(l => l.productId && l.quantity > 0) : [],
          imageUrl: imageUrl || undefined,
          iconName: iconName || undefined,
          ...(hasCustom ? { customData } : {}),
        };

        if (productToEdit) {
            const stockIncrease = productData.stock - productToEdit.stock;
            const updatedProducts = products.map(p => p.id === productToEdit.id ? {
                ...p,
                ...productData,
                ...(stockIncrease > 0 ? {
                    stockHistory: [...(p.stockHistory ?? []), {
                        id: `stock-${Date.now()}`,
                        quantity: stockIncrease,
                        previousStock: productToEdit.stock,
                        newStock: productData.stock,
                        createdAt: new Date().toISOString(),
                        source: 'edit' as const,
                        userName: user?.name,
                    }],
                } : {}),
            } : p);
            setProducts(updatedProducts);
            toast({ title: "Product Updated", description: `${data.name} has been updated.` });
            addActivityLog('Product Updated', `Updated product: ${data.name} (ID: ${productToEdit.id})`);
        } else {
            const newProduct: Product = {
                id: `prod-${Date.now()}`,
                createdAt: new Date().toISOString(),
                ...productData,
                ...(productData.stock > 0 ? { stockHistory: [{
                    id: `stock-${Date.now()}`,
                    quantity: productData.stock,
                    previousStock: 0,
                    newStock: productData.stock,
                    createdAt: new Date().toISOString(),
                    source: 'initial' as const,
                    userName: user?.name,
                }] } : {}),
            };
            const normalizedSku = newProduct.sku?.trim().toLowerCase();
            const existing = normalizedSku && newProduct.kind !== 'service' ? products.find(p =>
                p.kind !== 'service' &&
                p.name.trim().toLowerCase() === newProduct.name.trim().toLowerCase() &&
                p.sku?.trim().toLowerCase() === normalizedSku
            ) : undefined;
            if (existing) {
                setPendingMerge({ existing, incoming: newProduct });
                return;
            }
            setProducts([newProduct, ...products]);
            toast({ title: "Product Added", description: `${data.name} has been added to inventory.` });
            addActivityLog('Product Added', `Added new product: ${data.name}`);
        }
        setIsFormOpen(false);
        setProductToEdit(null);
    };

    const confirmDuplicateMerge = () => {
        if (!pendingMerge) return;
        const { existing, incoming } = pendingMerge;
        const added = incoming.stock;
        const newStock = existing.stock + added;
        setProducts(products.map(p => p.id === existing.id ? {
            ...p,
            stock: newStock,
            stockHistory: [...(p.stockHistory ?? []), {
                id: `stock-${Date.now()}`,
                quantity: added,
                previousStock: existing.stock,
                newStock,
                createdAt: new Date().toISOString(),
                source: 'duplicate-merge' as const,
                userName: user?.name,
                note: `Merged duplicate ${incoming.name} (${incoming.sku})`,
            }],
        } : p));
        addActivityLog('Stock Merged', `Merged ${added} stock into ${existing.name} (${existing.sku}); new stock ${newStock}.`);
        toast({ title: 'Stock Merged', description: `${added} units were added to ${existing.name}. No duplicate was created.` });
        setPendingMerge(null);
        setIsFormOpen(false);
        setProductToEdit(null);
    };
    
    const linkedServicesForDelete = productToDelete?.kind !== 'service'
        ? products.filter(p => p.kind === 'service' && p.serviceLinks?.some(link => link.productId === productToDelete?.id))
        : [];

    const handleDelete = () => {
        if (!productToDelete) return;
        addActivityLog('Product Deleted', `Deleted product: ${productToDelete.name} (ID: ${productToDelete.id})`);
        setProducts(products
            .filter(p => p.id !== productToDelete.id)
            .map(p => p.kind === 'service' && p.serviceLinks?.some(link => link.productId === productToDelete.id)
                ? { ...p, serviceLinks: p.serviceLinks.filter(link => link.productId !== productToDelete.id) }
                : p));
        toast({
            title: "Product Deleted",
            description: linkedServicesForDelete.length > 0
                ? `${productToDelete.name} was deleted and unlinked from ${linkedServicesForDelete.length} service${linkedServicesForDelete.length === 1 ? '' : 's'}.`
                : `${productToDelete.name} has been deleted.`,
        });
        setProductToDelete(null);
        setReplacementProductId('');
    };

    const handleMoveLinksAndDelete = () => {
        if (!productToDelete || !replacementProductId) return;
        const replacement = products.find(p => p.id === replacementProductId);
        if (!replacement) return;

        setProducts(products
            .filter(p => p.id !== productToDelete.id)
            .map(p => {
                if (p.kind !== 'service' || !p.serviceLinks?.some(link => link.productId === productToDelete.id)) return p;
                const movedQty = p.serviceLinks
                    .filter(link => link.productId === productToDelete.id)
                    .reduce((sum, link) => sum + link.quantity, 0);
                const withoutOld = p.serviceLinks.filter(link => link.productId !== productToDelete.id);
                const existingReplacement = withoutOld.find(link => link.productId === replacementProductId);
                const serviceLinks = existingReplacement
                    ? withoutOld.map(link => link.productId === replacementProductId ? { ...link, quantity: link.quantity + movedQty } : link)
                    : [...withoutOld, { productId: replacementProductId, quantity: movedQty }];
                return { ...p, serviceLinks };
            }));
        addActivityLog('Product Deleted', `Moved service links from ${productToDelete.name} to ${replacement.name}, then deleted ${productToDelete.id}.`);
        toast({
            title: 'Links Moved & Product Deleted',
            description: `${linkedServicesForDelete.length} service link${linkedServicesForDelete.length === 1 ? '' : 's'} moved to ${replacement.name}.`,
        });
        setProductToDelete(null);
        setReplacementProductId('');
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
            <Header title="Inventory">
                <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link href="/pos">
                        <CreditCard className="h-4 w-4" />
                        Point of Sale
                    </Link>
                </Button>
            </Header>
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
                                {canManage && (
                                    <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto" onClick={() => setIsCategoryDialogOpen(true)}>
                                        <List className="h-4 w-4" />
                                        Categories
                                    </Button>
                                )}
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
                                    {orderedColumns.filter(column => isVisible(column.id)).map(column => (
                                        <TableHead key={column.id} className={column.id === 'type' || column.id === 'price' || column.id === 'finalPrice' ? 'hidden md:table-cell' : undefined}>
                                            {SORTABLE_COLUMNS.has(column.id) ? (
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-1 hover:text-foreground"
                                                    onClick={() => handleSort(column.id)}
                                                >
                                                    {column.label}
                                                    {sortColumn === column.id ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                                                    )}
                                                </button>
                                            ) : column.label}
                                        </TableHead>
                                    ))}
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
                                            {orderedColumns.filter(column => isVisible(column.id)).map(column => {
                                                if (column.id === 'name') return (
                                                    <TableCell key={column.id} className="font-medium">
                                                        <div className="cursor-pointer hover:underline" onClick={() => setProductToView(product)}>{product.name}</div>
                                                        <div className="text-sm text-muted-foreground md:hidden">
                                                            {currencySymbol} {formatNumber(discountedUnitPrice(product.price, product.discount ?? 0, product.discountType ?? 'percent'))}
                                                            {(product.discount ?? 0) > 0 && (
                                                                <span className="line-through ml-1 opacity-60">{currencySymbol} {formatNumber(product.price)}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                );
                                                if (column.id === 'sku') return <TableCell key={column.id}>{product.sku || '—'}</TableCell>;
                                                if (column.id === 'type') return (
                                                    <TableCell key={column.id} className="hidden md:table-cell">
                                                        {product.kind === 'service' ? <Badge variant="outline">Service</Badge> : <Badge variant={productTypeVariant[product.productType || 'standard']} className="capitalize">{product.productType || 'Standard'}</Badge>}
                                                    </TableCell>
                                                );
                                                if (column.id === 'stock') return <TableCell key={column.id}>{product.kind === 'service' ? <span className="text-muted-foreground">—</span> : product.stock}</TableCell>;
                                                if (column.id === 'status') return (
                                                    <TableCell key={column.id}><div className="flex flex-wrap gap-1">{statuses.length > 0 ? statuses.map(status => <Badge key={status.text} variant={status.variant} className="whitespace-nowrap">{status.text}</Badge>) : <span className="text-muted-foreground">-</span>}</div></TableCell>
                                                );
                                                if (column.id === 'price') return <TableCell key={column.id} className="hidden md:table-cell">{currencySymbol} {formatNumber(product.price)}</TableCell>;
                                                if (column.id === 'finalPrice') return (
                                                    <TableCell key={column.id} className="hidden md:table-cell">
                                                        {currencySymbol} {formatNumber(discountedUnitPrice(product.price, product.discount ?? 0, product.discountType ?? 'percent'))}
                                                    </TableCell>
                                                );
                                                return null;
                                            })}
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                {canManage && product.kind !== 'service' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-1 whitespace-nowrap"
                                                        onClick={() => { setProductToRestock(product); setRestockQty(''); setRestockMode('add'); }}
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5" /> Adjust Stock
                                                    </Button>
                                                )}
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
                                                            <DropdownMenuItem onClick={() => { setProductToRestock(product); setRestockQty(''); setRestockMode('add'); }}>Adjust stock</DropdownMenuItem>
                                                        )}
                                                        {canDelete && (
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setProductToDelete(product)}>Delete</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                </div>
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
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{productToEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                        <DialogDescription>
                            {productToEdit ? 'Update the details of your product.' : 'Fill out the form to add a new product.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 space-y-3 overflow-y-auto py-2 px-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem className="col-span-2"><FormLabel>{watchedKind === 'service' ? 'Service' : 'Product'} Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                            <div className="rounded-lg border p-3">
                                <div className="flex items-start gap-3">
                                    <div className="relative h-12 w-12 shrink-0 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden">
                                        {imageUrl ? (
                                            <Image src={imageUrl} alt="Product" fill sizes="48px" className="object-cover" unoptimized />
                                        ) : (
                                            (() => { const Ico = PRODUCT_ICONS[resolveIconName(form.watch('name'), iconName)] ?? Package; return <Ico className="h-5 w-5 text-muted-foreground" />; })()
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="text-xs text-muted-foreground">POS appearance — photo or icon shown on POS cards</Label>
                                            {imageUrl && (
                                                <Button type="button" variant="ghost" size="sm" className="h-6 w-fit px-1.5 text-muted-foreground" onClick={() => setImageUrl(undefined)}>
                                                    <X className="h-3.5 w-3.5 mr-1" /> Remove
                                                </Button>
                                            )}
                                        </div>
                                        <Input type="file" accept="image/*" onChange={handleImageUpload} className="h-8 max-w-xs text-xs" />
                                        <div className="flex flex-wrap gap-1.5">
                                            <button type="button" onClick={() => setIconName(undefined)}
                                                className={cn('h-7 w-7 rounded-md border flex items-center justify-center transition-colors', !iconName ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted')}
                                                title="Auto (guess from name)">
                                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                            </button>
                                            {Object.entries(PRODUCT_ICONS).map(([key, Ico]) => (
                                                <button key={key} type="button" onClick={() => setIconName(key)}
                                                    className={cn('h-7 w-7 rounded-md border flex items-center justify-center transition-colors', iconName === key ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:bg-muted')}
                                                    title={key}>
                                                    <Ico className="h-3.5 w-3.5" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField control={form.control} name="sku" render={({ field }) => (
                                    <FormItem><FormLabel>SKU (Stock Keeping Unit)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="category" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <Combobox
                                                options={categoryOptions}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                onCreateOption={addCategory}
                                                createOptionLabel={(label) => `Add category "${label}"`}
                                                placeholder="Select a category"
                                                searchPlaceholder="Search or add category..."
                                                emptyText="No category found."
                                                className="w-full"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Unit of Measure</FormLabel>
                                        <FormControl>
                                            <Combobox
                                                options={[{ label: 'None', value: 'none' }, ...unitOptions]}
                                                value={field.value || 'none'}
                                                onValueChange={field.onChange}
                                                onCreateOption={addUnit}
                                                createOptionLabel={(label) => `Add unit "${label}"`}
                                                placeholder="Select a unit"
                                                searchPlaceholder="Search or add unit..."
                                                emptyText="No unit found."
                                                className="w-full"
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">Shown next to quantities on invoices &amp; receipts.</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="barcode" render={({ field }) => (
                                    <FormItem><FormLabel>Barcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <FormField control={form.control} name="brand" render={({ field }) => (
                                    <FormItem><FormLabel>Brand</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
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
                                <FormField control={form.control} name="subscriptionId" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Link to Subscription</FormLabel>
                                        <FormControl>
                                            <Combobox
                                                options={subscriptionOptions}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="None"
                                                searchPlaceholder="Search subscriptions..."
                                                emptyText="No subscription found."
                                                className="w-full"
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">If this is resold from a recurring cost (e.g. a shared hosting plan), link it here.</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <FormField control={form.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Maximum Retail Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="cost" render={({ field }) => (
                                    <FormItem><FormLabel>Cost</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                {watchedKind !== 'service' && (
                                    <FormField control={form.control} name="stock" render={({ field }) => (
                                        <FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input
                                        type="number"
                                        step="1"
                                        inputMode="numeric"
                                        value={field.value ?? 0}
                                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : Math.trunc(Number(e.target.value)))}
                                        disabled={!!productToEdit}
                                    /></FormControl>
                                            {productToEdit && <p className="text-xs text-muted-foreground">Use “Add stock” on the row to adjust.</p>}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>

                            {/* Discount — % of MRP or a fixed amount off, with live final-price preview */}
                            <div className="space-y-2 rounded-lg border p-3">
                                <Label className="text-sm font-medium">Discount</Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <FormField control={form.control} name="discountType" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs text-muted-foreground">Discount Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="amount">Fixed amount ({currencySymbol})</SelectItem>
                                                    <SelectItem value="percent">Percentage (%)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="discount" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">{watchedDiscountType === 'amount' ? `Amount off (${currencySymbol})` : 'Percentage off (%)'}</FormLabel>
                                            <FormControl><Input type="number" step="0.01" min={0} max={watchedDiscountType === 'percent' ? 100 : undefined} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <div className="flex flex-col justify-end pb-1">
                                        <p className="text-xs text-muted-foreground">Final price</p>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Product Categories</DialogTitle>
                        <DialogDescription>View categories used when adding or editing inventory items.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                        {categoryOptions.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">No categories yet. Add one from the product form.</div>
                        ) : categoryOptions.map(option => {
                            const savedCategory = productCategories.find(category => category.name.trim().toLowerCase() === option.value.toLowerCase());
                            const linkedCount = products.filter(product => product.category?.trim().toLowerCase() === option.value.toLowerCase()).length;
                            return (
                                <div key={option.value} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{option.label}</p>
                                        <p className="text-xs text-muted-foreground">{linkedCount} item{linkedCount === 1 ? '' : 's'}</p>
                                    </div>
                                    {canDelete ? (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => setCategoryToDelete(savedCategory ?? { id: `legacy-${option.value}`, name: option.value })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete category</span>
                                        </Button>
                                    ) : (
                                        <Badge variant="outline">In use</Badge>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => { if (!open) setCategoryToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete category?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove {categoryToDelete?.name} from the category list and clear it from matching products. The products themselves will not be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteCategory} className="bg-destructive hover:bg-destructive/90">Delete Category</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!productToView} onOpenChange={(open) => !open && setProductToView(null)}>
                {productToView && (
                    <ProductDetail
                        product={productToView}
                        onEdit={canManage ? () => { const p = productToView; setProductToView(null); handleOpenForm(p); } : undefined}
                        onDuplicate={canManage ? () => { const p = productToView; setProductToView(null); handleOpenForm(p, { duplicate: true }); } : undefined}
                    />
                )}
            </Dialog>

            <AlertDialog open={!!productToDelete} onOpenChange={(open) => { if (!open) { setProductToDelete(null); setReplacementProductId(''); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{linkedServicesForDelete.length > 0 ? 'This product is linked to services' : 'Are you absolutely sure?'}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>This action cannot be undone. This will permanently delete {productToDelete?.name || 'the product'}.</p>
                                {linkedServicesForDelete.length > 0 && (
                                    <>
                                        <p>Choose whether to keep the product or remove its links and delete it.</p>
                                        <div className="rounded-md border bg-muted/40 p-3 text-foreground">
                                            <p className="font-medium text-sm">Linked services:</p>
                                            <ul className="mt-1 list-disc pl-5 text-sm">
                                                {linkedServicesForDelete.map(service => <li key={service.id}>{service.name}</li>)}
                                            </ul>
                                        </div>
                                        <div className="space-y-1.5 text-foreground">
                                            <Label htmlFor="replacement-sku">Move links to another SKU</Label>
                                            <Select value={replacementProductId} onValueChange={setReplacementProductId}>
                                                <SelectTrigger id="replacement-sku">
                                                    <SelectValue placeholder="Select replacement product" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products
                                                        .filter(p => p.kind !== 'service' && !p.deletedAt && p.id !== productToDelete?.id)
                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                        .map(p => (
                                                            <SelectItem key={p.id} value={p.id}>
                                                                {p.name}{p.sku ? ` — ${p.sku}` : ''}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{linkedServicesForDelete.length > 0 ? 'Keep Product' : 'Cancel'}</AlertDialogCancel>
                        {linkedServicesForDelete.length > 0 && (
                            <AlertDialogAction onClick={handleMoveLinksAndDelete} disabled={!replacementProductId}>
                                Move Links & Delete
                            </AlertDialogAction>
                        )}
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            {linkedServicesForDelete.length > 0 ? 'Unlink & Delete' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!pendingMerge} onOpenChange={(open) => { if (!open) setPendingMerge(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Merge duplicate product?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A product named {pendingMerge?.existing.name} with SKU {pendingMerge?.existing.sku} already exists. Merge {pendingMerge?.incoming.stock ?? 0} units into its current stock of {pendingMerge?.existing.stock ?? 0}? No duplicate POS item will be created.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Review Product</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDuplicateMerge}>Merge Stock</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!productToRestock} onOpenChange={(open) => { if (!open) { setProductToRestock(null); setRestockQty(''); setRestockMode('add'); } }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Adjust stock — {productToRestock?.name}</DialogTitle>
                        <DialogDescription>
                            Current stock: {productToRestock?.stock ?? 0}. Choose whether to add, remove, or set stock for corrections and restocking.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="restock-mode">Adjustment type</Label>
                        <Select value={restockMode} onValueChange={(value) => setRestockMode(value as 'add' | 'remove' | 'set')}>
                            <SelectTrigger id="restock-mode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="add">Add stock</SelectItem>
                                <SelectItem value="remove">Remove stock</SelectItem>
                                <SelectItem value="set">Set stock level</SelectItem>
                            </SelectContent>
                        </Select>
                        <Label htmlFor="restock-qty">{restockMode === 'set' ? 'New stock level' : restockMode === 'remove' ? 'Quantity to remove' : 'Quantity to add'}</Label>
                        <Input id="restock-qty" type="number" step="0.01" inputMode="decimal" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder={restockMode === 'set' ? 'e.g. 25' : 'e.g. 50'} autoFocus />
                        {restockQty !== '' && Number.isFinite(Number(restockQty)) && (
                            <p className="text-xs text-muted-foreground">New stock will be {calculateStockAdjustment(productToRestock?.stock ?? 0, Number(restockQty), restockMode).newStock}.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setProductToRestock(null); setRestockQty(''); setRestockMode('add'); }}>Cancel</Button>
                        <Button onClick={handleRestock}>Update stock</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
