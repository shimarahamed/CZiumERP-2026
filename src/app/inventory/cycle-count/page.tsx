'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useDebounce } from '@/hooks/use-debounce';
import { getDefaultWarehouse, setStock, stockLevelId } from '@/lib/warehouse';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const CYCLE_COUNT_COLUMNS: ColumnDef[] = [
  { id: 'product', label: 'Product', locked: true },
  { id: 'bin', label: 'Bin' },
  { id: 'system', label: 'System' },
  { id: 'counted', label: 'Counted' },
  { id: 'variance', label: 'Variance' },
];

function CycleCountInner() {
  const { products, setProducts, addActivityLog, warehouses, stockLevels, setStockLevels } = useAppContext();
  const { toast } = useToast();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const debounced = useDebounce(search, 250);
  const columnVisibility = useColumnVisibility('cycle-count', CYCLE_COUNT_COLUMNS);
  const { isVisible } = columnVisibility;

  useEffect(() => {
    if (!warehouseId) {
      const def = getDefaultWarehouse(warehouses);
      if (def) setWarehouseId(def.id);
    }
  }, [warehouses, warehouseId]);

  // Lot/serial-tracked products are excluded from this generic count-and-apply flow:
  // setStock overwrites StockLevel.stock directly, which would silently desync it from
  // the sum of that product's individual Lot/SerialUnit rows. Reconciling those needs a
  // per-lot or per-serial count UI, not a single number — not yet built.
  const visible = products.filter(p => !p.deletedAt && (p.trackingMode ?? 'none') === 'none' && (!debounced || p.name.toLowerCase().includes(debounced.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(debounced.toLowerCase())));
  const trackedCount = products.filter(p => !p.deletedAt && p.trackingMode && p.trackingMode !== 'none').length;

  const systemStockFor = (productId: string): number => {
    const level = stockLevels.find(s => s.id === stockLevelId(productId, warehouseId));
    return level?.stock ?? 0;
  };

  const variance = (id: string, systemStock: number): number | null => {
    const c = counts[id];
    if (c === undefined || c === '') return null;
    return Number(c) - systemStock;
  };

  const applyAll = () => {
    const adjustments = Object.entries(counts).filter(([, v]) => v !== '');
    if (adjustments.length === 0) { toast({ title: 'Nothing to apply', description: 'Enter counted quantities first.' }); return; }
    if (!warehouseId) { toast({ variant: 'destructive', title: 'No warehouse selected' }); return; }

    // Reconcile the counted warehouse's StockLevel only — other warehouses' stock for the
    // same product is untouched. Product.stock (the denormalized total) is recomputed as
    // the sum across all warehouses after this warehouse's count is applied.
    adjustments.forEach(([productId, value]) => {
      setStock({ stockLevels, setStockLevels }, productId, warehouseId, Number(value));
    });
    setProducts(prev => prev.map(p => {
      const c = counts[p.id];
      if (c === undefined || c === '') return p;
      const otherWarehousesStock = stockLevels
        .filter(s => s.productId === p.id && s.warehouseId !== warehouseId)
        .reduce((sum, s) => sum + s.stock, 0);
      return { ...p, stock: otherWarehousesStock + Number(c) };
    }));
    const warehouseName = warehouses.find(w => w.id === warehouseId)?.name ?? warehouseId;
    addActivityLog('Cycle Count', `Adjusted stock for ${adjustments.length} products in ${warehouseName}.`);
    toast({ title: 'Stock adjusted', description: `${adjustments.length} products updated to counted quantities in ${warehouseName}.` });
    setCounts({});
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Cycle Counting" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Physical count</CardTitle>
            <CardDescription>
              Enter counted quantities for the selected warehouse; variances are flagged. Apply to reconcile that warehouse&apos;s stock.
              {trackedCount > 0 && ` ${trackedCount} lot/serial-tracked product(s) are not shown here — reconcile them from the product's lot/serial detail view.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cc-warehouse" className="text-xs text-muted-foreground">Warehouse</Label>
                <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setCounts({}); }}>
                  <SelectTrigger id="cc-warehouse" className="w-full sm:w-[220px]"><SelectValue placeholder="Select a warehouse" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => !w.deletedAt).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Default)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Button onClick={applyAll} disabled={!warehouseId}>Apply counts</Button>
              <ColumnVisibilityMenu visibility={columnVisibility} />
            </div>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead>
                {isVisible('bin') && <TableHead>Bin</TableHead>}
                {isVisible('system') && <TableHead className="text-right">System</TableHead>}
                {isVisible('counted') && <TableHead className="text-right w-32">Counted</TableHead>}
                {isVisible('variance') && <TableHead className="text-right">Variance</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {visible.slice(0, 100).map(p => {
                  const systemStock = systemStockFor(p.id);
                  const v = variance(p.id, systemStock);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      {isVisible('bin') && <TableCell className="text-muted-foreground text-sm">{p.binLocation || '—'}</TableCell>}
                      {isVisible('system') && <TableCell className="text-right">{systemStock}</TableCell>}
                      {isVisible('counted') && (
                        <TableCell className="text-right">
                          <Input type="number" className="h-8 text-right" value={counts[p.id] ?? ''} onChange={e => setCounts(c => ({ ...c, [p.id]: e.target.value }))} />
                        </TableCell>
                      )}
                      {isVisible('variance') && (
                        <TableCell className="text-right">
                          {v === null ? '—' : v === 0 ? <span className="pill pill-success">0</span> : <span className={v > 0 ? 'pill pill-info' : 'pill pill-danger'}>{v > 0 ? '+' : ''}{v}</span>}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CycleCountPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'inventory-staff', 'cashier']);
  if (!isAllowed) return null;
  return <CycleCountInner />;
}
