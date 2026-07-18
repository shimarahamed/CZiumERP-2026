
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, orderBy, type Query } from "firebase/firestore";
import { sendDepartmentEmail } from '@/lib/email';
import { cn } from '@/lib/utils';
import { useRequirePermission } from '@/hooks/use-require-role';
import { buildApprovalWorkflow } from '@/lib/approvals';
import { adjustStock, consumeLotFEFO, getDefaultWarehouse, setSerialStatus, stockLevelId } from '@/lib/warehouse';
import { resolveTaxRate } from '@/lib/tax';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CustomFieldsFormSection } from "@/components/custom-fields/CustomFields";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from '@/hooks/use-debounce';
import { buildInvoiceLedgerEntries, postInvoiceServerSideFast } from '@/lib/posting';
import { DEFAULT_LOYALTY_TIERS, resolveLoyaltyTier } from '@/lib/loyalty';
import Header from "@/components/Header";
import { TableSkeleton } from "@/components/TableSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import InvoiceDetail from "@/components/InvoiceDetail";
import FullInvoice from "@/components/FullInvoice";
import InvoiceReceiptView from "@/components/InvoiceReceiptView";
import { useAppContext } from "@/context/AppContext";
import { getNextDocumentNumber, bumpCounterToAtLeast } from '@/lib/document-number';
import { formatDateUK } from '@/lib/date-format';
import { formatNumber, lineTotal, mulMoney, addMoney, discountedUnitPrice, invoiceDiscountAmount, percentOf } from '@/lib/money';
import type { Invoice, InvoiceItem, Customer, CustomerTier, RecurringInvoice, RecurringFrequency, Attachment, Currency } from "@/types";
import { Combobox } from "@/components/ui/combobox";
import BarcodeScanner from "@/components/BarcodeScanner";
import { MoreHorizontal, PlusCircle, Trash2, ScanLine, ScrollText, FileText, Info, ArrowUpDown, CheckCircle, X, Paperclip, RefreshCw, Pause, Play, Loader2, CreditCard } from "@/components/icons";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { db } from "@/lib/firebase";
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const INVOICES_COLUMNS: ColumnDef[] = [
    { id: 'id', label: 'Invoice ID', locked: true },
    { id: 'customerName', label: 'Customer' },
    { id: 'amount', label: 'Amount' },
    { id: 'status', label: 'Status' },
    { id: 'date', label: 'Date' },
];

const RECURRING_INVOICES_COLUMNS: ColumnDef[] = [
    { id: 'id', label: 'ID', locked: true },
    { id: 'customerName', label: 'Customer' },
    { id: 'amount', label: 'Amount' },
    { id: 'frequency', label: 'Frequency' },
    { id: 'nextDueDate', label: 'Next Due' },
    { id: 'status', label: 'Status' },
];

const CURRENCIES: Currency[] = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'];
const MAX_FILE_SIZE = 512000;
const WARN_TOTAL_SIZE = 819200;

const invoiceItemSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  notes: z.string().optional(),
});

const customLineSchema = z.object({
  description: z.string().min(1, "Enter a description."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Amount can't be negative."),
});

const invoiceSchema = z.object({
  customerId: z.string().optional(),
  walkInName: z.string().optional(),
  walkInPhone: z.string().optional(),
  walkInEmail: z.string().optional(),
  saveWalkInToCustomers: z.boolean().optional(),
  status: z.enum(['paid', 'pending', 'overdue', 'pending-approval']),
  paymentMethod: z.string().optional(),
  currency: z.enum(['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR']).optional(),
  date: z.date(),
  items: z.array(invoiceItemSchema),
  customLines: z.array(customLineSchema),
  discount: z.coerce.number().min(0).optional(),
  discountType: z.enum(['percent', 'amount']).optional(),
  taxRate: z.coerce.number().min(0).max(100, "Tax rate cannot exceed 100%.").optional(),
  salesperson: z.string().optional(),
}).refine(data => data.items.length + data.customLines.length > 0, {
  message: "Invoice must have at least one item or custom line.",
  path: ['items'],
});

const recurringItemSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  quantity: z.coerce.number().min(1),
  price: z.coerce.number().min(0),
  cost: z.coerce.number().min(0),
});

const recurringSchema = z.object({
  customerId: z.string().optional(),
  currency: z.enum(['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR']).optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: z.date(),
  discount: z.coerce.number().min(0).optional(),
  discountType: z.enum(['percent', 'amount']).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  items: z.array(recurringItemSchema).min(1, "Must have at least one item."),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;
type RecurringFormData = z.infer<typeof recurringSchema>;
type SortKey = 'id' | 'customerName' | 'amount' | 'date';

const statusVariant: { [key in Invoice['status']]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    paid: 'default',
    pending: 'secondary',
    overdue: 'destructive',
    refunded: 'outline',
    'partially-refunded': 'outline',
    'pending-approval': 'secondary',
};

function advanceByFrequency(date: string, frequency: RecurringFrequency): string {
    const d = parseISO(date);
    switch (frequency) {
        case 'weekly': return format(addWeeks(d, 1), 'yyyy-MM-dd');
        case 'monthly': return format(addMonths(d, 1), 'yyyy-MM-dd');
        case 'quarterly': return format(addMonths(d, 3), 'yyyy-MM-dd');
        case 'yearly': return format(addYears(d, 1), 'yyyy-MM-dd');
    }
}

export default function InvoicesPage() {
  usePageTitle('Invoices');
    const {
        invoices: allInvoices,
        setInvoices,
        customers, setCustomers,
        products, setProducts,
        recurringInvoices, setRecurringInvoices,
        setLedgerEntries,
        addActivityLog, currentStore, currencySymbol, currencySymbols, currency, user, users, employees, themeSettings, addNotification,
        isDataLoaded, tenantId, companyName,
        smtpConfigList, emailTemplates, setEmailLogs,
        approvalWorkflows, setApprovalWorkflows,
        warehouses, stockLevels, setStockLevels,
        lots, setLots, serialUnits, setSerialUnits,
        taxRates, stores } = useAppContext();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stockIssues, setStockIssues] = useState<{ productId: string; name: string; available: number; needed: number }[]>([]);
    const [pendingSubmitData, setPendingSubmitData] = useState<InvoiceFormData | null>(null);
    const [customData, setCustomData] = useState<Record<string, unknown>>({});
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
    const [viewingFullInvoice, setViewingFullInvoice] = useState<Invoice | null>(null);
    const [justCreatedInvoice, setJustCreatedInvoice] = useState<Invoice | null>(null);
    const [activeTier, setActiveTier] = useState<CustomerTier | null>(null);
    const [invoiceToApprove, setInvoiceToApprove] = useState<Invoice | null>(null);
    const [invoiceToReject, setInvoiceToReject] = useState<Invoice | null>(null);
    const [invoiceRejectionReason, setInvoiceRejectionReason] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Recurring
    const [isRecurringFormOpen, setIsRecurringFormOpen] = useState(false);
    const [recurringToEdit, setRecurringToEdit] = useState<RecurringInvoice | null>(null);

    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isInitialRender = useRef(true);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 250);
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [activeTab, setActiveTab] = useState('all');

    const canManage = useRequirePermission('Sales & Customers', 'edit');
    const invoicesColumnVisibility = useColumnVisibility('invoices', INVOICES_COLUMNS);
    const { isVisible: isInvoiceColVisible } = invoicesColumnVisibility;
    const recurringColumnVisibility = useColumnVisibility('recurringInvoices', RECURRING_INVOICES_COLUMNS);
    const { isVisible: isRecurringColVisible } = recurringColumnVisibility;

    // --- Invoice form ---
    const form = useForm<InvoiceFormData>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            customerId: 'none',
            walkInName: '',
            walkInPhone: '',
            walkInEmail: '',
            saveWalkInToCustomers: false,
            status: 'pending',
            paymentMethod: 'Cash',
            currency: undefined,
            date: new Date(),
            items: [{ productId: '', quantity: 1 }],
            customLines: [],
            discount: 0,
            discountType: 'amount',
            taxRate: 0,
            salesperson: '',
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
    const { fields: customLineFields, append: appendCustomLine, remove: removeCustomLine } = useFieldArray({ control: form.control, name: "customLines" });
    const [expandedItemNotes, setExpandedItemNotes] = useState<Set<string>>(new Set());
    const toggleItemNotes = (fieldId: string) => setExpandedItemNotes(prev => {
        const next = new Set(prev);
        if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
        return next;
    });

    // --- Recurring form ---
    const recurringForm = useForm<RecurringFormData>({
        resolver: zodResolver(recurringSchema),
        defaultValues: {
            customerId: 'none',
            currency: undefined,
            frequency: 'monthly',
            startDate: new Date(),
            discount: 0,
            discountType: 'amount',
            taxRate: 0,
            items: [{ productId: '', quantity: 1, price: 0, cost: 0 }],
        },
    });
    const { fields: recurringFields, append: appendItem, remove: removeItem } = useFieldArray({ control: recurringForm.control, name: "items" });

    const invoicesQuery = useMemo(() => {
        if (!tenantId) return null;
        const coll = collection(db, 'tenants', tenantId, 'invoices');
        let q: Query = query(coll);
        if (currentStore?.id !== 'all') {
            q = query(q, where('storeId', '==', currentStore?.id));
        }
        if (activeTab !== 'all' && activeTab !== 'refunded' && activeTab !== 'pending-approval') {
            q = query(q, where('status', '==', activeTab));
        } else if (activeTab === 'refunded') {
            q = query(q, where('status', 'in', ['refunded', 'partially-refunded']));
        } else if (activeTab === 'pending-approval') {
            q = query(q, where('status', '==', 'pending-approval'));
        }
        q = query(q, orderBy(sortKey, sortDirection));
        return q;
    }, [currentStore, activeTab, sortKey, sortDirection, tenantId]);

    const { data: serverInvoices } = useFirestoreQuery<Invoice>(invoicesQuery as Query<Invoice>);

    const filteredAndSearchedInvoices = useMemo(() => {
        if (!debouncedSearch) return serverInvoices;
        return serverInvoices.filter(invoice =>
            invoice.id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (invoice.predictedId?.toLowerCase().includes(debouncedSearch.toLowerCase()) ?? false) ||
            (invoice.customerName && invoice.customerName.toLowerCase().includes(debouncedSearch.toLowerCase()))
        );
    }, [serverInvoices, debouncedSearch]);

    const pendingApprovalCount = useMemo(() =>
        allInvoices.filter(inv => inv.status === 'pending-approval').length,
    [allInvoices]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('asc'); }
    };

    const watchedItems = useWatch({ control: form.control, name: 'items' });
    const watchedCustomLines = useWatch({ control: form.control, name: 'customLines' });
    const watchedDiscount = useWatch({ control: form.control, name: 'discount' }) || 0;
    const watchedDiscountType = useWatch({ control: form.control, name: 'discountType' }) || 'amount';
    const watchedTaxRate = useWatch({ control: form.control, name: 'taxRate' }) || 0;
    const paymentMethodOptions = useMemo(() => {
        const configured = themeSettings.paymentMethods;
        return configured && configured.length > 0 ? configured : ['Cash', 'Card'];
    }, [themeSettings.paymentMethods]);
    const watchedCustomerId = useWatch({ control: form.control, name: 'customerId' });
    const watchedWalkInName = useWatch({ control: form.control, name: 'walkInName' });

    const subtotal = useMemo(() => {
        // Each product line is net of the product's own discount %; the
        // invoice-level discount below applies on top.
        const productTotal = watchedItems.reduce((acc, item) => {
            const product = products.find(p => p.id === item.productId);
            return acc + (product ? lineTotal(product.price, item.quantity || 0, product.discount, product.discountType) : 0);
        }, 0);
        const customTotal = (watchedCustomLines ?? []).reduce((acc, line) => acc + (line.price || 0) * (line.quantity || 0), 0);
        return productTotal + customTotal;
    }, [watchedItems, watchedCustomLines, products]);

    // Gross figure (before any per-item discount) — shown as "Subtotal" so the
    // Discount row can carry the item discounts instead of them silently
    // vanishing into a lower subtotal while the discount field reads 0.
    const grossSubtotal = useMemo(() => {
        const productTotal = watchedItems.reduce((acc, item) => {
            const product = products.find(p => p.id === item.productId);
            return acc + (product ? mulMoney(product.price, item.quantity || 0) : 0);
        }, 0);
        const customTotal = (watchedCustomLines ?? []).reduce((acc, line) => acc + (line.price || 0) * (line.quantity || 0), 0);
        return productTotal + customTotal;
    }, [watchedItems, watchedCustomLines, products]);
    const itemDiscounts = useMemo(() => grossSubtotal - subtotal, [grossSubtotal, subtotal]);
    const discountAmount = useMemo(() => invoiceDiscountAmount(subtotal, watchedDiscount, watchedDiscountType), [subtotal, watchedDiscount, watchedDiscountType]);
    const taxAmount = useMemo(() => percentOf(subtotal - discountAmount, watchedTaxRate || 0), [subtotal, discountAmount, watchedTaxRate]);
    const totalAmount = useMemo(() => addMoney(subtotal, -discountAmount, taxAmount), [subtotal, discountAmount, taxAmount]);

    // Hint shows the effective unit price (net of the product's own discount)
    // right-aligned in the dropdown, so cashiers see amounts while picking.
    const productOptions = useMemo(() => products.map(p => ({
        label: p.name,
        value: p.id,
        hint: `${currencySymbol} ${formatNumber(discountedUnitPrice(p.price, p.discount, p.discountType))}`,
    })), [products, currencySymbol]);
    // Walk-in first, then customers — label embeds phone/email so the combobox
    // search matches on name, phone, OR email (e.g. type a phone to find them).
    const customerOptions = useMemo(() => [
        { label: 'Walk-in Customer', value: 'walk-in' },
        ...customers.map(c => ({ label: [c.name, c.phone, c.email].filter(Boolean).join(' · '), value: c.id })),
    ], [customers]);

    const handleOpenForm = useCallback((invoice: Invoice | null = null) => {
        setInvoiceToEdit(invoice);
        setAttachments(invoice?.attachments ?? []);
        setIsFormOpen(true);
    }, []);

    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            handleOpenForm(null);
            router.replace('/invoices', { scroll: false });
        }
    }, [searchParams, handleOpenForm, router]);

    useEffect(() => {
        if (isFormOpen) {
            setCustomData(invoiceToEdit?.customData ?? {});
            if (invoiceToEdit) {
                const isWalkIn = !invoiceToEdit.customerId;
                form.reset({
                    customerId: invoiceToEdit.customerId || 'walk-in',
                    walkInName: isWalkIn ? (invoiceToEdit.customerName ?? '') : '',
                    walkInPhone: isWalkIn ? (invoiceToEdit.customerPhone ?? '') : '',
                    walkInEmail: isWalkIn ? (invoiceToEdit.customerEmail ?? '') : '',
                    saveWalkInToCustomers: false,
                    status: (['paid','pending','overdue'].includes(invoiceToEdit.status) ? invoiceToEdit.status : 'pending') as 'paid' | 'pending' | 'overdue',
                    paymentMethod: invoiceToEdit.paymentMethod ?? paymentMethodOptions[0] ?? 'Cash',
                    currency: invoiceToEdit.currency,
                    date: new Date(invoiceToEdit.date),
                    items: invoiceToEdit.items.filter(item => !item.isCustom).map(item => ({ productId: item.productId, quantity: item.quantity, notes: item.notes })),
                    customLines: invoiceToEdit.items.filter(item => item.isCustom).map(item => ({ description: item.productName, quantity: item.quantity, price: item.price })),
                    discount: invoiceToEdit.discount || 0,
                    discountType: invoiceToEdit.discountType || 'percent',
                    taxRate: invoiceToEdit.taxRate || 0,
                    salesperson: invoiceToEdit.salesperson ?? '',
                });
            } else {
                // Auto-fill the tax rate from the current store's jurisdiction, if one is
                // configured — falls back to the tenant-wide default rate, then 0, so a
                // tenant that never touches Store.taxJurisdiction sees identical behavior.
                const store = stores.find(s => s.id === currentStore?.id);
                const autoTaxRate = resolveTaxRate(store, taxRates)?.rate ?? 0;
                form.reset({
                    customerId: 'walk-in',
                    walkInName: '',
                    walkInPhone: '',
                    walkInEmail: '',
                    saveWalkInToCustomers: false,
                    status: themeSettings.defaultInvoiceStatus ?? 'paid',
                    paymentMethod: paymentMethodOptions[0] ?? 'Cash',
                    currency: undefined,
                    date: new Date(),
                    items: [{ productId: '', quantity: 1 }],
                    customLines: [],
                    discount: 0,
                    discountType: 'amount',
                    taxRate: autoTaxRate,
                    salesperson: '',
                });
            }
            const customer = customers.find(c => c.id === form.getValues('customerId'));
            setActiveTier(customer?.tier && customer.tier !== 'Bronze' ? customer.tier : null);
            isInitialRender.current = true;
        }
        // Intentionally scoped to "dialog opened / edit target changed" — including
        // stores/taxRates/currentStore would reset the form mid-edit whenever those
        // background collections re-sync from Firestore.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoiceToEdit, isFormOpen, form, customers]);

    useEffect(() => {
        if (isInitialRender.current) { isInitialRender.current = false; return; }
        const customer = customers.find(c => c.id === watchedCustomerId);
        const loyaltyTiers = themeSettings.loyaltySettings?.tiers || DEFAULT_LOYALTY_TIERS;
        const tierDiscounts = { Bronze: 0, Silver: loyaltyTiers.Silver.discount, Gold: loyaltyTiers.Gold.discount };
        if (customer?.tier) {
            const rate = tierDiscounts[customer.tier];
            form.setValue('discount', rate, { shouldValidate: true });
            form.setValue('discountType', 'percent', { shouldValidate: true });
            setActiveTier(rate > 0 ? customer.tier : null);
        } else {
            form.setValue('discount', 0, { shouldValidate: true });
            form.setValue('discountType', 'amount', { shouldValidate: true });
            setActiveTier(null);
        }
    }, [watchedCustomerId, customers, form, themeSettings.loyaltySettings]);

    const handleScanSuccess = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            append({ productId: product.id, quantity: 1 });
            toast({ title: "Product Added by Scan", description: product.name });
        } else {
            toast({ variant: 'destructive', title: "Product Not Found", description: `No product matched the scanned code.` });
        }
        setIsScannerOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            toast({ title: 'File too large', description: 'Maximum file size is 500 KB.', variant: 'destructive' });
            return;
        }
        const totalSize = attachments.reduce((s, a) => s + a.fileSize, 0) + file.size;
        if (totalSize > WARN_TOTAL_SIZE) toast({ title: 'Attachment size warning', description: 'Total attachments exceed 800 KB.' });
        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachments(prev => [...prev, {
                id: `att-${Date.now()}`,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                uploadedBy: user?.email ?? 'unknown',
                uploadedAt: new Date().toISOString(),
                dataUrl: reader.result as string,
            }]);
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Post balanced GL entries when an invoice becomes paid. Firestore rules
    // only allow managers/admins to create ledgerEntries, so cashier sales are
    // ledgered later by the server function (postInvoiceWithLedger) once
    // Cloud Functions are deployed.
    const postLedgerForPaidInvoice = (invoice: Invoice) => {
        if (user?.role !== 'admin' && user?.role !== 'manager') return;
        const entries = buildInvoiceLedgerEntries(invoice);
        setLedgerEntries(prev => {
            const entryIds = new Set(entries.map(e => e.id));
            return [...entries, ...prev.filter(e => !entryIds.has(e.id))];
        });
    };

    const onSubmit = async (data: InvoiceFormData) => {
        // Guard against double-submit: the create path awaits an async counter
        // transaction, so a second click before it resolves would mint a second
        // invoice. Ignore re-entrant calls until this one finishes.
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await submitInvoice(data);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Called from the stock-issue dialog's "Override & Continue" — resubmits the
    // same form data, skipping the availability check so stock can go negative.
    const submitWithStockOverride = async () => {
        if (!pendingSubmitData) return;
        const data = pendingSubmitData;
        setStockIssues([]);
        setPendingSubmitData(null);
        setIsSubmitting(true);
        try {
            await submitInvoice(data, true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Called from the stock-issue dialog's "Remove" per item — drops that line
    // from the form's item list, then re-checks availability with the rest.
    const removeStockIssueItem = (productId: string) => {
        const idx = fields.findIndex((f, i) => form.getValues(`items.${i}.productId`) === productId);
        if (idx > -1) remove(idx);
        setStockIssues(prev => prev.filter(i => i.productId !== productId));
        setPendingSubmitData(prev => prev ? { ...prev, items: prev.items.filter(it => it.productId !== productId) } : prev);
    };

    const submitInvoice = async (data: InvoiceFormData, overrideStock = false) => {
        const existingCustomer = customers.find(c => c.id === data.customerId);
        const isWalkIn = !existingCustomer; // no saved customer selected → walk-in

        // If the cashier ticked "save to customers", promote this walk-in into a
        // real saved Customer so it links to the invoice and is reusable later.
        let customer = existingCustomer;
        const walkInName = data.walkInName?.trim();
        if (isWalkIn && data.saveWalkInToCustomers && walkInName) {
            const newCustomer: Customer = {
                id: `cust-${Date.now()}`,
                name: walkInName,
                email: data.walkInEmail?.trim() || '',
                phone: data.walkInPhone?.trim() || '',
                avatar: '',
                loyaltyPoints: 0,
                tier: 'Bronze',
            };
            setCustomers(prev => [newCustomer, ...prev]);
            customer = newCustomer;
        }

        // Snapshot of who this invoice is for: a saved customer's details, or the
        // optional walk-in name/phone/email typed on the form (all may be blank).
        const customerFields = customer
            ? {
                customerId: customer.id,
                customerName: customer.name,
                customerPhone: customer.phone || undefined,
                customerEmail: customer.email || undefined,
            }
            : {
                customerId: undefined,
                customerName: walkInName || undefined,
                customerPhone: data.walkInPhone?.trim() || undefined,
                customerEmail: data.walkInEmail?.trim() || undefined,
            };
        const newInvoiceItems: InvoiceItem[] = [];
        for (const item of data.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) {
                toast({ variant: 'destructive', title: 'Product Not Found', description: `A selected product no longer exists.` });
                return;
            }
            newInvoiceItems.push({ productId: product.id, productName: product.name, quantity: item.quantity, price: product.price, cost: product.cost, ...(product.discount ? { discount: product.discount, discountType: product.discountType ?? 'percent' } : {}), unit: product.unitOfMeasure || 'Pcs', ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}) });
        }
        // Custom lines (e.g. one-off fees) carry no product/stock record and never
        // touch the warehouse/stock-reservation logic below.
        data.customLines.forEach((line, i) => {
            newInvoiceItems.push({ productId: `custom-${Date.now()}-${i}`, productName: line.description, quantity: line.quantity, price: line.price, cost: 0, isCustom: true });
        });

        // Resolve which warehouse this sale draws from: the one linked to the invoice's
        // store, else the tenant's default warehouse. Falls back to legacy Product.stock-only
        // behavior if no warehouse exists yet (shouldn't happen post-migration, but keeps
        // this path safe for a tenant mid-migration).
        const saleWarehouse = warehouses.find(w => w.storeId === currentStore?.id) ?? getDefaultWarehouse(warehouses);

        // Build the net stock consumption per physical product across every line.
        // A product line consumes itself; a service line consumes each of its
        // linked products by (link.quantity × line.quantity). We compute the net
        // DELTA vs. what this invoice previously reserved (on edit) so re-saving
        // doesn't double-decrement. Consumption is keyed by productId → units.
        const consumptionFor = (items: { productId: string; quantity: number }[]) => {
            const map = new Map<string, number>();
            for (const item of items) {
                const p = products.find(pr => pr.id === item.productId);
                if (!p) continue;
                if (p.kind === 'service') {
                    for (const link of p.serviceLinks ?? []) {
                        map.set(link.productId, (map.get(link.productId) ?? 0) + link.quantity * item.quantity);
                    }
                } else {
                    map.set(p.id, (map.get(p.id) ?? 0) + item.quantity);
                }
            }
            return map;
        };
        const newConsumption = consumptionFor(data.items);
        const prevConsumption = invoiceToEdit ? consumptionFor(invoiceToEdit.items.filter(i => !i.isCustom)) : new Map<string, number>();
        // Net units to remove from each product's stock = new − previously reserved.
        const netDelta = new Map<string, number>();
        for (const [pid, qty] of newConsumption) netDelta.set(pid, qty - (prevConsumption.get(pid) ?? 0));
        for (const [pid, qty] of prevConsumption) if (!newConsumption.has(pid)) netDelta.set(pid, -(qty));

        // Availability check — only for products being consumed MORE than before.
        const issues: { productId: string; name: string; available: number; needed: number }[] = [];
        for (const [pid, delta] of netDelta) {
            if (delta <= 0) continue;
            const prod = products.find(p => p.id === pid);
            if (!prod) continue;
            // Product.stock is the authoritative on-hand figure (it's what Inventory
            // shows and stays in sync immutably here). A per-warehouse StockLevel row is
            // a secondary mirror; we only let it RAISE availability (multi-warehouse
            // depth), never lower it below the product's own stock — otherwise a stale
            // or mis-seeded warehouse row would wrongly block an otherwise-valid sale.
            const warehouseStock = saleWarehouse
                ? stockLevels.find(s => s.id === stockLevelId(pid, saleWarehouse.id))?.stock
                : undefined;
            const available = Math.max(prod.stock, warehouseStock ?? prod.stock);
            if (available < delta) {
                issues.push({ productId: pid, name: prod.name, available, needed: delta });
            }
        }
        if (issues.length > 0 && !overrideStock) {
            setStockIssues(issues);
            setPendingSubmitData(data);
            return;
        }

        const backendFirstPaidInvoice = !invoiceToEdit && data.status === 'paid';
        if (backendFirstPaidInvoice) {
            const invoicePrefix = themeSettings.invoicePrefix || 'INV-';
            const serverInvoice: Invoice = {
                id: '',
                storeId: currentStore?.id,
                ...customerFields,
                userId: user?.id,
                userName: user?.name,
                status: 'paid',
                paymentMethod: data.paymentMethod,
                currency: data.currency,
                date: format(data.date, 'yyyy-MM-dd'),
                createdAt: new Date().toISOString(),
                dueDate: format(addDays(data.date, 30), 'yyyy-MM-dd'),
                items: newInvoiceItems,
                amount: totalAmount,
                discount: data.discount,
                discountType: data.discountType,
                taxRate: data.taxRate,
                salesperson: data.salesperson || undefined,
                attachments,
                ...(Object.keys(customData).length > 0 ? { customData } : {}),
                ...(overrideStock ? { allowNegativeStock: true } : {}),
            };

            try {
                const postedInvoice = await postInvoiceServerSideFast(serverInvoice, invoicePrefix);
                if (postedInvoice) {
                    setInvoices(prev => [postedInvoice, ...prev.filter(inv => inv.id !== postedInvoice.id)]);

                    if (!isWalkIn && customer) {
                        const loyaltyTiers = themeSettings.loyaltySettings?.tiers || DEFAULT_LOYALTY_TIERS;
                        const customerIndex = customers.findIndex(c => c.id === customer.id);
                        if (customerIndex > -1) {
                            const updatedCustomers = [...customers];
                            const customerToUpdate = { ...updatedCustomers[customerIndex] };
                            const pointsEarned = Math.floor(postedInvoice.amount);
                            customerToUpdate.loyaltyPoints = (customerToUpdate.loyaltyPoints || 0) + pointsEarned;
                            customerToUpdate.tier = resolveLoyaltyTier(customerToUpdate.loyaltyPoints, loyaltyTiers);
                            updatedCustomers[customerIndex] = customerToUpdate;
                            setCustomers(updatedCustomers);
                            toast({ title: "Loyalty Points Awarded!", description: `${customerToUpdate.name} earned ${pointsEarned} points.` });
                        }
                    }

                    toast({ title: "Invoice Posted", description: `Backend posted invoice #${postedInvoice.id}.` });
                    addActivityLog('Invoice Created', `Created invoice #${postedInvoice.id} for ${currencySymbol} ${formatNumber(postedInvoice.amount)}`);
                    if (customer?.email) {
                        void sendDepartmentEmail(
                            { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                            'Sales & Customers',
                            'invoice-created',
                            customer.email,
                            { invoiceId: postedInvoice.id, customerName: customer.name, amount: `${currencySymbol} ${formatNumber(postedInvoice.amount)}`, companyName },
                            user?.name ?? 'system'
                        );
                    }
                    setJustCreatedInvoice(postedInvoice);
                    setIsFormOpen(false);
                    setInvoiceToEdit(null);
                    setAttachments([]);
                    return;
                }
            } catch (error) {
                toast({
                    variant: 'destructive',
                    title: 'Could not post invoice',
                    description: error instanceof Error ? error.message : 'The backend rejected this invoice.',
                });
                return;
            }
        }

        // Apply decrements immutably — new product objects so setProducts' change
        // detection actually fires (mutating in place was silently skipping writes).
        const updatedProducts = products.map(p => {
            const delta = netDelta.get(p.id);
            if (!delta) return p;
            return { ...p, stock: p.stock - delta };
        });
        for (const [pid, delta] of netDelta) {
            if (delta === 0) continue;
            const prod = updatedProducts.find(p => p.id === pid);
            // Baseline for seeding a first-ever StockLevel row is the product's stock
            // BEFORE this decrement (updatedProducts already has it applied).
            const baseline = products.find(p => p.id === pid)?.stock ?? 0;
            if (saleWarehouse) {
                const isNewSaleOfTrackedProduct = !invoiceToEdit && delta > 0 &&
                    (prod?.trackingMode === 'lot' || prod?.trackingMode === 'serial');
                if (isNewSaleOfTrackedProduct && prod?.trackingMode === 'lot') {
                    consumeLotFEFO({ stockLevels, setStockLevels, lots, setLots }, pid, saleWarehouse.id, delta);
                } else if (isNewSaleOfTrackedProduct && prod?.trackingMode === 'serial') {
                    const toSell = serialUnits
                        .filter(s => s.productId === pid && s.warehouseId === saleWarehouse.id && s.status === 'in-stock')
                        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
                        .slice(0, delta);
                    toSell.forEach(unit => setSerialStatus({ stockLevels, setStockLevels, serialUnits, setSerialUnits }, unit.id, 'sold'));
                } else {
                    adjustStock({ stockLevels, setStockLevels }, pid, saleWarehouse.id, -delta, baseline);
                }
            }
            if (prod && typeof prod.reorderThreshold !== 'undefined' && prod.stock <= prod.reorderThreshold) {
                addNotification({ title: 'Low Stock Alert', description: `${prod.name} is low on stock (${prod.stock} remaining).`, href: `/purchase-orders?action=new&productId=${prod.id}&vendorId=${prod.vendorId || ''}` });
            }
        }
        setProducts(updatedProducts);

        // Loyalty points (walk-in invoices have no saved customer to credit)
        if (data.status === 'paid' && !isWalkIn) {
            const wasAlreadyPaid = invoiceToEdit?.status === 'paid';
            const loyaltyTiers = themeSettings.loyaltySettings?.tiers || DEFAULT_LOYALTY_TIERS;
            if (!wasAlreadyPaid) {
                const customerIndex = customers.findIndex(c => c.id === data.customerId);
                if (customerIndex > -1) {
                    const updatedCustomers = [...customers];
                    const customerToUpdate = { ...updatedCustomers[customerIndex] };
                    const pointsEarned = Math.floor(totalAmount);
                    customerToUpdate.loyaltyPoints = (customerToUpdate.loyaltyPoints || 0) + pointsEarned;
                    customerToUpdate.tier = resolveLoyaltyTier(customerToUpdate.loyaltyPoints, loyaltyTiers);
                    updatedCustomers[customerIndex] = customerToUpdate;
                    setCustomers(updatedCustomers);
                    toast({ title: "Loyalty Points Awarded!", description: `${customerToUpdate.name} earned ${pointsEarned} points.` });
                }
            }
        }

        if (invoiceToEdit) {
            const FINAL_STATUSES: Invoice['status'][] = ['paid', 'refunded', 'partially-refunded'];
            if (FINAL_STATUSES.includes(invoiceToEdit.status) && !FINAL_STATUSES.includes(data.status)) {
                toast({ variant: 'destructive', title: 'Invalid Status Change', description: `Cannot revert a ${invoiceToEdit.status} invoice to ${data.status}.` });
                return;
            }
            const oldStatus = invoiceToEdit.status;
            const liveInvoice = allInvoices.find(inv => inv.id === invoiceToEdit.id) ?? invoiceToEdit;
            const updatedInvoice: Invoice = {
                ...liveInvoice,
                ...customerFields,
                userId: user?.id,
                userName: user?.name,
                status: data.status,
                paymentMethod: data.paymentMethod,
                currency: data.currency,
                date: format(data.date, 'yyyy-MM-dd'),
                items: newInvoiceItems,
                amount: totalAmount,
                discount: data.discount,
                discountType: data.discountType,
                taxRate: data.taxRate,
                salesperson: data.salesperson || undefined,
                attachments,
                ...(Object.keys(customData).length > 0 ? { customData } : {}),
            };
            setInvoices(allInvoices.map(inv => inv.id === invoiceToEdit.id ? updatedInvoice : inv));
            if (oldStatus !== 'paid' && data.status === 'paid') {
                postLedgerForPaidInvoice(updatedInvoice);
            }
            toast({ title: "Invoice Updated" });
            addActivityLog('Invoice Updated', `Updated invoice #${invoiceToEdit.id}.`, [
                ...(oldStatus !== data.status ? [{ field: 'status', from: oldStatus, to: data.status }] : []),
            ]);
        } else {
            const invoicePrefix = themeSettings.invoicePrefix || 'INV-';
            // Optimistic numbering: compute the next number synchronously from the
            // highest existing invoice so the invoice appears instantly — no waiting
            // on a network round-trip. The authoritative atomic counter is advanced
            // in the background below (fire-and-forget) so it stays in sync for the
            // next session / other devices. The isSubmitting guard prevents a
            // double-click from minting two numbers within this session.
            const nextNum = allInvoices.reduce((max, inv) => { const num = parseInt(inv.id.replace(invoicePrefix, ''), 10); return isNaN(num) ? max : Math.max(max, num); }, 0) + 1;
            const invoiceId = `${invoicePrefix}${String(nextNum).padStart(3, '0')}`;
            // Advance the server counter in the background — never blocks creation.
            if (tenantId) {
                void bumpCounterToAtLeast(tenantId, 'invoice', nextNum);
            }

            // Determine effective status — a configured multi-step approvalRules['invoice']
            // chain supersedes the legacy single threshold; buildApprovalWorkflow returns null
            // when no rule is set or the amount is under threshold, falling back to the old
            // invoiceApprovalThreshold behavior automatically for tenants without a chain.
            let effectiveStatus = data.status;
            let invoiceWorkflow: ReturnType<typeof buildApprovalWorkflow> = null;
            if (data.status !== 'paid') {
                if (themeSettings.approvalRules?.['invoice'] && user) {
                    invoiceWorkflow = buildApprovalWorkflow('invoice', invoiceId, `Invoice ${invoiceId} — ${customer?.name ?? 'walk-in customer'}`, totalAmount, user, themeSettings.approvalRules, users, currentStore?.id, employees);
                    if (invoiceWorkflow) effectiveStatus = 'pending-approval';
                } else {
                    const legacyThreshold = themeSettings.invoiceApprovalThreshold ?? 0;
                    if (legacyThreshold > 0 && totalAmount > legacyThreshold) {
                        effectiveStatus = 'pending-approval';
                    }
                }
            }

            const newInvoice: Invoice = {
                id: invoiceId,
                storeId: currentStore?.id,
                ...customerFields,
                userId: user?.id,
                userName: user?.name,
                status: effectiveStatus,
                paymentMethod: data.paymentMethod,
                currency: data.currency,
                date: format(data.date, 'yyyy-MM-dd'),
                createdAt: new Date().toISOString(),
                dueDate: format(addDays(data.date, 30), 'yyyy-MM-dd'),
                items: newInvoiceItems,
                amount: totalAmount,
                discount: data.discount,
                discountType: data.discountType,
                taxRate: data.taxRate,
                salesperson: data.salesperson || undefined,
                attachments,
                ...(Object.keys(customData).length > 0 ? { customData } : {}),
            };
            setInvoices([newInvoice, ...allInvoices]);
            if (invoiceWorkflow) setApprovalWorkflows(prev => [invoiceWorkflow!, ...prev]);
            if (effectiveStatus === 'paid') {
                postLedgerForPaidInvoice(newInvoice);
            }
            if (effectiveStatus === 'pending-approval') {
                toast({ title: "Invoice Pending Approval", description: `Invoice #${newInvoice.id} exceeds the approval threshold and requires manager approval.` });
                addNotification({ title: 'Invoice Requires Approval', description: `Invoice #${newInvoice.id} (${currencySymbol} ${formatNumber(totalAmount)}) needs approval.`, href: '/invoices' });
            } else {
                toast({ title: "Invoice Created" });
            }
            addActivityLog('Invoice Created', `Created invoice #${newInvoice.id} for ${currencySymbol} ${formatNumber(totalAmount)}`);
            if (customer?.email) {
                void sendDepartmentEmail(
                    { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                    'Sales & Customers',
                    'invoice-created',
                    customer.email,
                    { invoiceId: newInvoice.id, customerName: customer.name, amount: `${currencySymbol} ${formatNumber(totalAmount)}`, companyName },
                    user?.name ?? 'system'
                );
            }
            // Show the invoice + receipt side by side so the user can print/email
            // whichever they want without hunting for the new row in the list.
            setJustCreatedInvoice(newInvoice);
        }
        setIsFormOpen(false);
        setInvoiceToEdit(null);
        setAttachments([]);
    };

    // Shared finalize step for both the legacy instant approve/reject buttons and the new
    // multi-step ApprovalWorkflowPanel completion callback.
    const finalizeInvoiceDecision = (invoice: Invoice, decision: 'approved' | 'rejected', reason?: string) => {
        if (!user) return;
        setInvoices(allInvoices.map(inv => inv.id === invoice.id
            ? { ...inv, status: 'pending', rejectionReason: decision === 'rejected' ? reason : inv.rejectionReason, decidedBy: user.email, decidedAt: new Date().toISOString() }
            : inv
        ));
        addActivityLog(`Invoice ${decision === 'approved' ? 'Approved' : 'Rejected'}`, `Invoice #${invoice.id} ${decision} by ${user.email}.`, [
            { field: 'status', from: 'pending-approval', to: 'pending' }
        ]);
        addNotification({
            title: `Invoice ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
            description: decision === 'approved'
                ? `Invoice #${invoice.id} has been approved.`
                : `Invoice #${invoice.id} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
            href: '/invoices',
        });
        toast({ title: decision === 'approved' ? 'Invoice Approved' : 'Invoice Rejected' });
    };

    const handleApproveInvoice = () => {
        if (!invoiceToApprove) return;
        finalizeInvoiceDecision(invoiceToApprove, 'approved');
        setInvoiceToApprove(null);
    };

    const handleRejectInvoice = () => {
        if (!invoiceToReject) return;
        finalizeInvoiceDecision(invoiceToReject, 'rejected', invoiceRejectionReason);
        setInvoiceToReject(null);
        setInvoiceRejectionReason('');
    };

    // The in-progress ApprovalWorkflow for the invoice currently being approved/rejected via
    // the dialogs below, if a multi-step chain was configured at creation time.
    const invoiceActiveWorkflow = (invoiceToApprove ?? invoiceToReject)
        ? approvalWorkflows.find(w => w.entityType === 'invoice' && w.entityId === (invoiceToApprove ?? invoiceToReject)!.id && w.finalStatus === 'in-progress')
        : undefined;

    const handleDelete = () => {
        if (!invoiceToDelete) return;
        addActivityLog('Invoice Deleted', `Deleted invoice #${invoiceToDelete.id}.`);
        setInvoices(allInvoices.filter(inv => inv.id !== invoiceToDelete.id));
        toast({ title: "Invoice Deleted" });
        setInvoiceToDelete(null);
    };

    // Recurring invoice handlers
    const handleOpenRecurringForm = (rec: RecurringInvoice | null = null) => {
        setRecurringToEdit(rec);
        if (rec) {
            recurringForm.reset({
                customerId: rec.customerId || 'none',
                currency: rec.currency,
                frequency: rec.frequency,
                startDate: parseISO(rec.startDate),
                discount: rec.discount || 0,
                discountType: rec.discountType || 'percent',
                taxRate: rec.taxRate || 0,
                items: rec.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, cost: i.cost })),
            });
        } else {
            recurringForm.reset({ customerId: 'none', currency: undefined, frequency: 'monthly', startDate: new Date(), discount: 0, discountType: 'amount', taxRate: 0, items: [{ productId: '', quantity: 1, price: 0, cost: 0 }] });
        }
        setIsRecurringFormOpen(true);
    };

    const onRecurringSubmit = (data: RecurringFormData) => {
        const customer = customers.find(c => c.id === data.customerId);
        const items: InvoiceItem[] = data.items.map(i => {
            const product = products.find(p => p.id === i.productId);
            return { productId: i.productId, productName: product?.name ?? i.productId, quantity: i.quantity, price: i.price, cost: i.cost };
        });
        const subtotal = addMoney(...items.map(i => mulMoney(i.price, i.quantity)), 0);
        const disc = invoiceDiscountAmount(subtotal, data.discount ?? 0, data.discountType ?? 'amount');
        const tax = percentOf(subtotal - disc, data.taxRate ?? 0);
        const amount = addMoney(subtotal, -disc, tax);
        const startStr = format(data.startDate, 'yyyy-MM-dd');

        if (recurringToEdit) {
            const updated: RecurringInvoice = { ...recurringToEdit, customerId: data.customerId === 'none' ? undefined : data.customerId, customerName: data.customerId === 'none' ? undefined : customer?.name, items, amount, currency: data.currency, frequency: data.frequency, startDate: startStr, discount: data.discount, discountType: data.discountType, taxRate: data.taxRate };
            setRecurringInvoices(recurringInvoices.map(r => r.id === recurringToEdit.id ? updated : r));
            toast({ title: 'Recurring Invoice Updated' });
        } else {
            const newRec: RecurringInvoice = { id: `rec-${Date.now()}`, storeId: currentStore?.id, customerId: data.customerId === 'none' ? undefined : data.customerId, customerName: data.customerId === 'none' ? undefined : customer?.name, items, amount, currency: data.currency, frequency: data.frequency, startDate: startStr, nextDueDate: startStr, discount: data.discount, discountType: data.discountType, taxRate: data.taxRate, status: 'active', createdAt: new Date().toISOString() };
            setRecurringInvoices([newRec, ...recurringInvoices]);
            toast({ title: 'Recurring Invoice Created' });
            addActivityLog('Recurring Invoice Created', `Created recurring invoice for ${customer?.name ?? 'N/A'} (${data.frequency}).`);
        }
        setIsRecurringFormOpen(false);
        setRecurringToEdit(null);
    };

    const handleGenerateNow = async (rec: RecurringInvoice) => {
        const invoicePrefix = themeSettings.invoicePrefix || 'INV-';
        const maxNum = () => allInvoices.reduce((max, inv) => { const num = parseInt(inv.id.replace(invoicePrefix, ''), 10); return isNaN(num) ? max : Math.max(max, num); }, 0) + 1;
        const invoiceId = tenantId ? await getNextDocumentNumber(tenantId, 'invoice', invoicePrefix, maxNum) : `${invoicePrefix}${String(maxNum()).padStart(3, '0')}`;
        const newInvoice: Invoice = {
            id: invoiceId,
            storeId: rec.storeId,
            customerId: rec.customerId,
            customerName: rec.customerName,
            items: rec.items,
            amount: rec.amount,
            currency: rec.currency,
            discount: rec.discount,
            discountType: rec.discountType,
            taxRate: rec.taxRate,
            status: 'pending',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        };
        setInvoices([newInvoice, ...allInvoices]);
        const nextDueDate = advanceByFrequency(rec.nextDueDate, rec.frequency);
        setRecurringInvoices(recurringInvoices.map(r => r.id === rec.id ? { ...r, nextDueDate } : r));
        addActivityLog('Recurring Invoice Generated', `Generated invoice #${newInvoice.id} from recurring template.`);
        toast({ title: 'Invoice Generated', description: `Invoice #${newInvoice.id} created. Next due: ${nextDueDate}.` });
    };

    const handleTogglePause = (rec: RecurringInvoice) => {
        const newStatus = rec.status === 'active' ? 'paused' : 'active';
        setRecurringInvoices(recurringInvoices.map(r => r.id === rec.id ? { ...r, status: newStatus } : r));
        toast({ title: newStatus === 'active' ? 'Recurring Invoice Resumed' : 'Recurring Invoice Paused' });
    };

    const handleDeleteRecurring = (rec: RecurringInvoice) => {
        setRecurringInvoices(recurringInvoices.filter(r => r.id !== rec.id));
        toast({ title: 'Recurring Invoice Deleted' });
    };

    const getInvoiceCurrencySymbol = (inv: Invoice) =>
        inv.currency ? (currencySymbols[inv.currency] ?? inv.currency) : currencySymbol;

    // POS-* is an internal, collision-safe outbox document key. Customers
    // should see the predicted business invoice number while it awaits sync.
    const getDisplayInvoiceId = (inv: Invoice) =>
        inv.postStatus !== 'posted' && inv.predictedId ? inv.predictedId : inv.id;

    const withDisplayInvoiceId = (inv: Invoice): Invoice =>
        getDisplayInvoiceId(inv) === inv.id ? inv : { ...inv, id: getDisplayInvoiceId(inv) };

    const InvoiceTable = ({ invoices, onEdit, onDelete, onView, onViewFull }: { invoices: Invoice[], onEdit: (invoice: Invoice) => void, onDelete: (invoice: Invoice) => void, onView: (invoice: Invoice) => void, onViewFull: (invoice: Invoice) => void }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[100px]"><Button variant="ghost" onClick={() => handleSort('id')}>Invoice ID <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                    {isInvoiceColVisible('customerName') && <TableHead><Button variant="ghost" onClick={() => handleSort('customerName')}>Customer <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                    {isInvoiceColVisible('amount') && <TableHead className="hidden md:table-cell"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                    {isInvoiceColVisible('status') && <TableHead className="hidden md:table-cell">Status</TableHead>}
                    {isInvoiceColVisible('date') && <TableHead className="hidden lg:table-cell"><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                    <TableHead className="text-right w-[140px]">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {invoices.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell></TableRow>
                )}
                {invoices.map(invoice => (
                    <TableRow key={invoice.id}>
                        <TableCell className="font-medium" onClick={() => onViewFull(invoice)}>
                            <span className="md:hidden font-bold">{getDisplayInvoiceId(invoice)}</span>
                            <span className="hidden md:inline">{getDisplayInvoiceId(invoice)}</span>
                        </TableCell>
                        {isInvoiceColVisible('customerName') && (
                        <TableCell onClick={() => onViewFull(invoice)}>
                            <div className="font-medium">{invoice.customerName || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground md:hidden">
                                <p>{getInvoiceCurrencySymbol(invoice)} {formatNumber(invoice.amount)} - {formatDateUK(invoice.date)}</p>
                                <StatusBadge status={invoice.status} className="mt-1" />
                            </div>
                        </TableCell>
                        )}
                        {isInvoiceColVisible('amount') && (
                        <TableCell className="hidden md:table-cell" onClick={() => onViewFull(invoice)}>
                            {getInvoiceCurrencySymbol(invoice)} {formatNumber(invoice.amount)}
                            {invoice.currency && invoice.currency !== currency && (
                                <Badge variant="outline" className="ml-1 text-xs">{invoice.currency}</Badge>
                            )}
                        </TableCell>
                        )}
                        {isInvoiceColVisible('status') && (
                        <TableCell className="hidden md:table-cell" onClick={() => onViewFull(invoice)}>
                            {invoice.status === 'pending-approval' && invoice.rejectionReason ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary" className="capitalize cursor-help">Pending Approval</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent><p className="max-w-xs">Rejected: {invoice.rejectionReason}</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <StatusBadge status={invoice.status} />
                            )}
                        </TableCell>
                        )}
                        {isInvoiceColVisible('date') && <TableCell className="hidden lg:table-cell" onClick={() => onViewFull(invoice)}>{formatDateUK(invoice.date)}</TableCell>}
                        <TableCell className="text-right">
                           <TooltipProvider>
                                <div className="flex items-center justify-end gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => onView(invoice)}>
                                                <ScrollText className="h-4 w-4" />
                                                <span className="sr-only">View Receipt</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>View Receipt</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => onViewFull(invoice)}>
                                                <FileText className="h-4 w-4" />
                                                <span className="sr-only">View Full Invoice</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>View Full Invoice</p></TooltipContent>
                                    </Tooltip>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>More Actions</DropdownMenuLabel>
                                            {canManage && invoice.status === 'pending-approval' && (
                                                <>
                                                    <DropdownMenuItem onClick={() => setInvoiceToApprove(invoice)}>
                                                        <CheckCircle className="mr-2 h-4 w-4" /> Approve Invoice
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { setInvoiceToReject(invoice); setInvoiceRejectionReason(''); }}>
                                                        <X className="mr-2 h-4 w-4" /> Reject Invoice
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                            )}
                                            {canManage && (
                                                <>
                                                    <DropdownMenuItem onClick={() => onEdit(invoice)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(invoice)}>Delete</DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TooltipProvider>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    return (
        <div className="flex flex-col h-full">
            <Header title="Invoices">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => router.push('/pos')}>
                    <CreditCard className="h-4 w-4" /> Point of Sale
                </Button>
            </Header>
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-end md:items-center gap-4">
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <Input
                                    placeholder="Search by Invoice ID or Customer Name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                                />
                                {activeTab === 'recurring' ? (
                                    <ColumnVisibilityMenu visibility={recurringColumnVisibility} />
                                ) : (
                                    <ColumnVisibilityMenu visibility={invoicesColumnVisibility} />
                                )}
                                <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                                    <PlusCircle className="h-4 w-4" /> Create Invoice
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="all" onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 h-auto">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="paid">Paid</TabsTrigger>
                                <TabsTrigger value="pending">Pending</TabsTrigger>
                                <TabsTrigger value="overdue">Overdue</TabsTrigger>
                                <TabsTrigger value="refunded">Refunded</TabsTrigger>
                                <TabsTrigger value="pending-approval" className="relative">
                                    Approval
                                    {pendingApprovalCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">{pendingApprovalCount}</span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="recurring">Recurring</TabsTrigger>
                            </TabsList>
                            {!isDataLoaded && (
                                <div className="mt-2"><Table><TableSkeleton rows={6} cols={6} /></Table></div>
                            )}
                            <TabsContent value="all"><InvoiceTable invoices={filteredAndSearchedInvoices} onView={setViewingInvoice} onEdit={handleOpenForm} onDelete={setInvoiceToDelete} onViewFull={setViewingFullInvoice} /></TabsContent>
                            <TabsContent value="paid"><InvoiceTable invoices={filteredAndSearchedInvoices} onView={setViewingInvoice} onEdit={handleOpenForm} onDelete={setInvoiceToDelete} onViewFull={setViewingFullInvoice} /></TabsContent>
                            <TabsContent value="pending"><InvoiceTable invoices={filteredAndSearchedInvoices} onView={setViewingInvoice} onEdit={handleOpenForm} onDelete={setInvoiceToDelete} onViewFull={setViewingFullInvoice} /></TabsContent>
                            <TabsContent value="overdue"><InvoiceTable invoices={filteredAndSearchedInvoices} onView={setViewingInvoice} onEdit={handleOpenForm} onDelete={setInvoiceToDelete} onViewFull={setViewingFullInvoice} /></TabsContent>
                            <TabsContent value="refunded"><InvoiceTable invoices={filteredAndSearchedInvoices} onView={setViewingInvoice} onEdit={handleOpenForm} onDelete={setInvoiceToDelete} onViewFull={setViewingFullInvoice} /></TabsContent>
                            <TabsContent value="pending-approval"><InvoiceTable invoices={filteredAndSearchedInvoices} onView={setViewingInvoice} onEdit={handleOpenForm} onDelete={setInvoiceToDelete} onViewFull={setViewingFullInvoice} /></TabsContent>
                            <TabsContent value="recurring">
                                <div className="flex justify-end mt-4 mb-2">
                                    <Button size="sm" className="gap-1" onClick={() => handleOpenRecurringForm()}>
                                        <PlusCircle className="h-4 w-4" /> New Recurring Template
                                    </Button>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            {isRecurringColVisible('customerName') && <TableHead>Customer</TableHead>}
                                            {isRecurringColVisible('amount') && <TableHead>Amount</TableHead>}
                                            {isRecurringColVisible('frequency') && <TableHead>Frequency</TableHead>}
                                            {isRecurringColVisible('nextDueDate') && <TableHead>Next Due</TableHead>}
                                            {isRecurringColVisible('status') && <TableHead>Status</TableHead>}
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recurringInvoices.length === 0 && (
                                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No recurring invoices set up.</TableCell></TableRow>
                                        )}
                                        {recurringInvoices.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell className="font-medium text-xs">{rec.id}</TableCell>
                                                {isRecurringColVisible('customerName') && <TableCell>{rec.customerName ?? 'N/A'}</TableCell>}
                                                {isRecurringColVisible('amount') && <TableCell>{rec.currency ? (currencySymbols[rec.currency] ?? rec.currency) : currencySymbol} {formatNumber(rec.amount)}</TableCell>}
                                                {isRecurringColVisible('frequency') && <TableCell className="capitalize">{rec.frequency}</TableCell>}
                                                {isRecurringColVisible('nextDueDate') && <TableCell>{rec.nextDueDate}</TableCell>}
                                                {isRecurringColVisible('status') && (
                                                <TableCell>
                                                    <Badge variant={rec.status === 'active' ? 'default' : 'secondary'} className="capitalize">{rec.status}</Badge>
                                                </TableCell>
                                                )}
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleGenerateNow(rec)} disabled={rec.status === 'paused'}>
                                                                        <RefreshCw className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Generate Now</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleTogglePause(rec)}>
                                                                        {rec.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{rec.status === 'active' ? 'Pause' : 'Resume'}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleOpenRecurringForm(rec)}>Edit</DropdownMenuItem>
                                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteRecurring(rec)}>Delete</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>

            {/* Invoice Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) { setInvoiceToEdit(null); setAttachments([]); } }}>
                <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                        <DialogTitle className="text-xl">{invoiceToEdit ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
                        <DialogDescription>{invoiceToEdit ? 'Update details.' : 'Fill out the form to create a new invoice.'}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6">
                            {/* Header fields: compact 4-up row on desktop */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <FormField control={form.control} name="customerId" render={({ field }) => (
                                    <FormItem className="col-span-2 flex flex-col"><FormLabel className="text-xs text-muted-foreground">Customer</FormLabel>
                                        <FormControl>
                                            <Combobox
                                                options={customerOptions}
                                                value={field.value}
                                                onValueChange={(v) => field.onChange(v || 'walk-in')}
                                                placeholder="Walk-in Customer"
                                                searchPlaceholder="Search name, phone or email…"
                                                emptyText="No customer found."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel className="text-xs text-muted-foreground">Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel className="text-xs text-muted-foreground">Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="paid">Paid</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="overdue">Overdue</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel className="text-xs text-muted-foreground">Payment</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? paymentMethodOptions[0] ?? 'Cash'}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {paymentMethodOptions.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="currency" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel className="text-xs text-muted-foreground">Currency</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={`Default (${currency})`} /></SelectTrigger></FormControl>
                                            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c} — {currencySymbols[c]}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="discount" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-muted-foreground">Discount ({watchedDiscountType === 'percent' ? '%' : currencySymbol})</FormLabel>
                                        <FormControl><Input type="number" step="0.01" placeholder="0" {...field} readOnly={!!activeTier} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="taxRate" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel className="text-xs text-muted-foreground">Tax (%)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="salesperson" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel className="text-xs text-muted-foreground">Salesperson</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            {(!watchedCustomerId || watchedCustomerId === 'walk-in') && (
                                <div className="space-y-3 rounded-lg border border-dashed p-3 bg-muted/20">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <FormField control={form.control} name="walkInName" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs text-muted-foreground">Walk-in name (optional)</FormLabel><FormControl><Input placeholder="Customer name" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="walkInPhone" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs text-muted-foreground">Phone (optional)</FormLabel><FormControl><Input placeholder="Phone number" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="walkInEmail" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs text-muted-foreground">Email (optional)</FormLabel><FormControl><Input type="email" placeholder="Email address" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <FormField control={form.control} name="saveWalkInToCustomers" render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 space-y-0">
                                            <FormControl>
                                                <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={!watchedWalkInName?.trim()} />
                                            </FormControl>
                                            <FormLabel className="text-sm font-normal cursor-pointer">Save this customer to the customer list</FormLabel>
                                        </FormItem>
                                    )} />
                                </div>
                            )}
                            {activeTier && (
                                <p className="-mt-3 flex items-center gap-1 text-xs text-primary">
                                    <Info className="h-3 w-3" /> {`A ${form.getValues('discount')}% ${activeTier} tier discount is applied (${currencySymbol}${formatNumber(discountAmount)}).`}
                                </p>
                            )}

                            <CustomFieldsFormSection entity="invoice" value={customData} onChange={setCustomData} />

                            {/* Line items */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">Items</FormLabel>
                                    <div className="flex gap-1.5">
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsScannerOpen(true)}>
                                            <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Scan
                                        </Button>
                                    </div>
                                </div>
                                <div className="rounded-lg border divide-y">
                                    {fields.map((field, index) => {
                                        const rowProductId = watchedItems?.[index]?.productId;
                                        const rowProduct = rowProductId ? products.find(p => p.id === rowProductId) : undefined;
                                        return (
                                        <div key={field.id} className="p-2 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <FormField control={form.control} name={`items.${index}.productId`} render={({ field }) => (
                                                    <FormItem className="flex-1 min-w-0">
                                                        <FormControl>
                                                            <Combobox
                                                                options={productOptions}
                                                                value={field.value}
                                                                onValueChange={(value) => {
                                                                    field.onChange(value);
                                                                    // Auto-advance: picking a product in the last row opens the
                                                                    // next empty row so a multi-item invoice doesn't need a
                                                                    // manual "Add product" click between every line.
                                                                    if (value && index === fields.length - 1) {
                                                                        append({ productId: '', quantity: 1 });
                                                                    }
                                                                }}
                                                                placeholder="Select a product..."
                                                                searchPlaceholder="Search products..."
                                                                emptyText="No products found."
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                                    <FormItem className="w-20 shrink-0"><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-9 w-9 shrink-0",
                                                        (expandedItemNotes.has(field.id) || watchedItems?.[index]?.notes) ? "text-primary" : "text-muted-foreground"
                                                    )}
                                                    title="Add details"
                                                    onClick={() => toggleItemNotes(field.id)}
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                            {rowProduct && (
                                                <div className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
                                                    <span>{currencySymbol} {formatNumber(rowProduct.price)}{rowProduct.unitOfMeasure ? `/${rowProduct.unitOfMeasure}` : ''}</span>
                                                    {(rowProduct.discount ?? 0) > 0 && (
                                                        <span className="font-medium text-primary">
                                                            −{rowProduct.discountType === 'amount' ? `${currencySymbol}${formatNumber(rowProduct.discount!)}` : `${rowProduct.discount}%`} discount
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {(expandedItemNotes.has(field.id) || watchedItems?.[index]?.notes) && (
                                                <FormField control={form.control} name={`items.${index}.notes`} render={({ field }) => (
                                                    <FormItem><FormControl><Input placeholder="Add details for this item…" className="h-8 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
                                                )} />
                                            )}
                                        </div>
                                        );
                                    })}
                                    {customLineFields.map((field, index) => (
                                        <div key={field.id} className="flex items-center gap-2 p-2 bg-muted/30">
                                            <FormField control={form.control} name={`customLines.${index}.description`} render={({ field }) => (
                                                <FormItem className="flex-1 min-w-0"><FormControl><Input placeholder="e.g. Delivery fee, rush charge…" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name={`customLines.${index}.quantity`} render={({ field }) => (
                                                <FormItem className="w-16 shrink-0"><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name={`customLines.${index}.price`} render={({ field }) => (
                                                <FormItem className="w-24 shrink-0"><FormControl><Input type="number" step="0.01" placeholder="Amount" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCustomLine(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2 p-2">
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => append({ productId: '', quantity: 1 })}>
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add product
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => appendCustomLine({ description: '', quantity: 1, price: 0 })}>
                                            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add custom line / fee
                                        </Button>
                                    </div>
                                </div>
                                <FormMessage>{form.formState.errors.items?.message}</FormMessage>
                            </div>

                            {/* Attachments */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Paperclip className="h-3.5 w-3.5" /> Attachments</Label>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>
                                        <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Add file
                                    </Button>
                                </div>
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                                {attachments.length > 0 && (
                                    <div className="space-y-1">
                                        {attachments.map(att => (
                                            <div key={att.id} className="flex items-center gap-2 text-sm p-1.5 rounded-md border bg-muted/30">
                                                <span className="flex-1 truncate">{att.fileName}</span>
                                                <span className="text-xs text-muted-foreground shrink-0">{formatNumber(att.fileSize / 1024, 1, 1)} KB</span>
                                                <a href={att.dataUrl} download={att.fileName} className="text-primary underline text-xs shrink-0">Download</a>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">Max 500 KB per file, 800 KB total recommended.</p>
                            </div>

                            {/* Totals */}
                            <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{currencySymbol} {formatNumber(grossSubtotal)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Discount{watchedDiscount > 0 ? ` (incl. ${watchedDiscountType === 'amount' ? `${currencySymbol}${watchedDiscount}` : `${watchedDiscount}%`})` : ''}</span><span className="tabular-nums text-destructive">-{currencySymbol} {formatNumber(itemDiscounts + discountAmount)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tax ({watchedTaxRate}%)</span><span className="tabular-nums">+{currencySymbol} {formatNumber(taxAmount)}</span></div>
                                <div className="flex justify-between pt-1.5 mt-1.5 border-t font-semibold text-base"><span>Total</span><span className="tabular-nums">{currencySymbol} {formatNumber(totalAmount)}</span></div>
                                {!invoiceToEdit && (themeSettings.invoiceApprovalThreshold ?? 0) > 0 && totalAmount > (themeSettings.invoiceApprovalThreshold ?? 0) && (
                                    <p className="pt-1 flex items-center gap-1 text-xs text-amber-600"><Info className="h-3 w-3" /> Exceeds approval threshold ({currencySymbol} {themeSettings.invoiceApprovalThreshold !== undefined ? formatNumber(themeSettings.invoiceApprovalThreshold) : ''}). Will be sent for manager approval.</p>
                                )}
                            </div>

                            <DialogFooter className="!mt-4 -mx-6 -mb-5 px-6 py-4 border-t bg-background sticky bottom-0">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" disabled={isSubmitting}>{invoiceToEdit ? 'Save Changes' : 'Create Invoice'}</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                disabled={isSubmitting}
                                                onClick={(e) => { e.preventDefault(); form.handleSubmit(onSubmit)(); }}
                                            >
                                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Confirm'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Low/out-of-stock items detected on submit: let the user drop those
                lines from the invoice, or override and let stock go negative. */}
            <Dialog open={stockIssues.length > 0} onOpenChange={(open) => { if (!open) { setStockIssues([]); setPendingSubmitData(null); } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Stock issue detected</DialogTitle>
                        <DialogDescription>
                            The following item{stockIssues.length > 1 ? 's are' : ' is'} low or out of stock. Remove {stockIssues.length > 1 ? 'them' : 'it'} from the invoice, or override to continue (inventory will go negative).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                        {stockIssues.map(issue => (
                            <div key={issue.productId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{issue.name}</div>
                                    <div className="text-xs text-destructive">Have {issue.available}, need {issue.needed}</div>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => removeStockIssueItem(issue.productId)}>Remove</Button>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { setStockIssues([]); setPendingSubmitData(null); }}>Cancel</Button>
                        <Button type="button" variant="destructive" disabled={isSubmitting} onClick={submitWithStockOverride}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Override &amp; Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recurring Invoice Form Dialog */}
            <Dialog open={isRecurringFormOpen} onOpenChange={(open) => { setIsRecurringFormOpen(open); if (!open) setRecurringToEdit(null); }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{recurringToEdit ? 'Edit Recurring Invoice' : 'New Recurring Invoice Template'}</DialogTitle>
                        <DialogDescription>Set up an invoice template that can be generated on a recurring schedule.</DialogDescription>
                    </DialogHeader>
                    <Form {...recurringForm}>
                        <form onSubmit={recurringForm.handleSubmit(onRecurringSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={recurringForm.control} name="customerId" render={({ field }) => (
                                    <FormItem><FormLabel>Customer</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? 'none'}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                                            <SelectContent><SelectItem value="none">None</SelectItem>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={recurringForm.control} name="currency" render={({ field }) => (
                                    <FormItem><FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={`Default (${currency})`} /></SelectTrigger></FormControl>
                                            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c} — {currencySymbols[c]}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={recurringForm.control} name="frequency" render={({ field }) => (
                                    <FormItem><FormLabel>Frequency</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                                <SelectItem value="yearly">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={recurringForm.control} name="startDate" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <div className="space-y-2">
                                <FormLabel>Items</FormLabel>
                                <div className="space-y-2 rounded-lg border p-2">
                                    {recurringFields.map((field, index) => (
                                        <div key={field.id} className="flex flex-wrap items-end gap-2">
                                            <FormField control={recurringForm.control} name={`items.${index}.productId`} render={({ field }) => (
                                                <FormItem className="flex-1 min-w-[160px]">
                                                    <FormControl>
                                                        <Combobox options={productOptions} value={field.value} onValueChange={(val) => {
                                                            field.onChange(val);
                                                            const p = products.find(p => p.id === val);
                                                            if (p) { recurringForm.setValue(`items.${index}.price`, p.price); recurringForm.setValue(`items.${index}.cost`, p.cost); }
                                                        }} placeholder="Select product..." searchPlaceholder="Search..." emptyText="No products." />
                                                    </FormControl><FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={recurringForm.control} name={`items.${index}.quantity`} render={({ field }) => (
                                                <FormItem className="w-20"><FormLabel className="sr-only">Qty</FormLabel><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={recurringForm.control} name={`items.${index}.price`} render={({ field }) => (
                                                <FormItem className="w-24"><FormLabel className="sr-only">Price</FormLabel><FormControl><Input type="number" placeholder="Price" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <Button type="button" variant="destructive" size="icon" onClick={() => removeItem(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => appendItem({ productId: '', quantity: 1, price: 0, cost: 0 })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={recurringForm.control} name="discount" render={({ field }) => (
                                    <FormItem><FormLabel>Discount ({currencySymbol})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={recurringForm.control} name="taxRate" render={({ field }) => (
                                    <FormItem><FormLabel>Tax Rate (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <DialogFooter>
                                <Button type="submit">{recurringToEdit ? 'Save Changes' : 'Create Template'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Approve Invoice — shows the multi-step workflow panel when a chain is configured
                for this invoice, otherwise falls back to the original instant-approve dialog. */}
            {invoiceToApprove && invoiceActiveWorkflow ? (
                <Dialog open={!!invoiceToApprove} onOpenChange={(open) => !open && setInvoiceToApprove(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Approve Invoice</DialogTitle>
                            <DialogDescription>Invoice #{invoiceToApprove.id} requires the approvals below before it can be processed normally.</DialogDescription>
                        </DialogHeader>
                        <ApprovalWorkflowPanel
                            entityType="invoice"
                            entityId={invoiceToApprove.id}
                            entityTitle={`Invoice ${invoiceToApprove.id}`}
                            workflow={invoiceActiveWorkflow}
                            onWorkflowChange={(updated) => {
                                setApprovalWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
                                if (updated.finalStatus === 'approved' || updated.finalStatus === 'rejected') {
                                    finalizeInvoiceDecision(invoiceToApprove, updated.finalStatus);
                                    setInvoiceToApprove(null);
                                }
                            }}
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInvoiceToApprove(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ) : (
                <AlertDialog open={!!invoiceToApprove} onOpenChange={(open) => !open && setInvoiceToApprove(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Approve Invoice?</AlertDialogTitle>
                            <AlertDialogDescription>Approving invoice #{invoiceToApprove?.id} will set its status to Pending so it can be processed normally.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleApproveInvoice}>Approve</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {/* Reject Invoice — same workflow-panel-or-fallback split as Approve above. */}
            {invoiceToReject && invoiceActiveWorkflow ? (
                <Dialog open={!!invoiceToReject} onOpenChange={(open) => !open && setInvoiceToReject(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Invoice</DialogTitle>
                            <DialogDescription>Invoice #{invoiceToReject.id} requires the approvals below.</DialogDescription>
                        </DialogHeader>
                        <ApprovalWorkflowPanel
                            entityType="invoice"
                            entityId={invoiceToReject.id}
                            entityTitle={`Invoice ${invoiceToReject.id}`}
                            workflow={invoiceActiveWorkflow}
                            onWorkflowChange={(updated) => {
                                setApprovalWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
                                if (updated.finalStatus === 'approved' || updated.finalStatus === 'rejected') {
                                    finalizeInvoiceDecision(invoiceToReject, updated.finalStatus);
                                    setInvoiceToReject(null);
                                }
                            }}
                        />
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInvoiceToReject(null)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ) : (
                <Dialog open={!!invoiceToReject} onOpenChange={(open) => { if (!open) { setInvoiceToReject(null); setInvoiceRejectionReason(''); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Invoice</DialogTitle>
                            <DialogDescription>Rejecting invoice #{invoiceToReject?.id}. It will be returned to Pending status with a rejection note.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-2">
                            <Label htmlFor="invoice-rejection-reason">Reason (optional)</Label>
                            <Textarea id="invoice-rejection-reason" placeholder="Provide a reason..." value={invoiceRejectionReason} onChange={(e) => setInvoiceRejectionReason(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setInvoiceToReject(null); setInvoiceRejectionReason(''); }}>Cancel</Button>
                            <Button variant="destructive" onClick={handleRejectInvoice}>Confirm Rejection</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Scan Barcode</DialogTitle>
                        <DialogDescription>Point your camera at a product barcode.</DialogDescription>
                    </DialogHeader>
                    <BarcodeScanner onScan={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
                {viewingInvoice && <InvoiceDetail invoice={withDisplayInvoiceId(viewingInvoice)} />}
            </Dialog>

            <Dialog open={!!viewingFullInvoice} onOpenChange={(open) => !open && setViewingFullInvoice(null)}>
                {viewingFullInvoice && <FullInvoice invoice={withDisplayInvoiceId(viewingFullInvoice)} />}
            </Dialog>

            <Dialog open={!!justCreatedInvoice} onOpenChange={(open) => !open && setJustCreatedInvoice(null)}>
                {justCreatedInvoice && <InvoiceReceiptView invoice={justCreatedInvoice} />}
            </Dialog>

            <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete invoice {invoiceToDelete?.id}.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
