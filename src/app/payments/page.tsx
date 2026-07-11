
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import { PageSkeleton } from '@/components/PageSkeleton';
import { CreditCard, Smartphone, Landmark } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import { buildInvoiceLedgerEntries } from '@/lib/posting';
import type { Invoice } from "@/types";
import { sendDepartmentEmail } from '@/lib/email';
import { formatNumber } from '@/lib/money';

export default function PaymentsPage() {
  usePageTitle('Payments');
  const { invoices, setInvoices, setLedgerEntries, user, customersMap, addActivityLog, currentStore, currencySymbol, storesMap, isDataLoaded, companyName, smtpConfigList, emailTemplates, setEmailLogs } = useAppContext();
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState<number | string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const storeUnpaidInvoices = invoices.filter(inv => {
        const isUnpaid = inv.status === 'pending' || inv.status === 'overdue';
        if (currentStore?.id === 'all') {
            return isUnpaid;
        }
        return inv.storeId === currentStore?.id && isUnpaid;
    });
    setUnpaidInvoices(storeUnpaidInvoices);
  }, [invoices, currentStore]);

  const handleInvoiceChange = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = unpaidInvoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setAmount(invoice.amount.toFixed(2));
      if (invoice.customerId) {
        setSelectedCustomerId(invoice.customerId);
      } else {
        setSelectedCustomerId('none');
      }
    } else {
      setAmount('');
      setSelectedCustomerId('none');
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = parseFloat(String(amount));
    if (!selectedInvoiceId || !amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Please select an invoice and enter a valid positive amount.",
        });
        return;
    }
    const selectedInvoice = unpaidInvoices.find(inv => inv.id === selectedInvoiceId);
    if (selectedInvoice && parsedAmount > selectedInvoice.amount) {
        toast({
            variant: "destructive",
            title: "Amount Exceeds Invoice Total",
            description: `Payment (${currencySymbol} ${formatNumber(parsedAmount)}) exceeds invoice total (${currencySymbol} ${formatNumber(selectedInvoice.amount)}).`,
        });
        return;
    }
    
    addActivityLog('Payment Processed', `Processed payment of ${currencySymbol} ${amount} for invoice ${selectedInvoiceId}.`);

    setInvoices(currentInvoices =>
        currentInvoices.map(inv =>
            inv.id === selectedInvoiceId ? { ...inv, status: 'paid' } : inv
        )
    );

    // Post GL entries for the now-paid invoice (managers/admins only —
    // rules deny ledgerEntries creation for other roles).
    if (selectedInvoice && (user?.role === 'admin' || user?.role === 'manager')) {
        const entries = buildInvoiceLedgerEntries({ ...selectedInvoice, status: 'paid' });
        setLedgerEntries(prev => {
            const entryIds = new Set(entries.map(e => e.id));
            return [...entries, ...prev.filter(e => !entryIds.has(e.id))];
        });
    }

    toast({
        title: "Payment Processed",
        description: `Payment of ${currencySymbol} ${amount} for invoice ${selectedInvoiceId} has been successfully processed.`,
    });

    if (selectedInvoice?.customerId) {
        const customer = customersMap.get(selectedInvoice.customerId);
        if (customer?.email) {
            void sendDepartmentEmail(
                { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                'Sales & Customers',
                'payment-received',
                customer.email,
                { customerName: customer.name, invoiceId: selectedInvoiceId, amount: `${currencySymbol} ${formatNumber(parsedAmount)}`, companyName },
                user?.name ?? 'system'
            );
        }
    }

    // Clear the form
    setSelectedInvoiceId('');
    setAmount('');
    setSelectedCustomerId('none');
  };


  if (!isDataLoaded) return <PageSkeleton hasFilters={false} rows={5} cols={3} />;

  return (
    <div className="flex flex-col h-full">
      <Header title="Process Payment" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>New Transaction</CardTitle>
            <CardDescription>Select an invoice from {currentStore?.id === 'all' ? 'any store' : currentStore?.name} to complete the transaction.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-6">
                <div className="grid gap-3">
                    <Label htmlFor="invoice">Invoice Number</Label>
                    <Select value={selectedInvoiceId} onValueChange={handleInvoiceChange}>
                        <SelectTrigger>
                        <SelectValue placeholder="Select an unpaid invoice" />
                        </SelectTrigger>
                        <SelectContent>
                        {unpaidInvoices.map(invoice => {
                            const store = invoice.storeId ? storesMap.get(invoice.storeId) : undefined;
                            return (
                                <SelectItem key={invoice.id} value={invoice.id}>
                                    <div className="truncate">
                                        {invoice.id} - {invoice.customerName || 'Walk-in'} - {currencySymbol} {formatNumber(invoice.amount)}
                                        {currentStore?.id === 'all' && store && <span className="text-muted-foreground ml-2">({store.name})</span>}
                                    </div>
                                </SelectItem>
                            )
                        })}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="customer">Customer (from invoice)</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {Array.from(customersMap.values()).map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-3">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground">{currencySymbol}</span>
                    <Input id="amount" type="number" placeholder="0.00" className="pl-8" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label>Payment Method</Label>
                  <RadioGroup defaultValue="card" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <RadioGroupItem value="card" id="card" className="peer sr-only" />
                      <Label
                        htmlFor="card"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <CreditCard className="mb-3 h-6 w-6" />
                        Credit Card
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                      <Label
                        htmlFor="cash"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Landmark className="mb-3 h-6 w-6" />
                        Cash
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="mobile" id="mobile" className="peer sr-only" />
                      <Label
                        htmlFor="mobile"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Smartphone className="mb-3 h-6 w-6" />
                        Mobile
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={!selectedInvoiceId}>
                  Mark as Paid
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

