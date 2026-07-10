'use client';

import { usePageTitle } from '@/hooks/use-page-title';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';
import { isSameDay } from 'date-fns/isSameDay';
import { subDays } from 'date-fns/subDays';
import { useAppContext } from '@/context/AppContext';
import { useRequirePermission } from '@/hooks/use-require-role';
import { useToast } from '@/hooks/use-toast';
import { Dialog } from '@/components/ui/dialog';
import Header from '@/components/Header';
import InvoiceReceiptView from '@/components/InvoiceReceiptView';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Search, Package, Plus, Minus, ShoppingCart, Percent,
  CreditCard, Sparkles, TrendingUp, X, PlusCircle, Banknote, Star,
} from '@/components/icons';
import { adjustStock, getDefaultWarehouse, stockLevelId } from '@/lib/warehouse';
import { buildInvoiceLedgerEntries } from '@/lib/posting';
import { bumpCounterToAtLeast } from '@/lib/document-number';
import { computeStockConsumption } from '@/lib/pos-sale';
import { iconFor } from '@/lib/product-icon';
import { cn } from '@/lib/utils';
import type { Invoice, InvoiceItem, Product } from '@/types';

type CartLine = { key: string; productId?: string; name: string; price: number; qty: number; isCustom?: boolean };

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
    products, setProducts, customers, setCustomers, invoices, setInvoices,
    currencySymbol, currentStore, warehouses, stockLevels, setStockLevels,
    user, tenantId, themeSettings, saveThemeSettings, setLedgerEntries, addActivityLog, addNotification,
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [justSold, setJustSold] = useState<Invoice | null>(null);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

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
      return [...prev, { key: `l-${p.id}`, productId: p.id, name: p.name, price: p.price, qty: 1 }];
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

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const discountAmt = subtotal * ((Number(discountPct) || 0) / 100);
  const taxAmt = (subtotal - discountAmt) * ((Number(taxPct) || 0) / 100);
  const total = subtotal - discountAmt + taxAmt;
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const clearSale = () => {
    setCart([]); setCustomerId('walk-in'); setWalkInName(''); setWalkInPhone('');
    setDiscountPct(''); setTaxPct(''); setPaymentMethod('cash');
  };

  const checkout = () => {
    if (submitting || cart.length === 0) return;
    setSubmitting(true);
    try {
      const saleWarehouse = warehouses.find(w => w.storeId === currentStore?.id) ?? getDefaultWarehouse(warehouses);

      // Stock check + decrement (products + services consuming linked products).
      const productLines = cart.filter(l => l.productId && !l.isCustom).map(l => ({ productId: l.productId!, quantity: l.qty }));
      const consumption = computeStockConsumption(productLines, products);
      for (const [pid, need] of consumption) {
        const prod = products.find(p => p.id === pid);
        if (!prod) continue;
        // Product.stock is authoritative; a warehouse row may only RAISE availability,
        // never lower it below the product's own on-hand (guards stale/mis-seeded rows).
        const whStock = saleWarehouse ? stockLevels.find(s => s.id === stockLevelId(pid, saleWarehouse.id))?.stock : undefined;
        const available = Math.max(prod.stock, whStock ?? prod.stock);
        if (available < need) {
          toast({ variant: 'destructive', title: 'Insufficient stock', description: `${prod.name}: have ${available}, need ${need}.` });
          setSubmitting(false);
          return;
        }
      }
      const updatedProducts = products.map(p => {
        const d = consumption.get(p.id);
        return d ? { ...p, stock: p.stock - d } : p;
      });
      for (const [pid, d] of consumption) {
        // Seed a first-ever warehouse StockLevel row from the product's pre-sale
        // stock, so warehouse figures don't start from zero and wrongly block reorders.
        const baseline = products.find(p => p.id === pid)?.stock ?? 0;
        if (d && saleWarehouse) adjustStock({ stockLevels, setStockLevels }, pid, saleWarehouse.id, -d, baseline);
        const prod = updatedProducts.find(p => p.id === pid);
        if (prod && typeof prod.reorderThreshold !== 'undefined' && prod.stock <= prod.reorderThreshold) {
          addNotification({ title: 'Low Stock Alert', description: `${prod.name} is low (${prod.stock} left).`, href: `/purchase-orders?action=new&productId=${prod.id}` });
        }
      }
      setProducts(updatedProducts);

      // Resolve customer (saved or walk-in snapshot).
      const savedCustomer = customers.find(c => c.id === customerId);
      const customerFields = savedCustomer
        ? { customerId: savedCustomer.id, customerName: savedCustomer.name, customerPhone: savedCustomer.phone || undefined }
        : { customerId: undefined, customerName: walkInName.trim() || undefined, customerPhone: walkInPhone.trim() || undefined };

      const items: InvoiceItem[] = cart.map((l, i) => l.isCustom
        ? { productId: `custom-${Date.now()}-${i}`, productName: l.name, quantity: l.qty, price: l.price, cost: 0, isCustom: true }
        : { productId: l.productId!, productName: l.name, quantity: l.qty, price: l.price, cost: products.find(p => p.id === l.productId)?.cost ?? 0 });

      const prefix = themeSettings.invoicePrefix || 'INV-';
      const nextNum = invoices.reduce((m, inv) => { const n = parseInt(inv.id.replace(prefix, ''), 10); return isNaN(n) ? m : Math.max(m, n); }, 0) + 1;
      const id = `${prefix}${String(nextNum).padStart(3, '0')}`;
      if (tenantId) void bumpCounterToAtLeast(tenantId, 'invoice', nextNum);

      const now = new Date();
      const invoice: Invoice = {
        id,
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
      };
      setInvoices([invoice, ...invoices]);
      // POS sales are paid on the spot — post the balanced GL entries.
      if (user?.role === 'admin' || user?.role === 'manager') {
        const entries = buildInvoiceLedgerEntries(invoice);
        setLedgerEntries(prev => { const ids = new Set(entries.map(e => e.id)); return [...entries, ...prev.filter(e => !ids.has(e.id))]; });
      }
      addActivityLog('POS Sale', `Sold ${id} for ${currencySymbol} ${total.toFixed(2)}`);
      toast({ title: 'Sale complete', description: `${id} · ${currencySymbol} ${total.toFixed(2)}` });
      setJustSold(invoice);
      clearSale();
    } finally {
      setSubmitting(false);
    }
  };

  const stockOf = (p: Product) => p.kind === 'service' ? null : p.stock;

  return (
    <div className="flex flex-col h-full">
      <Header title="Point of Sale" />
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-muted/30 gap-4 p-4">
      {/* ---------------- Catalogue ---------------- */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Items in cart" value={String(itemCount)} accent />
          <SummaryCard icon={<CreditCard className="h-4 w-4" />} label="Cart total" value={`${currencySymbol} ${total.toFixed(2)}`} />
          <SummaryCard icon={<Package className="h-4 w-4" />} label="Products" value={String(sellable.length)} />
          <div className="rounded-2xl border bg-card p-4 shadow-token-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Today · {currencySymbol} {todayTotal.toFixed(0)}</span>
              {todayHourlySales.length >= 2 && (
                <span className={cn('text-xs font-semibold', todayVsYesterdayPct >= 0 ? 'text-primary' : 'text-destructive')}>
                  {todayVsYesterdayPct >= 0 ? '+' : ''}{todayVsYesterdayPct.toFixed(0)}%
                </span>
              )}
            </div>
            <Sparkline data={todayHourlySales} />
          </div>
        </div>

        {/* Search + categories */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name or SKU…" className="pl-9 h-11 rounded-xl" />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'px-4 h-11 rounded-xl text-sm font-medium whitespace-nowrap transition-all border capitalize',
                  category === c
                    ? 'bg-primary text-primary-foreground border-primary shadow-token-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-ring/40 hover:text-foreground'
                )}
              >
                {c === 'all' ? 'All items' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3 py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center"><Package className="h-7 w-7" /></div>
              <p>No products match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3">
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
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-semibold tabular-nums">{currencySymbol} {p.price.toFixed(2)}</span>
                      {stock !== null ? (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full',
                          out ? 'bg-destructive/10 text-destructive'
                            : stock <= (p.reorderThreshold ?? 0) ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-emerald-500/15 text-emerald-600')}>
                          {out ? 'Out' : `${stock} in stock`}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Service</span>
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
      <aside className="w-full lg:w-[380px] shrink-0 flex flex-col rounded-2xl border bg-card shadow-token-md overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Current sale</h2>
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
            className="h-11 rounded-xl"
          />
          {customerId === 'walk-in' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Input value={walkInName} onChange={e => setWalkInName(e.target.value)} placeholder="Name (optional)" className="h-10 rounded-xl" />
              <Input value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} placeholder="Phone (optional)" className="h-10 rounded-xl" />
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-10">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center"><ShoppingCart className="h-5 w-5" /></div>
              <p className="text-sm">Tap a product to add it.</p>
            </div>
          ) : cart.map(l => (
            <div key={l.key} className="flex items-center gap-2 rounded-xl border bg-background p-2">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                {l.isCustom ? <Sparkles className="h-4 w-4" /> : <Package className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground">{currencySymbol} {l.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setQty(l.key, l.qty - 1)} className="h-7 w-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-7 text-center text-sm font-medium tabular-nums">{l.qty}</span>
                <button onClick={() => setQty(l.key, l.qty + 1)} className="h-7 w-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <button onClick={() => removeLine(l.key)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"><X className="h-4 w-4" /></button>
            </div>
          ))}

          {/* Custom line adder */}
          <div className="flex gap-2 pt-1">
            <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Custom charge / fee" className="h-9 rounded-lg text-sm" />
            <Input value={customPrice} onChange={e => setCustomPrice(e.target.value)} type="number" placeholder="Amt" className="h-9 w-20 rounded-lg text-sm" />
            <button onClick={addCustomLine} className="h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><PlusCircle className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Totals + checkout */}
        <div className="border-t p-4 space-y-3 bg-gradient-to-t from-muted/40 to-transparent">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={discountPct} onChange={e => setDiscountPct(e.target.value)} type="number" placeholder="Discount" className="h-9 pl-8 rounded-lg text-sm" />
            </div>
            <div className="relative">
              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={taxPct} onChange={e => setTaxPct(e.target.value)} type="number" placeholder="Tax" className="h-9 pl-8 rounded-lg text-sm" />
            </div>
          </div>
          {/* Payment method */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'cash' as const, label: 'Cash', icon: Banknote },
              { key: 'card' as const, label: 'Card', icon: CreditCard },
            ]).map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPaymentMethod(m.key)}
                className={cn(
                  'h-10 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === m.key
                    ? 'bg-primary text-primary-foreground border-primary shadow-token-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-ring/40 hover:text-foreground'
                )}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={`${currencySymbol} ${subtotal.toFixed(2)}`} />
            {discountAmt > 0 && <Row label={`Discount (${discountPct}%)`} value={`-${currencySymbol} ${discountAmt.toFixed(2)}`} className="text-destructive" />}
            {taxAmt > 0 && <Row label={`Tax (${taxPct}%)`} value={`+${currencySymbol} ${taxAmt.toFixed(2)}`} />}
            <div className="flex justify-between pt-2 mt-1 border-t font-semibold text-lg">
              <span>Total</span><span className="tabular-nums">{currencySymbol} {total.toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={checkout}
            disabled={cart.length === 0 || submitting}
            className={cn(
              'w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all',
              'bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-token-md',
              'hover:shadow-token-lg hover:brightness-105 active:brightness-95',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-token-sm'
            )}
          >
            <CreditCard className="h-5 w-5" />
            {submitting ? 'Processing…' : `Charge ${currencySymbol} ${total.toFixed(2)}`}
          </button>
        </div>
      </aside>
      </div>

      {/* Post-sale invoice + receipt */}
      <Dialog open={!!justSold} onOpenChange={(open) => !open && setJustSold(null)}>
        {justSold && <InvoiceReceiptView invoice={justSold} />}
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
