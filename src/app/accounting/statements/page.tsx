'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { buildProfitAndLoss, buildBalanceSheet, buildCashFlow, type AccountLine } from '@/lib/financial-statements';
import { Printer, Sparkles, Loader2 } from 'lucide-react';
import { generateExecSummary, type ExecSummaryOutput } from '@/ai/flows/exec-summary';
import { productProfitability, churnRisk } from '@/lib/analytics';
import { useToast } from '@/hooks/use-toast';

type Preset = 'this-month' | 'this-quarter' | 'this-year' | 'custom';

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === 'this-month') return { from: iso(new Date(y, now.getMonth(), 1)), to: iso(now) };
  if (p === 'this-quarter') {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: iso(new Date(y, q, 1)), to: iso(now) };
  }
  return { from: `${y}-01-01`, to: iso(now) };
}

const Lines = ({ lines, symbol, negative }: { lines: AccountLine[]; symbol: string; negative?: boolean }) => (
  <>
    {lines.length === 0 && <p className="text-sm text-muted-foreground py-2">No activity in this period.</p>}
    {lines.map(l => (
      <div key={l.account} className="flex justify-between py-1 text-sm">
        <span>{l.account}</span>
        <span className={negative ? 'text-destructive' : ''}>{symbol} {l.amount.toFixed(2)}</span>
      </div>
    ))}
  </>
);

const TotalRow = ({ label, value, symbol, strong }: { label: string; value: number; symbol: string; strong?: boolean }) => (
  <div className={`flex justify-between py-1 ${strong ? 'font-bold text-base' : 'font-semibold text-sm'}`}>
    <span>{label}</span>
    <span>{symbol} {value.toFixed(2)}</span>
  </div>
);

function StatementsInner() {
  const { ledgerEntries, invoices, customers, currency, currencySymbol, companyName, isDataLoaded } = useAppContext();
  const { toast } = useToast();
  const [aiSummary, setAiSummary] = useState<ExecSummaryOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [preset, setPreset] = useState<Preset>('this-year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
    return presetRange(preset === 'custom' ? 'this-year' : preset);
  }, [preset, customFrom, customTo]);

  const pnl = useMemo(() => buildProfitAndLoss(ledgerEntries, from, to), [ledgerEntries, from, to]);
  const bs = useMemo(() => buildBalanceSheet(ledgerEntries, to), [ledgerEntries, to]);
  const cf = useMemo(() => buildCashFlow(ledgerEntries, from, to), [ledgerEntries, from, to]);

  if (!isDataLoaded) return null;

  const handlePrint = () => window.print();

  const handleAiSummary = async () => {
    setAiLoading(true); setAiSummary(null);
    try {
      const top = productProfitability(invoices).slice(0, 5).map(p => ({ name: p.productName, profit: p.profit }));
      const churn = churnRisk(invoices, customers, 90).length;
      const out = await generateExecSummary({
        period: periodLabel, totalIncome: pnl.totalIncome, totalExpenses: pnl.totalExpenses,
        netProfit: pnl.netProfit, topProducts: top, churnCount: churn, currency,
      });
      setAiSummary(out);
    } catch {
      toast({ variant: 'destructive', title: 'AI summary unavailable', description: 'Set GOOGLE_GENAI_API_KEY to enable this.' });
    } finally { setAiLoading(false); }
  };
  const periodLabel = `${from} → ${to}`;

  return (
    <div className="flex flex-col h-full">
      <Header title="Financial Statements" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3 non-printable">
          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="this-quarter">This quarter</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <>
              <div className="space-y-2"><Label htmlFor="fs-from">From</Label><Input id="fs-from" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="fs-to">To</Label><Input id="fs-to" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></div>
            </>
          )}
          <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
          <Button onClick={handleAiSummary} disabled={aiLoading}>{aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}AI Summary</Button>
        </div>
        {aiSummary && (
          <Card className="brand-gradient border-primary/30">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{aiSummary.headline}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{aiSummary.narrative}</p>
              <ul className="text-sm list-disc pl-5 space-y-1">{aiSummary.actions.map((a, i) => <li key={`action-${i}`}>{a}</li>)}</ul>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="pnl">
          <TabsList className="non-printable">
            <TabsTrigger value="pnl">Profit &amp; Loss</TabsTrigger>
            <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cf">Cash Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="pnl">
            <Card className="printable-area max-w-2xl">
              <CardHeader>
                <CardTitle>{companyName} — Profit &amp; Loss</CardTitle>
                <CardDescription>{periodLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Income</p>
                <Lines lines={pnl.income} symbol={currencySymbol} />
                <TotalRow label="Total Income" value={pnl.totalIncome} symbol={currencySymbol} />
                <Separator className="my-3" />
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Expenses</p>
                <Lines lines={pnl.expenses} symbol={currencySymbol} negative />
                <TotalRow label="Total Expenses" value={pnl.totalExpenses} symbol={currencySymbol} />
                <Separator className="my-3" />
                <TotalRow label={pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'} value={pnl.netProfit} symbol={currencySymbol} strong />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bs">
            <Card className="printable-area max-w-2xl">
              <CardHeader>
                <CardTitle>{companyName} — Balance Sheet</CardTitle>
                <CardDescription>As of {to}{!bs.balanced && ' · ⚠ ledger does not balance — review manual entries'}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Assets</p>
                <Lines lines={bs.assets} symbol={currencySymbol} />
                <TotalRow label="Total Assets" value={bs.totalAssets} symbol={currencySymbol} strong />
                <Separator className="my-3" />
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Liabilities</p>
                <Lines lines={bs.liabilities} symbol={currencySymbol} />
                <TotalRow label="Total Liabilities" value={bs.totalLiabilities} symbol={currencySymbol} />
                <Separator className="my-3" />
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Equity</p>
                <Lines lines={bs.equity} symbol={currencySymbol} />
                <div className="flex justify-between py-1 text-sm"><span>Retained Earnings (period)</span><span>{currencySymbol} {bs.retainedEarnings.toFixed(2)}</span></div>
                <TotalRow label="Total Equity" value={bs.totalEquity} symbol={currencySymbol} />
                <Separator className="my-3" />
                <TotalRow label="Liabilities + Equity" value={bs.totalLiabilities + bs.totalEquity} symbol={currencySymbol} strong />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cf">
            <Card className="printable-area max-w-2xl">
              <CardHeader>
                <CardTitle>{companyName} — Cash Flow (direct method)</CardTitle>
                <CardDescription>{periodLabel} · movements on cash &amp; bank accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Cash In</p>
                <Lines lines={cf.inflows} symbol={currencySymbol} />
                <TotalRow label="Total Inflows" value={cf.totalIn} symbol={currencySymbol} />
                <Separator className="my-3" />
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Cash Out</p>
                <Lines lines={cf.outflows} symbol={currencySymbol} negative />
                <TotalRow label="Total Outflows" value={cf.totalOut} symbol={currencySymbol} />
                <Separator className="my-3" />
                <TotalRow label="Net Change in Cash" value={cf.netChange} symbol={currencySymbol} strong />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Guard wrapper keeps hook order stable (React rules-of-hooks).
export default function FinancialStatementsPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <StatementsInner />;
}
