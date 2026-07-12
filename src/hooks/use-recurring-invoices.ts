'use client';

import { useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { format, parseISO, addWeeks, addMonths, addQuarters, addYears, isPast } from 'date-fns';
import type { Invoice, RecurringFrequency } from '@/types';

function nextDueDate(from: string, frequency: RecurringFrequency): string {
  const d = parseISO(from);
  switch (frequency) {
    case 'weekly':   return format(addWeeks(d, 1), 'yyyy-MM-dd');
    case 'monthly':  return format(addMonths(d, 1), 'yyyy-MM-dd');
    case 'quarterly':return format(addQuarters(d, 1), 'yyyy-MM-dd');
    case 'yearly':   return format(addYears(d, 1), 'yyyy-MM-dd');
  }
}

/**
 * On mount, checks all active recurring invoices whose nextDueDate has passed
 * and generates pending invoices for each missed cycle.
 */
export function useRecurringInvoices() {
  const {
    recurringInvoices, setRecurringInvoices,
    invoices, setInvoices,
    addActivityLog, addNotification,
    user, themeSettings,
  } = useAppContext();

  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    if (!user || recurringInvoices.length === 0) return;

    processedRef.current = true;
    const prefix = themeSettings.invoicePrefix ?? 'INV-';
    let invoiceIndex = invoices.length + 1;
    const newInvoices: Invoice[] = [];
    const updatedRecurring = recurringInvoices.map(ri => {
      if (ri.status !== 'active') return ri;

      let nextDue = ri.nextDueDate;
      while (isPast(parseISO(nextDue))) {
        const inv: Invoice = {
          id: `${prefix}R-${String(invoiceIndex++).padStart(3, '0')}`,
          storeId: ri.storeId,
          customerId: ri.customerId,
          customerName: ri.customerName,
          items: ri.items,
          amount: ri.amount,
          taxRate: ri.taxRate,
          discount: ri.discount,
          discountType: ri.discountType,
          currency: ri.currency,
          status: 'pending',
          date: nextDue,
          dueDate: nextDue,
        };
        newInvoices.push(inv);
        nextDue = nextDueDate(nextDue, ri.frequency);
      }
      return { ...ri, nextDueDate: nextDue };
    });

    if (newInvoices.length > 0) {
      setInvoices(prev => [...newInvoices, ...prev]);
      setRecurringInvoices(updatedRecurring);
      addActivityLog('Recurring Invoices', `${newInvoices.length} recurring invoice(s) generated.`);
      addNotification({
        title: 'Recurring Invoices Generated',
        description: `${newInvoices.length} pending invoice(s) created from recurring schedules.`,
        href: '/invoices',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringInvoices, user]);
}
