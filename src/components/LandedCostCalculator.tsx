'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { LandedCostEntry, Currency } from '@/types';
import { formatNumber } from '@/lib/money';

const schema = z.object({
  duties: z.coerce.number().min(0),
  freight: z.coerce.number().min(0),
  insurance: z.coerce.number().min(0),
  other: z.coerce.number().min(0),
  currency: z.enum(['USD', 'EUR', 'JPY', 'GBP', 'AED', 'LKR'] as const),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  purchaseOrderId: string;
  purchaseOrderTotal: number;
  onSave?: (entry: LandedCostEntry) => void;
}

export function LandedCostCalculator({ purchaseOrderId, purchaseOrderTotal, onSave }: Props) {
  const { currency: defaultCurrency, currencySymbols, addActivityLog } = useAppContext();
  const { toast } = useToast();
  const [saved, setSaved] = useState<LandedCostEntry | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { duties: 0, freight: 0, insurance: 0, other: 0, currency: defaultCurrency, notes: '' },
  });

  const watched = form.watch();
  const total = (watched.duties ?? 0) + (watched.freight ?? 0) + (watched.insurance ?? 0) + (watched.other ?? 0);
  const landedTotal = purchaseOrderTotal + total;
  const sym = currencySymbols[watched.currency as Currency] ?? watched.currency;

  const onSubmit = (data: FormData) => {
    const entry: LandedCostEntry = {
      id: `lc-${Date.now()}`,
      purchaseOrderId,
      duties: data.duties,
      freight: data.freight,
      insurance: data.insurance,
      other: data.other,
      total,
      currency: data.currency as Currency,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    setSaved(entry);
    addActivityLog('Landed Cost Recorded', `Landed cost ${sym} ${formatNumber(total)} added to PO ${purchaseOrderId}.`);
    toast({ title: 'Landed Cost Saved', description: `Total landed cost: ${sym} ${formatNumber(landedTotal)}` });
    onSave?.(entry);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Landed Cost Calculator</CardTitle>
        <CardDescription>Add duties, freight, insurance to PO cost basis.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {(['USD','EUR','JPY','GBP','AED','LKR'] as Currency[]).map(c => (
                      <SelectItem key={c} value={c}>{c} — {currencySymbols[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-2">
              {(['duties', 'freight', 'insurance', 'other'] as const).map(fieldName => (
                <FormField key={fieldName} control={form.control} name={fieldName} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">{fieldName}</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PO Total</span>
                <span>{sym} {formatNumber(purchaseOrderTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Additional Costs</span>
                <span>{sym} {formatNumber(total)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Landed Total</span>
                <span>{sym} {formatNumber(landedTotal)}</span>
              </div>
            </div>

            {saved && (
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                Saved — {sym} {formatNumber(saved.total)} additional costs recorded
              </Badge>
            )}

            <Button type="submit" size="sm" className="w-full">Save Landed Cost</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
