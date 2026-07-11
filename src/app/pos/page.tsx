'use client';

import { usePageTitle } from '@/hooks/use-page-title';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { isSameDay } from 'date-fns/isSameDay';
import { subDays } from 'date-fns/subDays';
import { useAppContext } from '@/context/AppContext';
import { useRequirePermission } from '@/hooks/use-require-role';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Header from '@/components/Header';
import InvoiceReceiptView from '@/components/InvoiceReceiptView';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import {
  Search, Package, Plus, Minus, ShoppingCart, Percent,
  CreditCard, Sparkles, TrendingUp, X, PlusCircle, Banknote, Star,
  ClipboardCheck, FileText, UserPlus, Loader2,
} from '@/components/icons';
import { Textarea } from '@/components/ui/textarea';
import { getDefaultWarehouse, stockLevelId } from '@/lib/warehouse';
import { formatNumber, lineTotal } from '@/lib/money';
import { computeStockConsumption } from '@/lib/pos-sale';
import { iconFor } from '@/lib/product-icon';
import { cn } from '@/lib/utils';
import { CustomFieldsFormSection } from '@/components/custom-fields/CustomFields';
import type { Customer, Invoice, InvoiceItem, Product } from '@/types';

type CartLine = { key: string; productId?: string; name: string; price: number; qty: number; discount?: number; discountType?: 'percent' | 'amount'; unit?: string; isCustom?: boolean };

const HOUR_LABEL = (h: number) => h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;

/** Parses an invoice's best-known sale timestamp (createdAt if present, else date-at-midnight). */
function saleTime(inv: Invoice): Date {
  return inv.createdAt ? new Date(inv.createdAt) : new Date(`${inv.date}T00:00:00`);
}

function Sparkline({ data }: { data: { h: string; v: number }[] }) {
  const w = 240, h = 56;
  if (data.length < 2) {
    return (
      <div className="w-full h-14 flex items-center justify-center text-xs text-muted-foreground">
        No sales yet today
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.v), 0);
  const step = w / (data.length - 1);
  const pts = data.map((d, i) => `${i * step},${max > 0 ? h - (d.v / max) * (h - 8) - 4 : h - 4}`);
  const line = pts.join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pos-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#pos-spark)" />
      <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function POSInner() {
  usePageTitle('Point of Sale');
  const {
    products, customers, setCustomers, invoices, setInvoices,
    currencySymbol, currentStore, warehouses, stockLevels,
    user, themeSettings, saveThemeSettings, addActivityLog, addNotification,
  } = useAppContext();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('walk-in');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [taxPct, setTaxPct] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [salesperson, setSalesperson] = useState('');
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [justSold, setJustSold] = useState<Invoice | null>(null);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [saveAsCustomer, setSaveAsCustomer] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string; email: string; company: string; billingAddress: string }>({ name: '', phone: '', email: '', company: '', billingAddress: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Cart sidebar resize (drag handle) — clamped to a sane range, persisted across reloads.
  const [cartWidth, setCartWidth] = useState(() => {
    if (typeof window === 'undefined') return 320;
    const saved = Number(window.localStorage.getItem('pos-cart-width'));
    return Number.isFinite(saved) && saved >= 280 && saved <= 560 ? saved : 320;
  });
  const resizingRef = useRef(false);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const next = Math.min(560, Math.max(280, window.innerWidth - ev.clientX));
      setCartWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setCartWidth(w => { window.localStorage.setItem('pos-cart-width', String(w)); return w; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const canManagePins = user?.role === 'admin' || user?.role === 'manager';
  const pinnedIds = useMemo(() => themeSettings.posPinnedProductIds ?? [], [themeSettings.posPinnedProductIds]);

  const sellable = useMemo(() => products.filter(p => !p.deletedAt), [products]);
  const categories = useMemo(() => ['all', ...Array.from(new Set(sellable.map(p => p.category).filter(Boolean) as string[]))], [sellable]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = sellable.filter(p =>
      (category === 'all' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
    );
    // Pinned items float to the front, in the admin-defined order.
    const rank = (id: string) => { const i = pinnedIds.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
    return [...list].sort((a, b) => rank(a.id) - rank(b.id));
  }, [sellable, search, category, pinnedIds]);

  const togglePin = (id: string) => {
    const next = pinnedIds.includes(id) ? pinnedIds.filter(p => p !== id) : [...pinnedIds, id];
    void saveThemeSettings({ posPinnedProductIds: next });
  };

  // Real "today at a glance" figures — paid invoices for this store, bucketed by hour.
  const { todayHourlySales, todayTotal, todayVsYesterdayPct } = useMemo(() => {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const storeInvoices = currentStore?.id && currentStore.id !== 'all'
      ? invoices.filter(inv => inv.storeId === currentStore.id)
      : invoices;
    const paid = storeInvoices.filter(inv => inv.status === 'paid');

    const todaysPaid = paid.filter(inv => isSameDay(saleTime(inv), now));
    const yesterdaysPaid = paid.filter(inv => isSameDay(saleTime(inv), yesterday));

    // Bucket today's revenue into each hour it actually occurred in, from opening
    // hour to the current hour — so the chart only shows hours that have passed.
    const byHour = new Map<number, number>();
    todaysPaid.forEach(inv => {
      const h = saleTime(inv).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + inv.amount);
    });
    const firstHour = byHour.size > 0 ? Math.min(...byHour.keys()) : now.getHours();
    const lastHour = Math.max(firstHour, now.getHours());
    const hourly = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => {
      const h = firstHour + i;
      return { h: HOUR_LABEL(h), v: byHour.get(h) ?? 0 };
    });

    const todayTotal = todaysPaid.reduce((s, inv) => s + inv.amount, 0);
    const yesterdayTotal = yesterdaysPaid.reduce((s, inv) => s + inv.amount, 0);
    const pct = yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : (todayTotal > 0 ? 100 : 0);

    return { todayHourlySales: hourly, todayTotal, todayVsYesterdayPct: pct };
  }, [invoices, currentStore?.id]);

  const customerOptions = useMemo(() => [
    { label: 'Walk-in Customer', value: 'walk-in' },
    ...customers.map(c => ({ label: [c.name, c.phone, c.email].filter(Boolean).join(' · '), value: c.id })),
  ], [customers]);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const found = prev.find(l => l.productId === p.id);
      if (found) return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { key: `l-${p.id}`, productId: p.id, name: p.name, price: p.price, qty: 1, discount: p.discount || undefined, discountType: p.discountType, unit: p.unitOfMeasure || 'Pcs' }];
    });
  };
  const setQty = (key: string, qty: number) =>
    setCart(prev => qty <= 0 ? prev.filter(l => l.key !== key) : prev.map(l => l.key === key ? { ...l, qty } : l));
  const removeLine = (key: string) => setCart(prev => prev.filter(l => l.key !== key));
  const addCustomLine = () => {
    const price = Number(customPrice);
    if (!customName.trim() || !Number.isFinite(price) || price <= 0) {
      toast({ variant: 'destructive', title: 'Enter a name and amount for the custom line.' });
      return;
    }
    setCart(prev => [...prev, { key: `c-${Date.now()}`, name: customName.trim(), price, qty: 1, isCustom: true }]);
    setCustomName(''); setCustomPrice('');
  };

  // Line totals are net of each product's own discount %; the cart-level
  // discount below then applies on top of that subtotal.
  const subtotal = cart.reduce((s, l) => s + lineTotal(l.price, l.qty, l.discount, l.discountType), 0);
  // Displayed Subtotal is gross (before any discount); per-item discounts are
  // surfaced in the Discount row instead of silently lowering the subtotal.
  const grossSubtotal = cart.reduce((s, l) => s + lineTotal(l.price, l.qty), 0);
  const itemDiscounts = grossSubtotal - subtotal;
  const discountAmt = subtotal * ((Number(discountPct) || 0) / 100);
  const taxAmt = (subtotal - discountAmt) * ((Number(taxPct) || 0) / 100);
  const total = subtotal - discountAmt + taxAmt;
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const clearSale = () => {
    setCart([]); setCustomerId('walk-in'); setWalkInName(''); setWalkInPhone('');
    setDiscountPct(''); setTaxPct(''); setPaymentMethod('cash');
    setNotes(''); setShowNotes(false); setCustomData({}); setSalesperson('');
    setSaveAsCustomer(false); setShowCustomerDetails(false);
    setNewCustomer({ name: '', phone: '', email: '', company: '', billingAddress: '' });
  };

  const toggleSaveAsCustomer = (checked: boolean) => {
    setSaveAsCustomer(checked);
    if (checked) {
      setNewCustomer(prev => ({ ...prev, name: walkInName.trim() || prev.name, phone: walkInPhone.trim() || prev.phone }));
      setShowCustomerDetails(true);
    }
  };

  const saveNewCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast({ variant: 'destructive', title: 'Enter a customer name.' });
      return;
    }
    setSavingCustomer(true);
    try {
      const created: Customer = {
        id: `cust-${Date.now()}`,
        avatar: '',
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || undefined,
        email: newCustomer.email.trim() || undefined,
        company: newCustomer.company.trim() || undefined,
        billingAddress: newCustomer.billingAddress.trim() || undefined,
        loyaltyPoints: 0,
        tier: 'Bronze',
      };
      setCustomers([created, ...customers]);
      addActivityLog('Customer Added', `Added new customer: ${created.name}`);
      setCustomerId(created.id);
      setWalkInName(''); setWalkInPhone('');
      setShowCustomerDetails(false);
      toast({ title: 'Customer added', description: `${created.name} has been added and selected for this sale.` });
    } catch (err) {
      console.error('Failed to save customer:', err);
      toast({ variant: 'destructive', title: 'Could not save customer', description: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSavingCustomer(false);
    }
  };

  const checkout = async () => {
    if (submitting || cart.length === 0) return;
    setSubmitting(true);
    try {
      const saleWarehouse = warehouses.find(w => w.storeId === currentStore?.id) ?? getDefaultWarehouse(warehouses);

      // Stock pre-check (products + services consuming linked products). The
      // authoritative check + decrement happens server-side when the queued
      // sale posts; this guards the common case up front. Queued-but-not-yet-
      // posted sales also count as consumed, so back-to-back (or offline)
      // sales can't oversell before the server has synced the decrements.
      const productLines = cart.filter(l => l.productId && !l.isCustom).map(l => ({ productId: l.productId!, quantity: l.qty }));
      const consumption = computeStockConsumption(productLines, products);
      const queuedLines = invoices
        .filter(inv => inv.postStatus === 'queued')
        .flatMap(inv => inv.items.filter(it => !it.isCustom).map(it => ({ productId: it.productId, quantity: it.quantity })));
      const pendingConsumption = computeStockConsumption(queuedLines, products);
      for (const [pid, need] of consumption) {
        const prod = products.find(p => p.id === pid);
        if (!prod) continue;
        // Product.stock is authoritative; a warehouse row may only RAISE availability,
        // never lower it below the product's own on-hand (guards stale/mis-seeded rows).
        const whStock = saleWarehouse ? stockLevels.find(s => s.id === stockLevelId(pid, saleWarehouse.id))?.stock : undefined;
        const available = Math.max(prod.stock, whStock ?? prod.stock) - (pendingConsumption.get(pid) ?? 0);
        if (available < need) {
          toast({ variant: 'destructive', title: 'Insufficient stock', description: `${prod.name}: have ${available}, need ${need}.` });
          setSubmitting(false);
          return;
        }
      }
      const savedCustomer = customers.find(c => c.id === customerId);
      const customerFields = savedCustomer
        ? { customerId: savedCustomer.id, customerName: savedCustomer.name, customerPhone: savedCustomer.phone || undefined }
        : { customerId: undefined, customerName: walkInName.trim() || undefined, customerPhone: walkInPhone.trim() || undefined };
      const items: InvoiceItem[] = cart.map((l, i) => l.isCustom
        ? { productId: `custom-${Date.now()}-${i}`, productName: l.name, quantity: l.qty, price: l.price, cost: 0, isCustom: true }
        : { productId: l.productId!, productName: l.name, quantity: l.qty, price: l.price, cost: products.find(p => p.id === l.productId)?.cost ?? 0, ...(l.discount ? { discount: l.discount, discountType: l.discountType ?? 'percent' } : {}), unit: l.unit || 'Pcs' });
      const prefix = themeSettings.invoicePrefix || 'INV-';
      const now = new Date();

      // Outbox pattern: the sale is written as a plain Firestore doc with
      // postStatus 'queued' — instant from the local cache and offline-safe.
      // The postQueuedInvoice Cloud Function trigger then performs the
      // authoritative posting (stock decrement, final invoice number, ledger)
      // and atomically replaces this doc with the final numbered invoice
      // carrying the same clientRef, which the receipt view reconciles on.
      const clientRef = `POS-${now.getTime().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0')}`;
      // Predict the next invoice number from the cached list (also counting
      // other queued sales' predictions, so back-to-back sales don't reuse a
      // number). The receipt shows this instead of the internal reference; the
      // server keeps it unless another terminal took it first.
      const parseNum = (v?: string) => {
        if (!v?.startsWith(prefix)) return 0;
        const n = parseInt(v.slice(prefix.length), 10);
        return isNaN(n) ? 0 : n;
      };
      const nextNum = invoices.reduce((m, inv) => Math.max(m, parseNum(inv.id), parseNum(inv.predictedId)), 0) + 1;
      const predictedId = `${prefix}${String(nextNum).padStart(3, '0')}`;
      const queuedInvoice: Invoice = {
        id: clientRef,
        clientRef,
        predictedId,
        postStatus: 'queued',
        invoicePrefix: prefix,
        storeId: currentStore?.id,
        ...customerFields,
        userId: user?.id,
        userName: user?.name,
        status: 'paid',
        date: format(now, 'yyyy-MM-dd'),
        createdAt: now.toISOString(),
        dueDate: format(addDays(now, 30), 'yyyy-MM-dd'),
        items,
        amount: total,
        discount: Number(discountPct) || 0,
        taxRate: Number(taxPct) || 0,
        paymentMethod,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(salesperson.trim() ? { salesperson: salesperson.trim() } : {}),
        ...(Object.keys(customData).length > 0 ? { customData } : {}),
      };
      setInvoices(prev => [queuedInvoice, ...prev]);

      // Predicted low-stock warnings — the server owns the real decrement,
      // but the cashier should hear about it now, not after sync.
      for (const [pid, d] of consumption) {
        const prod = products.find(p => p.id === pid);
        const predicted = prod ? prod.stock - d - (pendingConsumption.get(pid) ?? 0) : 0;
        if (prod && typeof prod.reorderThreshold !== 'undefined' && predicted <= prod.reorderThreshold) {
          addNotification({ title: 'Low Stock Alert', description: `${prod.name} is low (${predicted} left).`, href: `/purchase-orders?action=new&productId=${prod.id}` });
        }
      }

      addActivityLog('POS Sale', `Sold ${predictedId} for ${currencySymbol} ${formatNumber(total)}`);
      toast({ title: 'Sale recorded', description: `${currencySymbol} ${formatNumber(total)} — receipt ready, posting in the background.` });
      setJustSold(queuedInvoice);
      clearSale();
    } finally {
      setSubmitting(false);
    }
  };

  // While the receipt is open, follow the queued sale through the outbox:
  // when the postQueuedInvoice trigger replaces the provisional doc with the
  // final numbered invoice (same clientRef), or marks it failed, swap the
  // receipt over so the cashier sees the real number / the failure reason.
  useEffect(() => {
    if (!justSold?.clientRef || justSold.postStatus === 'posted') return;
    const match = invoices.find(inv => inv.clientRef === justSold.clientRef);
    if (match && (match.id !== justSold.id || match.postStatus !== justSold.postStatus)) {
      setJustSold(match);
    }
  }, [invoices, justSold]);

  const stockOf = (p: Product) => p.kind === 'service' ? null : p.stock;
  const formatQty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-full">
      <Header title="Point of Sale">
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href="/invoices">
            <FileText className="h-4 w-4" />
            Invoices
          </Link>
        </Button>
      </Header>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-muted/30 gap-4 p-4">
      {/* ---------------- Catalogue ---------------- */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Items in cart" value={String(itemCount)} accent />
          <SummaryCard icon={<CreditCard className="h-4 w-4" />} label="Cart total" value={`${currencySymbol} ${formatNumber(total)}`} />
          <SummaryCard icon={<Package className="h-4 w-4" />} label="Products" value={String(sellable.length)} />
          <div className="rounded-2xl border bg-card p-4 shadow-token-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Today · {currencySymbol} {formatNumber(todayTotal, 0, 0)}</span>
              {todayHourlySales.length >= 2 && (
                <span className={cn('text-xs font-semibold', todayVsYesterdayPct >= 0 ? 'text-primary' : 'text-destructive')}>
                  {todayVsYesterdayPct >= 0 ? '+' : ''}{formatNumber(todayVsYesterdayPct, 0, 0)}%
                </span>
              )}
            </div>
            <Sparkline data={todayHourlySales} />
          </div>
        </div>

        {/* Search + category */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name or SKU…" className="pl-9 h-11 rounded-xl" />
          </div>
          <Combobox
            options={categories.map(c => ({ label: c === 'all' ? 'All items' : c, value: c }))}
            value={category}
            onValueChange={(v) => setCategory(v || 'all')}
            placeholder="All items"
            searchPlaceholder="Search category…"
            emptyText="No category found."
            className="h-11 rounded-xl sm:w-56 shrink-0 capitalize"
          />
        </div>

        {/* Product grid — auto-fill with a minmax floor sizes columns off the panel's
            own pixel width (not the viewport), so it reflows correctly as the cart
            is dragged wider/narrower instead of overflowing at fixed breakpoints. */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3 py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Package className="h-7 w-7" /></div>
              <p>No products match your search.</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map(p => {
                const stock = stockOf(p);
                const out = stock !== null && stock <= 0;
                const pinned = pinnedIds.includes(p.id);
                const FallbackIcon = iconFor(p.name, p.iconName);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={out ? -1 : 0}
                    onClick={() => !out && addToCart(p)}
                    onKeyDown={(e) => { if (!out && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); addToCart(p); } }}
                    className={cn(
                      'group relative text-left rounded-2xl border bg-card p-3 shadow-token-sm transition-all cursor-pointer outline-none',
                      'hover:shadow-token-md hover:-translate-y-0.5 hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 active:shadow-token-sm',
                      out && 'opacity-55 cursor-not-allowed hover:translate-y-0 hover:shadow-token-sm',
                      pinned && 'border-primary/40 ring-1 ring-primary/20'
                    )}
                  >
                    {/* Pin control (admins/managers) — floats items to the front of the catalogue */}
                    {canManagePins && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); togglePin(p.id); }}
                        aria-label={pinned ? 'Unpin from POS' : 'Pin to POS'}
                        className={cn(
                          'absolute top-2 right-2 z-10 h-7 w-7 rounded-full flex items-center justify-center transition-all shadow-token-sm',
                          pinned ? 'bg-primary text-primary-foreground'
                            : 'bg-background/90 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'
                        )}
                      >
                        <Star className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
                      </button>
                    )}
                    {/* Image / name-derived icon placeholder — editable via Inventory (imageUrl / iconName) */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center mb-3">
                      {p.imageUrl ? (
                        <Image src={p.imageUrl} alt={p.name} fill sizes="200px" className="object-cover" unoptimized />
                      ) : (
                        <FallbackIcon className="h-9 w-9 text-muted-foreground/70" />
                      )}
                      {p.kind === 'service' && (
                        <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-background/90 text-foreground shadow-token-sm">Service</span>
                      )}
                      <span className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-token-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.sku || '—'}</p>
                    <div className="flex items-center justify-between gap-1 mt-2 flex-wrap">
                      <span className="font-semibold tabular-nums truncate">{currencySymbol} {formatNumber(p.price)}</span>
                      {stock !== null ? (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap',
                          out ? 'bg-destructive/10 text-destructive'
                            : stock <= (p.reorderThreshold ?? 0) ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-emerald-500/15 text-emerald-600')}>
                          {out ? 'Out' : `${formatQty(stock)} left`}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">Service</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Cart ---------------- */}
      <div className="relative flex shrink-0 w-full lg:w-[var(--cart-w)]" style={{ '--cart-w': `${cartWidth}px` } as CSSProperties}>
        {/* Drag handle */}
        <div
          onPointerDown={startResize}
          className="hidden lg:flex absolute left-0 top-0 bottom-0 -translate-x-1/2 w-3 cursor-col-resize items-center justify-center z-10 group"
        >
          <div className="w-1 h-10 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
        </div>
        <aside className="w-full flex flex-col rounded-2xl border bg-card shadow-token-md overflow-hidden text-sm">
        <div className="p-3 border-b bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold flex items-center gap-1.5 text-sm"><ShoppingCart className="h-3.5 w-3.5" /> Current sale</h2>
            {cart.length > 0 && (
              <button onClick={clearSale} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Clear</button>
            )}
          </div>
          <Combobox
            options={customerOptions}
            value={customerId}
            onValueChange={(v) => setCustomerId(v || 'walk-in')}
            placeholder="Walk-in Customer"
            searchPlaceholder="Search name, phone or email…"
            emptyText="No customer found."
            className="h-9 rounded-lg text-sm"
          />
          {customerId === 'walk-in' && (
            <div className="mt-1.5 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Name (optional)" className="h-8 rounded-lg text-xs" />
                <Input value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} placeholder="Phone (optional)" className="h-8 rounded-lg text-xs" />
              </div>
              <label className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><UserPlus className="h-3 w-3" /> Save as customer</span>
                <Switch checked={saveAsCustomer} onCheckedChange={toggleSaveAsCustomer} className="scale-90 data-[state=unchecked]:bg-muted-foreground/40" />
              </label>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[100px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8">
              <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center"><ShoppingCart className="h-4 w-4" /></div>
              <p className="text-xs">Tap a product to add it.</p>
            </div>
          ) : cart.map(l => (
            <div key={l.key} className="flex items-center gap-1.5 rounded-lg border bg-background p-1.5">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                {l.isCustom ? <Sparkles className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{l.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {currencySymbol} {formatNumber(l.price)}{l.unit && <span className="ml-0.5">/{l.unit}</span>}
                  {(l.discount ?? 0) > 0 && (
                    <span className="ml-1 text-green-600 dark:text-green-500 font-medium">
                      −{l.discountType === 'amount' ? `${currencySymbol}${formatNumber(l.discount!)}` : `${l.discount}%`}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(l.key, l.qty - 1)} className="h-6 w-6 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"><Minus className="h-3 w-3" /></button>
                <span className="w-5 text-center text-xs font-medium tabular-nums">{l.qty}</span>
                <button onClick={() => setQty(l.key, l.qty + 1)} className="h-6 w-6 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"><Plus className="h-3 w-3" /></button>
              </div>
              <button onClick={() => removeLine(l.key)} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}

          {/* Custom line adder */}
          <div className="flex gap-1.5 pt-1">
            <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Custom charge / fee" className="h-8 rounded-lg text-xs" />
            <Input value={customPrice} onChange={e => setCustomPrice(e.target.value)} type="number" placeholder="Amt" className="h-8 w-16 rounded-lg text-xs" />
            <button onClick={addCustomLine} className="h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><PlusCircle className="h-3.5 w-3.5" /></button>
          </div>

          {/* Additional details (order notes) — collapsed by default to stay compact */}
          <div className="pt-1">
            {showNotes ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ClipboardCheck className="h-3 w-3" /> Additional details</span>
                  <button onClick={() => { setShowNotes(false); setNotes(''); }} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Remove</button>
                </div>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Order notes, delivery instructions, special requests…"
                  className="min-h-[60px] rounded-lg text-xs resize-none"
                />
                <Input
                  value={salesperson}
                  onChange={e => setSalesperson(e.target.value)}
                  placeholder="Salesperson (optional)"
                  className="h-8 rounded-lg text-xs"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="w-full h-8 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-ring/40 transition-colors flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> Add additional details
              </button>
            )}
          </div>

          {/* Tenant-defined custom fields for invoices (e.g. Odometer, linked fields) */}
          <CustomFieldsFormSection entity="invoice" value={customData} onChange={setCustomData} />
        </div>

        {/* Totals + checkout */}
        <div className="border-t p-3 space-y-2 bg-gradient-to-t from-muted/40 to-transparent">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="relative">
              <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input value={discountPct} onChange={e => setDiscountPct(e.target.value)} type="number" placeholder="Discount" className="h-8 pl-6 rounded-lg text-xs" />
            </div>
            <div className="relative">
              <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input value={taxPct} onChange={e => setTaxPct(e.target.value)} type="number" placeholder="Tax" className="h-8 pl-6 rounded-lg text-xs" />
            </div>
          </div>
          {/* Payment method */}
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { key: 'cash' as const, label: 'Cash', icon: Banknote },
              { key: 'card' as const, label: 'Card', icon: CreditCard },
            ]).map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPaymentMethod(m.key)}
                className={cn(
                  'h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === m.key
                    ? 'bg-primary text-primary-foreground border-primary shadow-token-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-ring/40 hover:text-foreground'
                )}
              >
                <m.icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>
          <div className="space-y-1 text-xs">
            <Row label="Subtotal" value={`${currencySymbol} ${formatNumber(grossSubtotal)}`} />
            {(itemDiscounts + discountAmt) > 0 && <Row label={`Discount${Number(discountPct) > 0 ? ` (incl. ${discountPct}%)` : ''}`} value={`-${currencySymbol} ${formatNumber(itemDiscounts + discountAmt)}`} className="text-destructive" />}
            {taxAmt > 0 && <Row label={`Tax (${taxPct}%)`} value={`+${currencySymbol} ${formatNumber(taxAmt)}`} />}
            <div className="flex justify-between pt-1.5 mt-1 border-t font-semibold text-base">
              <span>Total</span><span className="tabular-nums">{currencySymbol} {formatNumber(total)}</span>
            </div>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={cart.length === 0 || submitting}
            className={cn(
              'w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
              'bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-token-md',
              'hover:shadow-token-lg hover:brightness-105 active:brightness-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-token-sm'
            )}
          >
            <CreditCard className="h-4 w-4" />
            {submitting ? 'Processing…' : `Charge ${currencySymbol} ${formatNumber(total)}`}
          </button>
        </div>
      </aside>
      </div>
      </div>

      {/* Save-as-customer detail popup — inherits the walk-in name/phone just entered */}
      <Dialog open={showCustomerDetails} onOpenChange={(open) => { setShowCustomerDetails(open); if (!open) setSaveAsCustomer(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>Fill in the customer&apos;s details to save them for future sales.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-name">Name</Label>
              <Input id="new-cust-name" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} placeholder="Customer name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-cust-phone">Phone</Label>
                <Input id="new-cust-phone" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-cust-email">Email</Label>
                <Input id="new-cust-email" type="email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} placeholder="Email (optional)" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-company">Company</Label>
              <Input id="new-cust-company" value={newCustomer.company} onChange={e => setNewCustomer(p => ({ ...p, company: e.target.value }))} placeholder="Company (optional)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-cust-address">Billing address</Label>
              <Textarea id="new-cust-address" value={newCustomer.billingAddress} onChange={e => setNewCustomer(p => ({ ...p, billingAddress: e.target.value }))} placeholder="Billing address (optional)" className="min-h-[60px] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowCustomerDetails(false); setSaveAsCustomer(false); }}>Cancel</Button>
            <Button type="button" onClick={saveNewCustomer} disabled={savingCustomer}>
              {savingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {savingCustomer ? 'Saving…' : 'Save customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm before generating the invoice */}
      <Dialog open={showConfirm} onOpenChange={(open) => !submitting && setShowConfirm(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm sale</DialogTitle>
            <DialogDescription>Review the order before generating the invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
              {cart.map(line => (
                <div key={line.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{line.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatQty(line.qty)} {line.unit || 'Pcs'} × {currencySymbol} {formatNumber(line.price)}
                      {line.discount ? (
                        <span className="text-destructive"> · {line.discountType === 'amount' ? `${currencySymbol} ${formatNumber(line.discount)} off/unit` : `${line.discount}% off`}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 tabular-nums font-medium">
                    {currencySymbol} {formatNumber(lineTotal(line.price, line.qty, line.discount, line.discountType))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              <Row label="Date & time" value={format(new Date(), 'dd MMM yyyy, h:mm a')} />
              {currentStore && <Row label="Store" value={currentStore.name} />}
              {user?.name && <Row label="Cashier" value={user.name} />}
              {salesperson.trim() && <Row label="Salesperson" value={salesperson.trim()} />}
              <Row
                label="Customer"
                value={(() => {
                  const saved = customers.find(c => c.id === customerId);
                  if (saved) return [saved.name, saved.phone].filter(Boolean).join(' · ');
                  const walkIn = [walkInName.trim(), walkInPhone.trim()].filter(Boolean).join(' · ');
                  return walkIn || 'Walk-in';
                })()}
              />
              <Row label="Payment method" value={paymentMethod === 'cash' ? 'Cash' : 'Card'} />
              <Row label="Items" value={`${cart.length} ${cart.length === 1 ? 'line' : 'lines'} · ${formatQty(itemCount)} units`} />
            </div>
            {notes.trim() && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Notes: </span>{notes.trim()}
              </div>
            )}
            <div className="space-y-1 text-sm border-t pt-2">
              <Row label="Subtotal" value={`${currencySymbol} ${formatNumber(grossSubtotal)}`} />
              {(itemDiscounts + discountAmt) > 0 && <Row label={`Discount${Number(discountPct) > 0 ? ` (incl. ${discountPct}%)` : ''}`} value={`-${currencySymbol} ${formatNumber(itemDiscounts + discountAmt)}`} className="text-destructive" />}
              {taxAmt > 0 && <Row label={`Tax (${taxPct}%)`} value={`+${currencySymbol} ${formatNumber(taxAmt)}`} />}
              <div className="flex justify-between pt-1.5 mt-1 border-t font-semibold text-base">
                <span>Total</span><span className="tabular-nums">{currencySymbol} {formatNumber(total)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting}>Cancel</Button>
            <Button
              type="button"
              onClick={async () => { await checkout(); setShowConfirm(false); }}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Generating…' : 'Generate Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post-sale invoice + receipt. While the sale is still queued, show the
          predicted invoice number instead of the internal POS- reference so
          the printed/previewed documents always carry a proper number. */}
      <Dialog open={!!justSold} onOpenChange={(open) => !open && setJustSold(null)}>
        {justSold && (
          <InvoiceReceiptView
            invoice={justSold.postStatus === 'queued' && justSold.predictedId ? { ...justSold, id: justSold.predictedId } : justSold}
          />
        )}
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4 shadow-token-sm', accent ? 'bg-gradient-to-br from-primary/10 to-transparent border-primary/20' : 'bg-card')}>
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</span>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums', className)}>{value}</span>
    </div>
  );
}

export default function POSPage() {
  const allowed = useRequirePermission('Sales & Customers', 'edit', true);
  if (!allowed) return null;
  return <POSInner />;
}
