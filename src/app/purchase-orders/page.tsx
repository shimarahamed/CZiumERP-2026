
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from 'date-fns';
import { addDays } from 'date-fns/addDays';
import { MoreHorizontal, PlusCircle, Trash2, FileText, CheckCircle, ArrowUpDown, Paperclip, X } from "@/components/icons";
import { useSearchParams, useRouter } from 'next/navigation';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatNumber } from '@/lib/money';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { useAppContext } from "@/context/AppContext";
import type { PurchaseOrder, PurchaseOrderItem, Attachment, Currency, VendorBill } from "@/types";
import FullPurchaseOrder from "@/components/FullPurchaseOrder";
import { CSVExportButton } from "@/components/CSVExportButton";
import { LandedCostCalculator } from "@/components/LandedCostCalculator";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { TableSkeleton } from '@/components/TableSkeleton';
import { db } from "@/lib/firebase";
import { collection, query, orderBy, type Query } from 'firebase/firestore';
import { sendDepartmentEmail } from '@/lib/email';
import { useRequirePermission } from '@/hooks/use-require-role';
import { buildApprovalWorkflow } from '@/lib/approvals';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';
import { adjustStock, getDefaultWarehouse, receiveLot, receiveSerials } from '@/lib/warehouse';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const PURCHASE_ORDERS_COLUMNS: ColumnDef[] = [
    { id: 'id', label: 'PO ID', locked: true },
    { id: 'vendorName', label: 'Vendor' },
    { id: 'totalCost', label: 'Total Cost' },
    { id: 'status', label: 'Status' },
    { id: 'orderDate', label: 'Order Date' },
];

const CURRENCIES: Currency[] = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'];
const MAX_FILE_SIZE = 512000; // 500 KB
const WARN_TOTAL_SIZE = 819200; // 800 KB

const poItemSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  cost: z.coerce.number().min(0, "Cost must be non-negative."),
});

const poSchema = z.object({
  vendorId: z.string().min(1, "Please select a vendor."),
  status: z.enum(['pending', 'pending-approval', 'ordered', 'received', 'cancelled']),
  currency: z.enum(['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR']).optional(),
  orderDate: z.date(),
  expectedDeliveryDate: z.date().optional(),
  items: z.array(poItemSchema).min(1, "PO must have at least one item."),
  paymentTerms: z.string().optional(),
  discount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).optional(),
  warehouse: z.string().optional(),
  notes: z.string().optional(),
});

type POFormData = z.infer<typeof poSchema>;
type SortKey = 'id' | 'vendorName' | 'totalCost' | 'orderDate';

const statusVariant: { [key in PurchaseOrder['status']]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    pending: 'secondary',
    'pending-approval': 'secondary',
    ordered: 'default',
    received: 'outline',
    cancelled: 'destructive'
};

export default function PurchaseOrdersPage() {
    const {
        purchaseOrders, setPurchaseOrders,
        vendors, products, setProducts,
        vendorBills, setVendorBills,
        addActivityLog, addNotification, currentStore, currencySymbol, currencySymbols, currency, user, users, employees,
        themeSettings, tenantId, companyName,
        smtpConfigList, emailTemplates, setEmailLogs,
        approvalWorkflows, setApprovalWorkflows,
        warehouses, stockLevels, setStockLevels,
        lots, setLots, serialUnits, setSerialUnits,
    } = useAppContext();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [poToEdit, setPoToEdit] = useState<PurchaseOrder | null>(null);
    const [poToMarkReceived, setPoToMarkReceived] = useState<PurchaseOrder | null>(null);
    const [receivingWarehouseId, setReceivingWarehouseId] = useState<string>('');
    // Per-item receiving detail for lot/serial-tracked products, keyed by productId.
    // Untracked products (the vast majority) never touch this state.
    const [receivingLotInfo, setReceivingLotInfo] = useState<Record<string, { lotNumber: string; expiryDate: string }>>({});
    const [receivingSerials, setReceivingSerialsState] = useState<Record<string, string>>({});
    const [poToApprove, setPoToApprove] = useState<PurchaseOrder | null>(null);
    // The in-progress ApprovalWorkflow for poToApprove, if one was created for it at PO
    // creation time (i.e. a multi-step chain was configured). Undefined means no chain
    // was configured for this PO — the dialog falls back to the original single-click UI.
    const poActiveWorkflow = poToApprove
        ? approvalWorkflows.find(w => w.entityType === 'purchase-order' && w.entityId === poToApprove.id && w.finalStatus === 'in-progress')
        : undefined;
    const [approvalMode, setApprovalMode] = useState<'approve' | 'reject'>('approve');
    const [rejectionReason, setRejectionReason] = useState('');
    const [poToView, setPoToView] = useState<PurchaseOrder | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('orderDate');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const columnVisibility = useColumnVisibility('purchase-orders', PURCHASE_ORDERS_COLUMNS);
    const { isVisible } = columnVisibility;

    const form = useForm<POFormData>({
        resolver: zodResolver(poSchema),
        defaultValues: {
            vendorId: '',
            status: 'pending',
            currency: undefined,
            orderDate: new Date(),
            items: [],
            paymentTerms: '',
            discount: undefined,
            taxRate: undefined,
            warehouse: '',
            notes: '',
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    const watchedVendorId = useWatch({ control: form.control, name: 'vendorId' });
    const watchedOrderDate = useWatch({ control: form.control, name: 'orderDate' });
    const watchedItems = useWatch({ control: form.control, name: 'items' });
    const totalCost = watchedItems.reduce((acc, item) => acc + (item.cost * item.quantity), 0);

    // Effective permissions — honors a tenant admin's custom role overrides (Settings → Roles),
    // falling back to the same admin/manager/inventory-staff defaults as before for any user
    // without a custom role assigned.
    const canManage = useRequirePermission('Supply Chain', 'approve');
    // Edit/Receive is a lower bar than Approve/Reject — cashiers have 'edit' but not
    // 'approve' on Supply Chain, so they can edit their own POs and receive stock, but
    // approval authority stays with admin/manager.
    const canEdit = useRequirePermission('Supply Chain', 'edit');
    const canCreatePo = useRequirePermission('Supply Chain', 'create');

    const poQuery = useMemo(() => {
        if (!tenantId) return null;
        return query(collection(db, 'tenants', tenantId, 'purchaseOrders'), orderBy(sortKey, sortDirection)) as Query<PurchaseOrder>;
    }, [sortKey, sortDirection, tenantId]);

    const { data: serverPOs, isLoading: isPOsLoading } = useFirestoreQuery<PurchaseOrder>(poQuery);

    const filteredPurchaseOrders = useMemo(() => {
        if (!searchTerm) return serverPOs;
        const lowercasedFilter = searchTerm.toLowerCase();
        return serverPOs.filter(po =>
            po.id.toLowerCase().includes(lowercasedFilter) ||
            po.vendorName.toLowerCase().includes(lowercasedFilter)
        );
    }, [serverPOs, searchTerm]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const availableProductsForPO = useMemo(() => {
        if (!watchedVendorId) return products;
        return products.filter(p => !p.vendorId || p.vendorId === watchedVendorId);
    }, [watchedVendorId, products]);

    const handleOpenForm = useCallback((po: PurchaseOrder | null = null) => {
        setPoToEdit(po);
        setAttachments(po?.attachments ?? []);
        setIsFormOpen(true);
    }, []);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action !== 'new') return;
        const productId = searchParams.get('productId');
        const vendorId = searchParams.get('vendorId');
        handleOpenForm(null);
        if (productId && vendorId) {
            const product = products.find(p => p.id === productId);
            if (product) {
                const defaultQty = product.reorderThreshold && product.reorderThreshold > 0 ? product.reorderThreshold : 10;
                setTimeout(() => {
                    form.reset({
                        vendorId: vendorId,
                        status: canManage ? 'ordered' : 'pending-approval',
                        currency: undefined,
                        orderDate: new Date(),
                        expectedDeliveryDate: undefined,
                        items: [{ productId: product.id, quantity: defaultQty, cost: product.cost }],
                    });
                }, 100);
            }
        }
        router.replace('/purchase-orders', { scroll: false });
    }, [searchParams, handleOpenForm, router, products, form, canManage]);

    useEffect(() => {
        if (isFormOpen && poToEdit) {
            form.reset({
                vendorId: poToEdit.vendorId,
                status: poToEdit.status,
                currency: poToEdit.currency,
                orderDate: new Date(poToEdit.orderDate),
                expectedDeliveryDate: poToEdit.expectedDeliveryDate ? new Date(poToEdit.expectedDeliveryDate) : undefined,
                items: poToEdit.items.map(item => ({ productId: item.productId, quantity: item.quantity, cost: item.cost })),
                paymentTerms: poToEdit.paymentTerms ?? '',
                discount: poToEdit.discount,
                taxRate: poToEdit.taxRate,
                warehouse: poToEdit.warehouse ?? '',
                notes: poToEdit.notes ?? '',
            });
        } else if (isFormOpen && !poToEdit) {
            form.reset({
                vendorId: '',
                status: 'pending',
                currency: undefined,
                orderDate: new Date(),
                expectedDeliveryDate: undefined,
                items: [],
                paymentTerms: '',
                discount: undefined,
                taxRate: undefined,
                warehouse: '',
                notes: '',
            });
        }
    }, [poToEdit, isFormOpen, form]);

    useEffect(() => {
        if (watchedVendorId && watchedOrderDate && !poToEdit) {
            const vendor = vendors.find(v => v.id === watchedVendorId);
            if (vendor?.leadTimeDays) {
                form.setValue('expectedDeliveryDate', addDays(new Date(watchedOrderDate), vendor.leadTimeDays));
            }
        }
    }, [watchedVendorId, watchedOrderDate, vendors, form, poToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            toast({ title: 'File too large', description: 'Maximum file size is 500 KB.', variant: 'destructive' });
            return;
        }
        const totalSize = attachments.reduce((s, a) => s + a.fileSize, 0) + file.size;
        if (totalSize > WARN_TOTAL_SIZE) {
            toast({ title: 'Attachment size warning', description: 'Total attachments exceed 800 KB. Consider removing older files.' });
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const newAttachment: Attachment = {
                id: `att-${Date.now()}`,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                uploadedBy: user?.email ?? 'unknown',
                uploadedAt: new Date().toISOString(),
                dataUrl: reader.result as string,
            };
            setAttachments(prev => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onSubmit = (data: POFormData) => {
        const vendor = vendors.find(v => v.id === data.vendorId)!;
        const newPOItems: PurchaseOrderItem[] = data.items.map(item => {
            const product = products.find(p => p.id === item.productId)!;
            return { productId: product.id, productName: product.name, quantity: item.quantity, cost: item.cost };
        });
        const newTotalCost = newPOItems.reduce((acc, item) => acc + (item.cost * item.quantity), 0);

        if (poToEdit) {
            const updatedPO: PurchaseOrder = {
                ...poToEdit,
                vendorId: data.vendorId,
                vendorName: vendor.name,
                status: data.status,
                currency: data.currency,
                orderDate: format(data.orderDate, 'yyyy-MM-dd'),
                expectedDeliveryDate: data.expectedDeliveryDate ? format(data.expectedDeliveryDate, 'yyyy-MM-dd') : undefined,
                items: newPOItems,
                totalCost: newTotalCost,
                attachments,
                paymentTerms: data.paymentTerms || undefined,
                discount: data.discount,
                taxRate: data.taxRate,
                warehouse: data.warehouse || undefined,
                notes: data.notes || undefined,
            };
            setPurchaseOrders(purchaseOrders.map(po => po.id === poToEdit.id ? updatedPO : po));
            toast({ title: "Purchase Order Updated" });
            addActivityLog('Purchase Order Updated', `Updated PO #${poToEdit.id}.`);
        } else {
            const poPrefix = themeSettings.purchaseOrderPrefix || 'PO-';
            const poId = `${poPrefix}${String(purchaseOrders.length + 1).padStart(3, '0')}`;

            // If a multi-step approval chain is configured for POs, it takes over from the
            // old single-approver canManage gate — build a workflow when the total exceeds
            // the configured threshold. Otherwise fall back to exactly today's behavior.
            const workflow = user
                ? buildApprovalWorkflow('purchase-order', poId, `PO ${poId} — ${vendor.name}`, newTotalCost, user, themeSettings.approvalRules, users, currentStore?.id, employees)
                : null;
            const needsApproval = workflow ? true : !canManage;

            const newPO: PurchaseOrder = {
                id: poId,
                storeId: currentStore?.id,
                vendorId: data.vendorId,
                vendorName: vendor.name,
                status: needsApproval ? 'pending-approval' : data.status,
                currency: data.currency,
                orderDate: format(data.orderDate, 'yyyy-MM-dd'),
                expectedDeliveryDate: data.expectedDeliveryDate ? format(data.expectedDeliveryDate, 'yyyy-MM-dd') : undefined,
                items: newPOItems,
                totalCost: newTotalCost,
                attachments,
                paymentTerms: data.paymentTerms || undefined,
                discount: data.discount,
                taxRate: data.taxRate,
                warehouse: data.warehouse || undefined,
                notes: data.notes || undefined,
            };
            setPurchaseOrders([newPO, ...purchaseOrders]);
            if (workflow) setApprovalWorkflows(prev => [workflow, ...prev]);
            toast({ title: "Purchase Order Created" });
            addActivityLog('Purchase Order Created', `Created PO #${newPO.id} for ${vendor.name}.`);
            if (vendor.email) {
                void sendDepartmentEmail(
                    { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                    'Supply Chain',
                    'po-sent-to-vendor',
                    vendor.email,
                    { poId: newPO.id, vendorName: vendor.name, contactPerson: vendor.contactPerson, amount: `${currencySymbol} ${formatNumber(newTotalCost)}`, companyName },
                    user?.name ?? 'system'
                );
            }
        }
        setIsFormOpen(false);
        setPoToEdit(null);
        setAttachments([]);
    };

    // Shared finalize step for both the legacy single-click approve/reject path and the
    // new multi-step ApprovalWorkflowPanel completion callback — keeps the side effects
    // (status flip, activity log, notification, vendor email) in exactly one place.
    const finalizePoDecision = (po: PurchaseOrder, decision: 'approved' | 'rejected', reason?: string) => {
        if (!user) return;
        const newStatus = decision === 'approved' ? 'ordered' : 'cancelled';
        setPurchaseOrders(currentPOs =>
            currentPOs.map(p =>
                p.id === po.id
                    ? { ...p, status: newStatus, rejectionReason: decision === 'rejected' ? reason : p.rejectionReason, decidedBy: user.email, decidedAt: new Date().toISOString() }
                    : p
            )
        );
        addActivityLog(`PO ${decision === 'approved' ? 'Approved' : 'Rejected'}`, `PO #${po.id} ${decision} by ${user.email}.`, [
            { field: 'status', from: 'pending-approval', to: newStatus }
        ]);
        addNotification({
            title: `PO ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
            description: decision === 'approved'
                ? `PO #${po.id} has been approved and is now ordered.`
                : `PO #${po.id} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
            href: '/purchase-orders',
        });
        toast(decision === 'approved'
            ? { title: "Purchase Order Approved", description: `PO #${po.id} is now ordered.` }
            : { title: "Purchase Order Rejected" });
        if (decision === 'approved') {
            const approvedVendor = vendors.find(v => v.id === po.vendorId);
            if (approvedVendor?.email) {
                void sendDepartmentEmail(
                    { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                    'Supply Chain',
                    'po-approved',
                    approvedVendor.email,
                    { poId: po.id, vendorName: approvedVendor.name, contactPerson: approvedVendor.contactPerson },
                    user.name
                );
            }
        }
    };

    const handleApprovePO = () => {
        if (!poToApprove) return;
        finalizePoDecision(poToApprove, 'approved');
        setPoToApprove(null);
        setRejectionReason('');
    };

    const handleRejectPO = () => {
        if (!poToApprove) return;
        finalizePoDecision(poToApprove, 'rejected', rejectionReason);
        setPoToApprove(null);
        setRejectionReason('');
        setApprovalMode('approve');
    };

    const handleMarkAsReceived = () => {
        if (!poToMarkReceived) return;
        const warehouseId = receivingWarehouseId || getDefaultWarehouse(warehouses)?.id;
        if (!warehouseId) {
            toast({ variant: 'destructive', title: 'No Warehouse Selected', description: 'Select a warehouse to receive this PO into.' });
            return;
        }
        // Validate lot/serial detail is filled in before touching any state.
        for (const item of poToMarkReceived.items) {
            const product = products.find(p => p.id === item.productId);
            if (product?.trackingMode === 'lot' && !receivingLotInfo[item.productId]?.lotNumber) {
                toast({ variant: 'destructive', title: 'Lot number required', description: `Enter a lot number for ${item.productName}.` });
                return;
            }
            if (product?.trackingMode === 'serial') {
                const serials = (receivingSerials[item.productId] ?? '').split(',').map(s => s.trim()).filter(Boolean);
                if (serials.length !== item.quantity) {
                    toast({ variant: 'destructive', title: 'Serial numbers required', description: `Enter exactly ${item.quantity} serial number(s) for ${item.productName}.` });
                    return;
                }
            }
        }
        // Product.stock is the denormalized total across warehouses — adjustStock (called
        // directly, or indirectly via receiveLot/receiveSerials) writes the real per-warehouse
        // StockLevel doc, then we mirror the same delta onto Product.stock so every existing
        // reader (low-stock badges, availableStock()) keeps working unmodified.
        const stockCtx = { stockLevels, setStockLevels };
        poToMarkReceived.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product?.trackingMode === 'lot') {
                const info = receivingLotInfo[item.productId];
                receiveLot({ ...stockCtx, lots, setLots }, item.productId, warehouseId, info.lotNumber, item.quantity, info.expiryDate || undefined);
            } else if (product?.trackingMode === 'serial') {
                const serials = (receivingSerials[item.productId] ?? '').split(',').map(s => s.trim()).filter(Boolean);
                receiveSerials({ ...stockCtx, serialUnits, setSerialUnits }, item.productId, warehouseId, serials);
            } else {
                adjustStock(stockCtx, item.productId, warehouseId, item.quantity);
            }
        });
        setProducts(currentProducts => {
            const newProducts = [...currentProducts];
            poToMarkReceived.items.forEach(item => {
                const productIndex = newProducts.findIndex(p => p.id === item.productId);
                if (productIndex !== -1) newProducts[productIndex].stock += item.quantity;
            });
            return newProducts;
        });
        setPurchaseOrders(currentPOs =>
            currentPOs.map(po =>
                po.id === poToMarkReceived.id
                    ? { ...po, status: 'received', receivedDate: format(new Date(), 'yyyy-MM-dd') }
                    : po
            )
        );
        const warehouseName = warehouses.find(w => w.id === warehouseId)?.name ?? warehouseId;
        addActivityLog('PO Received', `PO #${poToMarkReceived.id} marked as received into ${warehouseName}. Stock updated.`);

        // Auto-generate the vendor bill the moment the PO is received — same
        // "post transactionally on the trigger event" pattern as invoice posting,
        // instead of relying on someone remembering to re-enter it on Payables.
        // Guard against double-generation (e.g. a bill was already entered manually
        // for this PO before receiving finished).
        const alreadyHasBill = vendorBills.some(b => b.purchaseOrderId === poToMarkReceived.id);
        if (!alreadyHasBill) {
            const vendor = vendors.find(v => v.id === poToMarkReceived.vendorId);
            const billId = `bill-${Date.now()}`;
            const billDate = new Date();
            const termsDays = vendor?.paymentTermsDays ?? 30;
            const dueDate = new Date(billDate.getTime() + termsDays * 86400000);
            const workflow = user
                ? buildApprovalWorkflow('vendor-bill', billId, `Bill ${billId} — ${poToMarkReceived.vendorName}`, poToMarkReceived.totalCost, user, themeSettings.approvalRules, users, poToMarkReceived.storeId, employees)
                : null;
            const newBill: VendorBill = {
                id: billId,
                storeId: poToMarkReceived.storeId,
                purchaseOrderId: poToMarkReceived.id,
                vendorId: poToMarkReceived.vendorId,
                vendorName: poToMarkReceived.vendorName,
                items: poToMarkReceived.items,
                amount: poToMarkReceived.totalCost,
                status: 'unpaid',
                billDate: format(billDate, 'yyyy-MM-dd'),
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                requiresApproval: !!workflow,
                autoGenerated: true,
            };
            setVendorBills(prev => [newBill, ...prev]);
            if (workflow) setApprovalWorkflows(prev => [workflow, ...prev]);
            addActivityLog('Vendor Bill Auto-Generated', `Bill ${billId} created automatically from PO #${poToMarkReceived.id}.`);
            if (vendor?.email) {
                void sendDepartmentEmail(
                    { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                    'Finance',
                    'vendor-bill-received',
                    vendor.email,
                    { vendorName: vendor.name, amount: `${currencySymbol} ${formatNumber(poToMarkReceived.totalCost)}` },
                    user?.name ?? 'system'
                );
            }
        }

        toast({ title: "Purchase Order Received", description: `Product stock has been updated in ${warehouseName}.` });
        setPoToMarkReceived(null);
        setReceivingLotInfo({});
        setReceivingSerialsState({});
    };

    const getPOCurrencySymbol = (po: PurchaseOrder) =>
        po.currency ? (currencySymbols[po.currency] ?? po.currency) : currencySymbol;

    return (
        <div className="flex flex-col h-full">
            <Header title="Purchase Orders" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by PO ID or Vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    <CSVExportButton
                        data={filteredPurchaseOrders as unknown as Record<string, unknown>[]}
                        filename="purchase-orders"
                        columns={[
                            { key: 'id' as const, label: 'PO ID' },
                            { key: 'vendorName' as const, label: 'Vendor' },
                            { key: 'totalCost' as const, label: 'Total Cost' },
                            { key: 'status' as const, label: 'Status' },
                            { key: 'orderDate' as const, label: 'Order Date' },
                            { key: 'expectedDeliveryDate' as const, label: 'Expected Delivery' },
                        ]}
                    />
                    <ColumnVisibilityMenu visibility={columnVisibility} />
                    {canCreatePo && (
                        <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                            <PlusCircle className="h-4 w-4" /> Create Purchase Order
                        </Button>
                    )}
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('id')}>PO ID <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    {isVisible('vendorName') && <TableHead><Button variant="ghost" onClick={() => handleSort('vendorName')}>Vendor <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                                    {isVisible('totalCost') && <TableHead className="hidden md:table-cell text-right"><Button variant="ghost" onClick={() => handleSort('totalCost')}>Total Cost <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                                    {isVisible('status') && <TableHead>Status</TableHead>}
                                    {isVisible('orderDate') && <TableHead className="hidden lg:table-cell"><Button variant="ghost" onClick={() => handleSort('orderDate')}>Order Date <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>}
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {isPOsLoading ? (
                                <TableSkeleton rows={8} cols={6} />
                            ) : (
                                <TableBody>
                                    {filteredPurchaseOrders.map(po => (
                                        <TableRow key={po.id}>
                                            <TableCell className="font-medium">{po.id}</TableCell>
                                            {isVisible('vendorName') && <TableCell>{po.vendorName}</TableCell>}
                                            {isVisible('totalCost') && <TableCell className="hidden md:table-cell text-right">{getPOCurrencySymbol(po)} {formatNumber(po.totalCost)}</TableCell>}
                                            {isVisible('status') && (
                                                <TableCell>
                                                    {po.status === 'cancelled' && po.rejectionReason ? (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant="destructive" className="capitalize cursor-help">Cancelled</Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="max-w-xs">Rejected: {po.rejectionReason}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : (
                                                        <Badge variant={statusVariant[po.status]} className="capitalize">
                                                            {po.status.replace('-', ' ')}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            )}
                                            {isVisible('orderDate') && <TableCell className="hidden lg:table-cell">{parseISO(po.orderDate).toLocaleDateString()}</TableCell>}
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => setPoToView(po)}>
                                                            <FileText className="mr-2 h-4 w-4" />
                                                            View/Print PO
                                                        </DropdownMenuItem>
                                                        {canManage && po.status === 'pending-approval' && (
                                                            <>
                                                                <DropdownMenuItem onClick={() => { setPoToApprove(po); setApprovalMode('approve'); setRejectionReason(''); }}>
                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                    Approve PO
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => { setPoToApprove(po); setApprovalMode('reject'); setRejectionReason(''); }}>
                                                                    <X className="mr-2 h-4 w-4" />
                                                                    Reject PO
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {po.status === 'ordered' && canEdit && (
                                                            <DropdownMenuItem onClick={() => { setPoToMarkReceived(po); setReceivingWarehouseId(getDefaultWarehouse(warehouses)?.id ?? ''); }}>Mark as Received</DropdownMenuItem>
                                                        )}
                                                        {canEdit && <DropdownMenuItem onClick={() => handleOpenForm(po)}>Edit</DropdownMenuItem>}
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

            {/* PO Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) { setPoToEdit(null); setAttachments([]); } }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{poToEdit ? 'Edit PO' : 'Create Purchase Order'}</DialogTitle>
                        <DialogDescription>{poToEdit ? 'Update details.' : 'Fill out the form to create a new PO.'}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="vendorId" render={({ field }) => (
                                    <FormItem><FormLabel>Vendor</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger></FormControl>
                                            <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="currency" render={({ field }) => (
                                    <FormItem><FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={`Default (${currency})`} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c} — {currencySymbols[c]}</SelectItem>)}
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {canManage ? (
                                    <FormField control={form.control} name="status" render={({ field }) => (
                                        <FormItem><FormLabel>Status</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="pending-approval">Pending Approval</SelectItem>
                                                    <SelectItem value="ordered">Ordered</SelectItem>
                                                    <SelectItem value="received">Received</SelectItem>
                                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                                </SelectContent>
                                            </Select><FormMessage />
                                        </FormItem>
                                    )} />
                                ) : (
                                    poToEdit ? (
                                        <FormItem><FormLabel>Status</FormLabel><Input value={form.getValues('status').replace('-', ' ')} className="capitalize" disabled /></FormItem>
                                    ) : (
                                        <FormItem><FormLabel>Status</FormLabel><Input value="Pending Approval" disabled /></FormItem>
                                    )
                                )}
                                <FormField control={form.control} name="orderDate" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Order Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="expectedDeliveryDate" render={({ field }) => (
                                <FormItem className="flex flex-col pt-2"><FormLabel>Expected Delivery</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                            )} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                                    <FormItem><FormLabel>Payment Terms</FormLabel><FormControl><Input placeholder="e.g. Net 30" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="warehouse" render={({ field }) => (
                                    <FormItem><FormLabel>Warehouse</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a warehouse" /></SelectTrigger></FormControl>
                                            <SelectContent>{warehouses.filter(w => !w.deletedAt).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="discount" render={({ field }) => (
                                    <FormItem><FormLabel>Discount</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="taxRate" render={({ field }) => (
                                    <FormItem><FormLabel>Tax (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                            )} />

                            <div className="space-y-2">
                                <FormLabel>Items to Order</FormLabel>
                                <div className="space-y-2 rounded-lg border p-2">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex flex-wrap items-end gap-2">
                                            <FormField control={form.control} name={`items.${index}.productId`} render={({ field }) => (
                                                <FormItem className="flex-1 min-w-[150px]"><FormControl>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                                        <SelectContent>{availableProductsForPO.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                                <FormItem className="w-24"><FormLabel className="sr-only">Qty</FormLabel><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={form.control} name={`items.${index}.cost`} render={({ field }) => (
                                                <FormItem className="w-28"><FormLabel className="sr-only">Cost/item</FormLabel><FormControl><Input type="number" placeholder="Cost/item" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1, cost: 0 })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                                    </Button>
                                </div>
                                <FormMessage>{form.formState.errors.items?.message}</FormMessage>
                            </div>

                            {/* Attachments */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" /> Attachments</Label>
                                <p className="text-xs text-muted-foreground">Max 500 KB per file. Total recommended under 800 KB.</p>
                                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                    <Paperclip className="mr-2 h-4 w-4" /> Add File
                                </Button>
                                {attachments.length > 0 && (
                                    <div className="space-y-1 mt-2">
                                        {attachments.map(att => (
                                            <div key={att.id} className="flex items-center gap-2 text-sm p-1 rounded border bg-muted/30">
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
                            </div>

                            <div className="flex justify-end pt-4">
                                <div className="text-right">
                                    <p className="text-muted-foreground">Total Order Cost</p>
                                    <p className="text-2xl font-bold">{currencySymbol} {formatNumber(totalCost)}</p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit">{poToEdit ? 'Save Changes' : 'Create PO'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Approve / Reject PO Dialog — shows the multi-step workflow panel when a chain is
                configured for this PO (approvalRules['purchase-order'] was set at creation time),
                otherwise falls back to the original single-click approve/reject buttons. */}
            <Dialog open={!!poToApprove} onOpenChange={(open) => { if (!open) { setPoToApprove(null); setRejectionReason(''); setApprovalMode('approve'); } }}>
                <DialogContent>
                    {poToApprove && poActiveWorkflow ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Approve Purchase Order</DialogTitle>
                                <DialogDescription>PO #{poToApprove.id} requires the approvals below before it moves to &quot;Ordered&quot;.</DialogDescription>
                            </DialogHeader>
                            <ApprovalWorkflowPanel
                                entityType="purchase-order"
                                entityId={poToApprove.id}
                                entityTitle={`PO ${poToApprove.id} — ${poToApprove.vendorName}`}
                                workflow={poActiveWorkflow}
                                onWorkflowChange={(updated) => {
                                    setApprovalWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
                                    if (updated.finalStatus === 'approved' || updated.finalStatus === 'rejected') {
                                        finalizePoDecision(poToApprove, updated.finalStatus);
                                        setPoToApprove(null);
                                    }
                                }}
                            />
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setPoToApprove(null)}>Close</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>{approvalMode === 'approve' ? 'Approve Purchase Order' : 'Reject Purchase Order'}</DialogTitle>
                                <DialogDescription>
                                    {approvalMode === 'approve'
                                        ? `Approving PO #${poToApprove?.id} will set its status to "Ordered".`
                                        : `Rejecting PO #${poToApprove?.id} will cancel it.`}
                                </DialogDescription>
                            </DialogHeader>
                            {approvalMode === 'reject' && (
                                <div className="space-y-2 py-2">
                                    <Label htmlFor="po-rejection-reason">Reason for rejection (optional)</Label>
                                    <Textarea
                                        id="po-rejection-reason"
                                        placeholder="Provide a reason..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                </div>
                            )}
                            {approvalMode === 'approve' && (
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setApprovalMode('reject')}>
                                        <X className="mr-2 h-4 w-4" /> Switch to Reject
                                    </Button>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setPoToApprove(null); setRejectionReason(''); setApprovalMode('approve'); }}>Cancel</Button>
                                {approvalMode === 'approve' ? (
                                    <Button onClick={handleApprovePO}>Approve & Set to Ordered</Button>
                                ) : (
                                    <Button variant="destructive" onClick={handleRejectPO}>Confirm Rejection</Button>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!poToMarkReceived} onOpenChange={(open) => !open && setPoToMarkReceived(null)}>
                <AlertDialogContent className="sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mark as Received?</AlertDialogTitle>
                        <AlertDialogDescription>This will add the item quantities from PO #{poToMarkReceived?.id} to your inventory stock. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    {poToMarkReceived && (
                        <div className="py-2 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="receiving-warehouse">Receive into warehouse</Label>
                                <Select value={receivingWarehouseId} onValueChange={setReceivingWarehouseId}>
                                    <SelectTrigger id="receiving-warehouse"><SelectValue placeholder="Select a warehouse" /></SelectTrigger>
                                    <SelectContent>
                                        {warehouses.filter(w => !w.deletedAt).map(w => (
                                            <SelectItem key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Default)' : ''}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {poToMarkReceived.items
                                .map(item => ({ item, product: products.find(p => p.id === item.productId) }))
                                .filter(({ product }) => product?.trackingMode === 'lot' || product?.trackingMode === 'serial')
                                .map(({ item, product }) => (
                                    <div key={item.productId} className="space-y-1.5 rounded-md border p-2.5">
                                        <Label className="text-xs">{item.productName} — {item.quantity} unit(s)</Label>
                                        {product?.trackingMode === 'lot' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    placeholder="Lot number"
                                                    value={receivingLotInfo[item.productId]?.lotNumber ?? ''}
                                                    onChange={(e) => setReceivingLotInfo(prev => ({ ...prev, [item.productId]: { lotNumber: e.target.value, expiryDate: prev[item.productId]?.expiryDate ?? '' } }))}
                                                />
                                                <Input
                                                    type="date"
                                                    placeholder="Expiry (optional)"
                                                    value={receivingLotInfo[item.productId]?.expiryDate ?? ''}
                                                    onChange={(e) => setReceivingLotInfo(prev => ({ ...prev, [item.productId]: { lotNumber: prev[item.productId]?.lotNumber ?? '', expiryDate: e.target.value } }))}
                                                />
                                            </div>
                                        )}
                                        {product?.trackingMode === 'serial' && (
                                            <Input
                                                placeholder={`${item.quantity} serial number(s), comma-separated`}
                                                value={receivingSerials[item.productId] ?? ''}
                                                onChange={(e) => setReceivingSerialsState(prev => ({ ...prev, [item.productId]: e.target.value }))}
                                            />
                                        )}
                                    </div>
                                ))}
                            <LandedCostCalculator
                                purchaseOrderId={poToMarkReceived.id}
                                purchaseOrderTotal={poToMarkReceived.totalCost}
                            />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMarkAsReceived} disabled={!receivingWarehouseId}>Confirm Receipt</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!poToView} onOpenChange={(open) => !open && setPoToView(null)}>
                {poToView && (
                    <>
                        <FullPurchaseOrder purchaseOrder={poToView} />
                        <div className="px-6 pb-6">
                            <h3 className="text-sm font-semibold mb-2 mt-4">Activity History</h3>
                            <ActivityFeed entityId={poToView.id} maxItems={10} />
                        </div>
                    </>
                )}
            </Dialog>
        </div>
    );
}
