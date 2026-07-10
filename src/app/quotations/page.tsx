'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { getNextDocumentNumber } from '@/lib/document-number';
import type { Quotation, Invoice } from '@/types';
import { sendDepartmentEmail } from '@/lib/email';

const STATUS_VARIANT: Record<Quotation['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline', sent: 'secondary', accepted: 'default', rejected: 'destructive', converted: 'default',
};

function QuotationsInner() {
  const { invoices, setInvoices, customers, currency, currencySymbol, tenantId, addActivityLog, user, companyName, smtpConfigList, emailTemplates, setEmailLogs } = useAppContext();
  const [quotes, setQuotes] = useFirestoreCollection<Quotation>('quotations', [], tenantId);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const create = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast({ variant: 'destructive', title: 'Enter a valid amount' }); return; }
    const cust = customers.find(c => c.id === customerId);
    const q: Quotation = {
      id: `QT-${Date.now()}`,
      customerId: customerId || undefined,
      customerName: cust?.name,
      items: [],
      amount: amt,
      currency,
      status: 'draft',
      validUntil: validUntil || undefined,
      createdAt: new Date().toISOString(),
    };
    setQuotes(prev => [q, ...prev]);
    addActivityLog('Quotation Created', `Quote ${q.id} for ${cust?.name ?? 'customer'}.`);
    toast({ title: 'Quotation created' });
    setOpen(false); setAmount(''); setCustomerId(''); setValidUntil('');
  };

  const setStatus = (q: Quotation, status: Quotation['status']) => {
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status } : x));
    if (status === 'sent') {
      const cust = customers.find(c => c.id === q.customerId);
      if (cust?.email) {
        void sendDepartmentEmail(
          { smtpConfigList, emailTemplates, setEmailLogs, companyName },
          'Sales & Customers',
          'quotation-sent',
          cust.email,
          { customerName: cust.name, quotationId: q.id, companyName },
          user?.name ?? 'system'
        );
      }
    }
  };

  const convert = async (q: Quotation) => {
    const prefix = 'INV-';
    const fallback = () => invoices.reduce((m, i) => { const n = parseInt(i.id.replace(prefix, ''), 10); return isNaN(n) ? m : Math.max(m, n); }, 0) + 1;
    const id = tenantId ? await getNextDocumentNumber(tenantId, 'invoice', prefix, fallback) : `${prefix}${fallback()}`;
    const inv: Invoice = {
      id,
      customerId: q.customerId,
      customerName: q.customerName || 'Walk-in Customer',
      items: q.items,
      amount: q.amount,
      currency: q.currency,
      status: 'pending',
      date: new Date().toISOString(),
    } as Invoice;
    setInvoices(prev => [inv, ...prev]);
    setStatus(q, 'converted');
    addActivityLog('Quotation Converted', `Quote ${q.id} → Invoice ${id}.`);
    toast({ title: 'Converted to invoice', description: `Invoice ${id} created.` });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Quotations" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(v => !v)}>{open ? 'Cancel' : 'New Quotation'}</Button></div>
        {open && (
          <Card>
            <CardHeader><CardTitle className="text-base">New quotation</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Walk-in</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="qt-amt">Amount ({currencySymbol})</Label><Input id="qt-amt" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="qt-valid">Valid until</Label><Input id="qt-valid" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
              <div className="sm:col-span-3"><Button onClick={create}>Create quotation</Button></div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">All quotations</CardTitle><CardDescription>Send, accept, then convert accepted quotes to invoices.</CardDescription></CardHeader>
          <CardContent>
            {quotes.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No quotations yet.</p> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Valid</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {quotes.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">{q.id}</TableCell>
                        <TableCell>{q.customerName || 'Walk-in'}</TableCell>
                        <TableCell className="text-right">{currencySymbol} {q.amount.toFixed(2)}</TableCell>
                        <TableCell>{q.validUntil || '—'}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT[q.status]} className="capitalize">{q.status}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          {q.status === 'draft' && <Button size="sm" variant="outline" onClick={() => setStatus(q, 'sent')}>Send</Button>}
                          {q.status === 'sent' && <Button size="sm" variant="outline" onClick={() => setStatus(q, 'accepted')}>Accept</Button>}
                          {q.status === 'accepted' && <Button size="sm" onClick={() => convert(q)}>Convert</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function QuotationsPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'cashier']);
  if (!isAllowed) return null;
  return <QuotationsInner />;
}
