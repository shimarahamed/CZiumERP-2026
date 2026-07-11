'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns/format';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { buildIntercompanyLedgerEntries } from '@/lib/posting';
import type { IntercompanyTransaction } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { formatNumber } from '@/lib/money';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const INTERCOMPANY_HISTORY_COLUMNS: ColumnDef[] = [
  { id: 'date', label: 'Date', locked: true },
  { id: 'from', label: 'From' },
  { id: 'to', label: 'To' },
  { id: 'amount', label: 'Amount' },
  { id: 'description', label: 'Description' },
];

function IntercompanyPageInner() {
  const { stores, currencySymbol, currency, user, intercompanyTransactions, setIntercompanyTransactions, setLedgerEntries, ledgerEntries, addActivityLog } = useAppContext();
  const { toast } = useToast();
  const columnVisibility = useColumnVisibility('intercompanyHistory', INTERCOMPANY_HISTORY_COLUMNS);
  const { isVisible } = columnVisibility;

  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const storeName = (id: string) => stores.find(s => s.id === id)?.name ?? id;

  const post = () => {
    const amt = Number(amount);
    if (!fromStoreId || !toStoreId || fromStoreId === toStoreId || !amt || amt <= 0 || !description.trim() || !user) {
      toast({ variant: 'destructive', title: 'Check the form', description: 'Two different entities, a positive amount, and a description are required.' });
      return;
    }
    const id = `ic-${Date.now()}`;
    const txn: IntercompanyTransaction = {
      id,
      date: format(new Date(), 'yyyy-MM-dd'),
      fromStoreId,
      toStoreId,
      amount: amt,
      description: description.trim(),
      createdBy: user.email,
      createdAt: new Date().toISOString(),
      ledgerEntryIds: [],
    };
    const entries = buildIntercompanyLedgerEntries(txn);
    txn.ledgerEntryIds = entries.map(e => e.id);
    setLedgerEntries(prev => {
      const entryIds = new Set(entries.map(e => e.id));
      return [...entries, ...prev.filter(e => !entryIds.has(e.id))];
    });
    setIntercompanyTransactions(prev => [txn, ...prev]);
    addActivityLog('Intercompany Transaction Posted', `${storeName(fromStoreId)} → ${storeName(toStoreId)}: ${currencySymbol} ${formatNumber(amt)} — ${description.trim()}`);
    toast({ title: 'Posted', description: `Due from/Due to entries posted on both entities' books.` });
    setFromStoreId(''); setToStoreId(''); setAmount(''); setDescription('');
  };

  // Consolidated view: sum every ledger entry across all stores, then eliminate
  // (exclude) the intercompany Due to/Due from pairs so the group total isn't
  // inflated by activity between entities under the same tenant.
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const entry of ledgerEntries) {
    if (entry.intercompanyTransactionId) continue; // eliminated
    const cur = byAccount.get(entry.account) ?? { debit: 0, credit: 0 };
    cur.debit += entry.debit;
    cur.credit += entry.credit;
    byAccount.set(entry.account, cur);
  }
  const eliminatedCount = ledgerEntries.filter(e => e.intercompanyTransactionId).length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Intercompany" />
      <Breadcrumb items={[{ label: 'Finance', href: '/accounting' }, { label: 'Intercompany' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Post a transaction</CardTitle>
              <CardDescription>Between two entities (stores) under this tenant — posts Due from/Due to entries on each side.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>From (owed the amount)</Label>
                <Select value={fromStoreId} onValueChange={setFromStoreId}>
                  <SelectTrigger><SelectValue placeholder="Select an entity" /></SelectTrigger>
                  <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To (owes the amount)</Label>
                <Select value={toStoreId} onValueChange={setToStoreId}>
                  <SelectTrigger><SelectValue placeholder="Select an entity" /></SelectTrigger>
                  <SelectContent>{stores.filter(s => s.id !== fromStoreId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ic-amount">Amount ({currencySymbol})</Label>
                <Input id="ic-amount" type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ic-desc">Description</Label>
                <Textarea id="ic-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Shared marketing cost allocation for March" rows={2} />
              </div>
              <Button onClick={post} className="w-full">Post transaction</Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Consolidated view ({currency})</CardTitle>
              <CardDescription>
                All entities combined, with {eliminatedCount} intercompany entr{eliminatedCount === 1 ? 'y' : 'ies'} eliminated from the total.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {byAccount.size === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No ledger activity yet.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[...byAccount.entries()].map(([account, sums]) => (
                      <TableRow key={account}>
                        <TableCell>{account}</TableCell>
                        <TableCell className="text-right">{sums.debit > 0 ? `${currencySymbol} ${formatNumber(sums.debit)}` : '-'}</TableCell>
                        <TableCell className="text-right">{sums.credit > 0 ? `${currencySymbol} ${formatNumber(sums.credit)}` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Intercompany History</CardTitle>
              <ColumnVisibilityMenu visibility={columnVisibility} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {intercompanyTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No intercompany transactions posted yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead>{isVisible('from') && <TableHead>From</TableHead>}{isVisible('to') && <TableHead>To</TableHead>}{isVisible('amount') && <TableHead className="text-right">Amount</TableHead>}{isVisible('description') && <TableHead>Description</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {intercompanyTransactions.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell>{format(new Date(txn.date), 'PPP')}</TableCell>
                      {isVisible('from') && <TableCell><Badge variant="outline">{storeName(txn.fromStoreId)}</Badge></TableCell>}
                      {isVisible('to') && <TableCell><Badge variant="outline">{storeName(txn.toStoreId)}</Badge></TableCell>}
                      {isVisible('amount') && <TableCell className="text-right font-medium">{currencySymbol} {formatNumber(txn.amount)}</TableCell>}
                      {isVisible('description') && <TableCell className="text-muted-foreground text-sm">{txn.description}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function IntercompanyPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <IntercompanyPageInner />;
}
