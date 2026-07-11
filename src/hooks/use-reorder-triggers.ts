'use client';

import { useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { format } from 'date-fns/format';
import { addDays } from 'date-fns/addDays';

/**
 * Watches inventory levels and auto-creates draft POs when stock ≤ reorderThreshold.
 * Only fires for admin/manager roles. Dedup is against `purchaseOrders` itself (any
 * open PO — pending/pending-approval/ordered — already covering that product+vendor),
 * not an in-memory ref, since the ref resets on every remount (tab, refresh, nav) and
 * previously let the same low-stock item spawn a fresh draft PO each time.
 */
export function useReorderTriggers() {
  const {
    products, vendors, purchaseOrders, setPurchaseOrders,
    addActivityLog, addNotification, user, themeSettings, currentStore,
  } = useAppContext();

  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'manager') return;
    if (products.length === 0) return;

    const openStatuses = new Set(['pending', 'pending-approval', 'ordered']);
    const productsWithOpenPO = new Set(
      purchaseOrders
        .filter(po => openStatuses.has(po.status))
        .flatMap(po => po.items.map(item => item.productId))
    );

    const lowStock = products.filter(p =>
      typeof p.reorderThreshold === 'number' &&
      p.stock <= p.reorderThreshold &&
      p.vendorId &&
      !triggeredRef.current.has(p.id) &&
      !productsWithOpenPO.has(p.id)
    );

    if (lowStock.length === 0) return;

    const poPrefix = themeSettings.purchaseOrderPrefix ?? 'PO-';
    let nextIndex = purchaseOrders.length + 1;

    const newPOs = lowStock.map(product => {
      triggeredRef.current.add(product.id);
      const vendor = vendors.find(v => v.id === product.vendorId);
      const reorderQty = Math.max(product.reorderThreshold! * 2, 10);
      const orderDate = format(new Date(), 'yyyy-MM-dd');
      const expectedDeliveryDate = vendor?.leadTimeDays
        ? format(addDays(new Date(), vendor.leadTimeDays), 'yyyy-MM-dd')
        : undefined;

      return {
        id: `${poPrefix}AUTO-${String(nextIndex++).padStart(3, '0')}`,
        storeId: currentStore?.id,
        vendorId: product.vendorId!,
        vendorName: vendor?.name ?? 'Unknown Vendor',
        status: 'pending-approval' as const,
        orderDate,
        expectedDeliveryDate,
        items: [{ productId: product.id, productName: product.name, quantity: reorderQty, cost: product.cost }],
        totalCost: reorderQty * product.cost,
      };
    });

    if (newPOs.length === 0) return;

    setPurchaseOrders(prev => [...newPOs, ...prev]);
    newPOs.forEach(po => {
      addActivityLog('Auto Reorder', `Draft PO ${po.id} created for low-stock item.`);
      addNotification({
        title: 'Auto Reorder Triggered',
        description: `Draft PO ${po.id} created for ${po.items[0].productName} (stock below threshold). Pending approval.`,
        href: '/purchase-orders',
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);
}
