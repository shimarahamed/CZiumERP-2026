'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { Currency, ThemeSettings } from '@/types';
import { getCounterValue, setCounterStart } from '@/lib/document-number';
import ApprovalRulesSettings from '@/components/settings/ApprovalRulesSettings';
import Link from 'next/link';
import { Loader2, X, PlusCircle } from '@/components/icons';

const DEFAULT_PAYMENT_METHODS = ['Cash', 'Card'];

const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function FinancialRegionalSettings() {
    const {
        currency, setCurrency, currencySymbols,
        fiscalYearStartMonth, setFiscalYearStartMonth,
        themeSettings, saveThemeSettings,
        user, addActivityLog, tenantId,
    } = useAppContext();
    const { toast } = useToast();
    const canManage = user?.role === 'admin';

    const [localCurrency, setLocalCurrency] = useState(currency);
    const [localFiscalYearStart, setLocalFiscalYearStart] = useState(fiscalYearStartMonth);
    const [local, setLocal] = useState<ThemeSettings>(themeSettings);
    const [isSaving, setIsSaving] = useState(false);
    const [invoiceCounter, setInvoiceCounter] = useState<number | null>(null);
    const [counterStartInput, setCounterStartInput] = useState('');
    const [counterBusy, setCounterBusy] = useState(false);
    const [paymentMethodDraft, setPaymentMethodDraft] = useState('');

    useEffect(() => {
        setLocalCurrency(currency);
        setLocalFiscalYearStart(fiscalYearStartMonth);
        setLocal(themeSettings);
    }, [currency, fiscalYearStartMonth, themeSettings]);

    useEffect(() => {
        if (!tenantId) return;
        getCounterValue(tenantId, 'invoice').then(setInvoiceCounter).catch(() => setInvoiceCounter(0));
    }, [tenantId]);

    const handleSetCounter = async () => {
        if (!tenantId) return;
        const startAt = Number(counterStartInput);
        if (!Number.isFinite(startAt) || startAt < 1) {
            toast({ variant: 'destructive', title: 'Enter a number ≥ 1' });
            return;
        }
        setCounterBusy(true);
        try {
            await setCounterStart(tenantId, 'invoice', startAt);
            setInvoiceCounter(startAt - 1);
            setCounterStartInput('');
            addActivityLog('Invoice Counter Set', `Next invoice number set to start at ${startAt}.`);
            toast({ title: 'Counter updated', description: `The next invoice will be number ${startAt}.` });
        } catch {
            toast({ variant: 'destructive', title: 'Could not update counter' });
        } finally {
            setCounterBusy(false);
        }
    };

    const paymentMethods = local.paymentMethods ?? DEFAULT_PAYMENT_METHODS;

    const addPaymentMethod = () => {
        const trimmed = paymentMethodDraft.trim();
        if (!trimmed) return;
        if (paymentMethods.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
            toast({ variant: 'destructive', title: 'Already exists', description: `"${trimmed}" is already a payment method.` });
            return;
        }
        setLocal(prev => ({ ...prev, paymentMethods: [...(prev.paymentMethods ?? DEFAULT_PAYMENT_METHODS), trimmed] }));
        setPaymentMethodDraft('');
    };

    const removePaymentMethod = (method: string) => {
        setLocal(prev => ({ ...prev, paymentMethods: (prev.paymentMethods ?? DEFAULT_PAYMENT_METHODS).filter(m => m !== method) }));
    };

    const handleSave = async () => {
        if (!canManage) {
            toast({ variant: 'destructive', title: 'Permission Denied' });
            return;
        }
        setIsSaving(true);
        try {
            setFiscalYearStartMonth(localFiscalYearStart);
            setCurrency(localCurrency);
            await saveThemeSettings({
                currency: localCurrency,
                currencySymbol: local.currencySymbol?.trim() || currencySymbols[localCurrency],
                fiscalYearStartMonth: localFiscalYearStart,
                invoicePrefix: local.invoicePrefix,
                purchaseOrderPrefix: local.purchaseOrderPrefix,
                invoiceApprovalThreshold: local.invoiceApprovalThreshold ?? 0,
                approvalRules: local.approvalRules,
                defaultInvoiceStatus: local.defaultInvoiceStatus ?? 'paid',
                paymentMethods: local.paymentMethods && local.paymentMethods.length > 0 ? local.paymentMethods : DEFAULT_PAYMENT_METHODS,
            });
            addActivityLog('Settings Updated', 'Financial & Regional settings were updated.');
            toast({ title: 'Financial & Regional Saved', description: 'Your changes have been saved.' });
        } catch (err) {
            console.error('Failed to save Financial & Regional settings:', err);
            const description = err instanceof Error ? err.message : 'Could not save your changes. Please try again.';
            toast({ variant: 'destructive', title: 'Save Failed', description });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader><CardTitle>Financial & Regional Settings</CardTitle><CardDescription>Manage currency, fiscal year, and other financial settings.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="fiscal-year">Fiscal Year Start</Label>
                        <Select value={String(localFiscalYearStart)} onValueChange={(val) => setLocalFiscalYearStart(Number(val))}><SelectTrigger id="fiscal-year"><SelectValue /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={localCurrency} onValueChange={(value) => {
                            const nextCurrency = value as Currency;
                            setLocalCurrency(nextCurrency);
                            setLocal(prev => ({ ...prev, currencySymbol: currencySymbols[nextCurrency] }));
                        }}><SelectTrigger id="currency"><SelectValue placeholder="Select currency" /></SelectTrigger>
                            <SelectContent>{Object.keys(currencySymbols).map(key => <SelectItem key={key} value={key}>{key} ({currencySymbols[key as Currency]})</SelectItem>)}</SelectContent>
                        </Select>
                        <Input
                            id="custom-currency"
                            value={local.currencySymbol ?? currencySymbols[localCurrency]}
                            onChange={(e) => setLocal(prev => ({ ...prev, currencySymbol: e.target.value }))}
                            placeholder="Enter currency symbol or display text"
                            maxLength={12}
                            disabled={!canManage}
                        />
                        <p className="text-xs text-muted-foreground">Choose the currency, then edit how it appears throughout the app.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                        <Input id="invoice-prefix" value={local.invoicePrefix || ''} onChange={(e) => setLocal(prev => ({ ...prev, invoicePrefix: e.target.value }))} placeholder="e.g., INV-"/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="po-prefix">Purchase Order Prefix</Label>
                        <Input id="po-prefix" value={local.purchaseOrderPrefix || ''} onChange={(e) => setLocal(prev => ({ ...prev, purchaseOrderPrefix: e.target.value }))} placeholder="e.g., PO-"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="default-invoice-status">Default Invoice Status</Label>
                        <p className="text-xs text-muted-foreground">Pre-selected when creating a new invoice.</p>
                        <Select value={local.defaultInvoiceStatus ?? 'paid'} onValueChange={(v) => setLocal(prev => ({ ...prev, defaultInvoiceStatus: v as 'paid' | 'pending' }))}>
                            <SelectTrigger id="default-invoice-status" className="max-w-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invoice-approval-threshold">Invoice Approval Threshold (0 = disabled)</Label>
                        <p className="text-xs text-muted-foreground">Legacy single-approver threshold. A multi-step chain for Invoices below supersedes this.</p>
                        <Input id="invoice-approval-threshold" type="number" min={0} step={0.01} value={local.invoiceApprovalThreshold ?? 0} onChange={(e) => setLocal(prev => ({ ...prev, invoiceApprovalThreshold: Number(e.target.value) }))} placeholder="e.g., 1000" className="max-w-xs" />
                    </div>
                </div>
                <div className="space-y-2 rounded-lg border p-4">
                    <Label>Payment Methods</Label>
                    <p className="text-xs text-muted-foreground">Offered in POS and Invoices when recording how a sale was tendered.</p>
                    <div className="flex flex-wrap gap-2">
                        {paymentMethods.map(method => (
                            <span key={method} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 pl-3 pr-1.5 py-1 text-sm">
                                {method}
                                {canManage && (
                                    <button
                                        type="button"
                                        onClick={() => removePaymentMethod(method)}
                                        className="rounded-full p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        aria-label={`Remove ${method}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </span>
                        ))}
                        {paymentMethods.length === 0 && <span className="text-xs text-muted-foreground">No payment methods — add one below.</span>}
                    </div>
                    {canManage && (
                        <div className="flex items-center gap-2 pt-1">
                            <Input
                                value={paymentMethodDraft}
                                onChange={(e) => setPaymentMethodDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPaymentMethod(); } }}
                                placeholder="e.g. Bank Transfer"
                                className="max-w-xs"
                                maxLength={40}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={addPaymentMethod}>
                                <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add
                            </Button>
                        </div>
                    )}
                </div>
                <div className="space-y-2 rounded-lg border p-4">
                    <Label htmlFor="invoice-counter-start">Invoice Numbering</Label>
                    <p className="text-xs text-muted-foreground">
                        {invoiceCounter === null ? 'Loading current counter…' : `Last issued number: ${invoiceCounter}. The next invoice will be ${invoiceCounter + 1}.`}
                    </p>
                    <div className="flex items-end gap-2 flex-wrap">
                        <div className="space-y-1">
                            <Label htmlFor="invoice-counter-start" className="text-xs text-muted-foreground">Start next invoice at</Label>
                            <Input id="invoice-counter-start" type="number" min={1} step={1} value={counterStartInput} onChange={(e) => setCounterStartInput(e.target.value)} placeholder="e.g., 1001" className="w-40" />
                        </div>
                        <Button type="button" variant="outline" onClick={handleSetCounter} disabled={counterBusy}>
                            {counterBusy ? 'Saving…' : 'Set / Reset counter'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Set to 1 to restart numbering. Existing invoices keep their numbers.</p>
                </div>
                <div className="space-y-2">
                    <div>
                        <Label className="text-base">Approval Chains</Label>
                        <p className="text-xs text-muted-foreground">Require one or more approvers in sequence before Purchase Orders, Invoices, or Leave Requests proceed. Leave an entity unconfigured to keep its default single-approver behavior.</p>
                    </div>
                    <ApprovalRulesSettings
                        value={local.approvalRules}
                        onChange={(rules) => setLocal(prev => ({ ...prev, approvalRules: rules }))}
                    />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Tax Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>Define tax rates for your business based on your region.</CardDescription>
                        <Button asChild variant="outline" className="mt-4">
                            <Link href="/accounting/tax">Manage Tax Rates</Link>
                        </Button>
                    </CardContent>
                </Card>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? 'Saving…' : 'Save Financial Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
