'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { interpretQuery } from '@/ai/flows/nl-query';
import { Sparkles, Loader2 } from 'lucide-react';
import { availableStock } from '@/lib/analytics';

const SUGGESTIONS = ['Show unpaid invoices', 'Which products are low in stock?', 'Top customers', 'Recent purchase orders'];

function AssistantInner() {
  const { invoices, products, customers, purchaseOrders, currencySymbol } = useAppContext();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; rows: string[] } | null>(null);

  const run = async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true); setAnswer(null);
    try {
      const intent = await interpretQuery({ question });
      let rows: string[] = [];
      if (intent.entity === 'invoices') {
        let list = invoices;
        if (intent.filter === 'unpaid' || intent.filter === 'overdue') list = invoices.filter(i => i.status !== 'paid');
        else if (intent.filter === 'paid') list = invoices.filter(i => i.status === 'paid');
        else if (intent.filter === 'recent') list = [...invoices].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 10);
        rows = list.slice(0, 25).map(i => `${i.id} · ${i.customerName || 'Walk-in'} · ${currencySymbol}${i.amount.toFixed(2)} · ${i.status}`);
      } else if (intent.entity === 'products') {
        let list = products;
        if (intent.filter === 'low-stock') list = products.filter(p => typeof p.reorderThreshold !== 'undefined' && availableStock(p) <= p.reorderThreshold);
        else if (intent.filter === 'out-of-stock') list = products.filter(p => availableStock(p) <= 0);
        rows = list.slice(0, 25).map(p => `${p.name} · stock ${p.stock}${p.reservedStock ? ` (−${p.reservedStock} reserved)` : ''}`);
      } else if (intent.entity === 'customers') {
        rows = customers.slice(0, 25).map(c => `${c.name}${c.company ? ` · ${c.company}` : ''} · ${c.loyaltyPoints ?? 0} pts`);
      } else if (intent.entity === 'purchaseOrders') {
        const list = intent.filter === 'recent' ? [...purchaseOrders].reverse() : purchaseOrders;
        rows = list.slice(0, 25).map(po => `${po.id} · ${po.vendorName || ''} · ${po.status}`);
      }
      setAnswer({ text: intent.answerTemplate.replace('{count}', String(rows.length)), rows });
    } catch {
      toast({ variant: 'destructive', title: 'Assistant unavailable', description: 'The AI service is not configured or reachable. Set GOOGLE_GENAI_API_KEY and run genkit.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Assistant" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Ask about your business</CardTitle>
            <CardDescription>Natural-language questions answered from your live data — nothing but the question leaves your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. show unpaid invoices" />
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}</Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => <Button key={s} variant="outline" size="sm" onClick={() => { setQ(s); run(s); }}>{s}</Button>)}
            </div>
            {answer && (
              <div className="rounded-md border p-4 space-y-2">
                <p className="font-medium">{answer.text}</p>
                {answer.rows.length === 0 ? <p className="text-sm text-muted-foreground">No matching records.</p> : (
                  <ul className="text-sm space-y-1">{answer.rows.map((r, i) => <li key={`row-${i}`} className="border-b py-1 last:border-0">{r}</li>)}</ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function AssistantPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'cashier', 'inventory-staff']);
  if (!isAllowed) return null;
  return <AssistantInner />;
}
