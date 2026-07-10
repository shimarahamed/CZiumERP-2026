
'use client';
import { useRequireRole } from '@/hooks/use-require-role';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAppContext } from "@/context/AppContext";
import { format, parseISO } from 'date-fns';
import type { Currency, LedgerEntry } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { FXRatesWidget } from '@/components/FXRatesWidget';
import { CSVExportButton } from '@/components/CSVExportButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFXRates } from '@/hooks/use-fx-rates';

type SortKey = 'date' | 'account' | 'debit' | 'credit';
const CURRENCIES: Currency[] = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'];

function GeneralLedgerPageInner() {
    const { ledgerEntries, stores, currency, currencySymbol, currencySymbols, isDataLoaded } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    // Reporting currency for consolidated display only — never mutates the underlying
    // debit/credit values in Firestore, which stay in each entry's posting (store
    // functional) currency. Defaults to the tenant's own display currency.
    const [reportingCurrency, setReportingCurrency] = useState<Currency>(currency);
    const { convert } = useFXRates(reportingCurrency);
    const reportSymbol = reportingCurrency === currency ? currencySymbol : currencySymbols[reportingCurrency];

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const processedEntries = useMemo(() => {
        if (!Array.isArray(ledgerEntries)) return [];

        // An entry's posting currency is whatever debit/credit are already
        // expressed in — the store's functional currency if set, else the
        // tenant's own display currency (matches the resolution
        // postInvoiceWithLedger.ts uses server-side).
        const postingCurrencyOf = (entry: LedgerEntry): Currency =>
            stores.find(s => s.id === entry.storeId)?.functionalCurrency ?? currency;

        let filtered = ledgerEntries;
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            filtered = ledgerEntries.filter(entry =>
                entry.account.toLowerCase().includes(lowercasedFilter) ||
                entry.description.toLowerCase().includes(lowercasedFilter)
            );
        }

        let balance = 0;
        // Sort entries by date to calculate running balance correctly
        return filtered
            .sort((a, b) => {
                const aValue = a[sortKey];
                const bValue = b[sortKey];

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;

                // Secondary sort by original date to maintain chronological balance
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            })
            .map(entry => {
                // Re-convert for display only when this entry's posting currency
                // differs from the selected reporting currency — the stored
                // debit/credit are untouched. Single-currency tenants (the common
                // case) always see postingCurrencyOf === reportingCurrency, so this
                // is a no-op and displayDebit/displayCredit equal debit/credit.
                const postingCcy = postingCurrencyOf(entry);
                const displayDebit = convert(entry.debit, postingCcy, reportingCurrency);
                const displayCredit = convert(entry.credit, postingCcy, reportingCurrency);
                balance += displayDebit - displayCredit;
                return { ...entry, displayDebit, displayCredit, balance };
            });
    }, [ledgerEntries, searchTerm, sortKey, sortDirection, stores, currency, reportingCurrency, convert]);

    return (
        <div className="flex flex-col h-full">
            <Header title="General Ledger" />
            <Breadcrumb items={[{ label: 'Finance', href: '/accounting' }, { label: 'General Ledger' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid lg:grid-cols-4 gap-6 mb-6">
                    <div className="lg:col-span-3">
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <Input
                                    placeholder="Search by account or description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="max-w-full md:max-w-sm bg-secondary"
                                />
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="gl-reporting-currency" className="text-xs text-muted-foreground whitespace-nowrap">Reporting currency</Label>
                                    <Select value={reportingCurrency} onValueChange={(v) => setReportingCurrency(v as Currency)}>
                                        <SelectTrigger id="gl-reporting-currency" className="w-[90px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <CSVExportButton
                                data={processedEntries as unknown as Record<string, unknown>[]}
                                filename="general-ledger"
                                columns={[
                                    { key: 'date' as const, label: 'Date' },
                                    { key: 'account' as const, label: 'Account' },
                                    { key: 'description' as const, label: 'Description' },
                                    { key: 'displayDebit' as const, label: `Debit (${reportingCurrency})` },
                                    { key: 'displayCredit' as const, label: `Credit (${reportingCurrency})` },
                                    { key: 'balance' as const, label: `Balance (${reportingCurrency})` },
                                ]}
                            />
                        </div>
                    </div>
                    <div><FXRatesWidget /></div>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead><Button variant="ghost" onClick={() => handleSort('account')}>Account <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('debit')}>Debit <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('credit')}>Credit <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {processedEntries.length > 0 ? (
                                    processedEntries.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell>{format(parseISO(entry.date), 'yyyy-MM-dd')}</TableCell>
                                            <TableCell>{entry.account}</TableCell>
                                            <TableCell>{entry.description}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {entry.displayDebit > 0 ? `${reportSymbol} ${entry.displayDebit.toFixed(2)}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {entry.displayCredit > 0 ? `${reportSymbol} ${entry.displayCredit.toFixed(2)}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{reportSymbol} {entry.balance.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">No ledger entries found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

    

    

    

    


// Permission guard lives in a wrapper so all hooks inside GeneralLedgerPageInner
// run unconditionally (React rules-of-hooks).
export default function GeneralLedgerPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <GeneralLedgerPageInner />;
}
