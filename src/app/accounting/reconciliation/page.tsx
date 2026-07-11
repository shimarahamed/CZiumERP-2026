'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { Download } from 'lucide-react';
import { addMoney, formatNumber } from '@/lib/money';

type BankRow = { date: string; description: string; amount: number };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(f => f !== '')) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field); if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

function BankRecInner() {
  const { invoices, currencySymbol } = useAppContext();
  const [rows, setRows] = useState<BankRow[]>([]);
  const [error, setError] = useState('');

  const bookAmounts = useMemo(() => invoices.filter(i => i.status === 'paid').map(i => Math.round(i.amount * 100)), [invoices]);

  const matched = useMemo(() =>
    rows.map(r => ({ ...r, matched: bookAmounts.includes(Math.round(Math.abs(r.amount) * 100)) })),
    [rows, bookAmounts]
  );
  const matchedCount = matched.filter(m => m.matched).length;
  const statementTotal = addMoney(...rows.map(r => r.amount), 0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const parsed = parseCsv(await file.text());
      const headers = parsed[0].map(h => h.trim().toLowerCase());
      const di = headers.indexOf('date'), de = headers.findIndex(h => h.includes('desc')), ai = headers.indexOf('amount');
      if (di < 0 || ai < 0) { setError('CSV needs at least "date" and "amount" columns.'); return; }
      setRows(parsed.slice(1).map(r => ({ date: r[di], description: de >= 0 ? r[de] : '', amount: Number(r[ai]) || 0 })));
    } catch { setError('Could not read the file.'); }
    finally { e.target.value = ''; }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['date,description,amount\n2026-06-01,Customer payment,150.00\n2026-06-02,Supplier,-80.00'], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bank-statement-template.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Bank Reconciliation" />
      <Breadcrumb items={[{ label: 'Finance', href: '/accounting' }, { label: 'Bank Reconciliation' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Import bank statement</CardTitle><CardDescription>Upload a CSV; rows are matched against paid invoices by amount.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Template</Button>
              <div><Label htmlFor="bank-csv" className="sr-only">Bank CSV</Label>
                <input id="bank-csv" type="file" accept=".csv" onChange={handleFile} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground file:cursor-pointer" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {rows.length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="pill pill-info">Statement total: {currencySymbol}{formatNumber(statementTotal)}</span>
                <span className="pill pill-success">{matchedCount} matched</span>
                <span className="pill pill-warning">{rows.length - matchedCount} unmatched</span>
              </div>
            )}
          </CardContent>
        </Card>
        {matched.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Statement lines</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Match</TableHead></TableRow></TableHeader>
                <TableBody>{matched.map((m, i) => (
                  <TableRow key={`matched-${i}`}>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>{m.description}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{formatNumber(m.amount)}</TableCell>
                    <TableCell><Badge variant={m.matched ? 'default' : 'secondary'}>{m.matched ? 'Matched' : 'Review'}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function BankReconciliationPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <BankRecInner />;
}
