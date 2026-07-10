
'use client'

import React, { useMemo, useState } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAppContext } from "@/context/AppContext";
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import type { Invoice } from '@/types';
import { Mail, DollarSign, FileWarning, CalendarClock, Loader2 } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { sendDepartmentEmail } from '@/lib/email';

const statusVariant: { [key in Invoice['status']]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    paid: 'default',
    pending: 'secondary',
    overdue: 'destructive',
    refunded: 'outline',
    'partially-refunded': 'outline',
    'pending-approval': 'secondary',
};

function ReceivablesPageInner() {
    const { invoices, currencySymbol, customersMap, isDataLoaded, user, companyName, smtpConfigList, emailTemplates, setEmailLogs } = useAppContext();
    const { toast } = useToast();
    const [sendingReminderFor, setSendingReminderFor] = useState<string | null>(null);

    const handleSendReminder = async (invoice: Invoice, customerEmail: string, customerName: string) => {
        setSendingReminderFor(invoice.id);
        try {
            await sendDepartmentEmail(
                { smtpConfigList, emailTemplates, setEmailLogs, companyName },
                'Finance',
                'payment-reminder',
                customerEmail,
                { customerName, invoiceId: invoice.id, amount: `${currencySymbol}${invoice.amount.toFixed(2)}`, companyName },
                user?.name ?? 'system'
            );
            toast({ title: 'Reminder Sent', description: `Payment reminder sent to ${customerEmail}.` });
        } finally {
            setSendingReminderFor(null);
        }
    };

    const agingReport = useMemo(() => {
        const today = new Date();
        const report = {
            current: { amount: 0, count: 0 },
            '1-30': { amount: 0, count: 0 },
            '31-60': { amount: 0, count: 0 },
            '61-90': { amount: 0, count: 0 },
            '90+': { amount: 0, count: 0 },
            total: { amount: 0, count: 0 },
        };
        
        const unpaidInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'overdue');
        
        unpaidInvoices.forEach(invoice => {
            // Use explicit dueDate if set, otherwise fall back to 30 days after invoice date
            const dueDateStr = invoice.dueDate || format(new Date(new Date(invoice.date).getTime() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
            const dueDate = parseISO(dueDateStr);
            const daysOverdue = differenceInDays(today, dueDate);

            report.total.amount += invoice.amount;
            report.total.count += 1;

            if (daysOverdue <= 0) {
                report.current.amount += invoice.amount;
                report.current.count += 1;
            } else if (daysOverdue <= 30) {
                report['1-30'].amount += invoice.amount;
                report['1-30'].count += 1;
            } else if (daysOverdue <= 60) {
                report['31-60'].amount += invoice.amount;
                report['31-60'].count += 1;
            } else if (daysOverdue <= 90) {
                report['61-90'].amount += invoice.amount;
                report['61-90'].count += 1;
            } else {
                report['90+'].amount += invoice.amount;
                report['90+'].count += 1;
            }
        });
        
        return report;
    }, [invoices]);

    const overdueInvoices = useMemo(() => {
      return invoices
        .filter(inv => inv.status === 'overdue')
        .sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime());
    }, [invoices]);
    
    return (
        <div className="flex flex-col h-full">
            <Header title="Accounts Receivable" />
            <Breadcrumb items={[{ label: 'Finance', href: '/accounting' }, { label: 'Accounts Receivable' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5"/> AR Aging Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
                                <AgingCard title="Total Outstanding" amount={agingReport.total.amount} count={agingReport.total.count} currency={currencySymbol} icon={DollarSign} />
                                <AgingCard title="Current" amount={agingReport.current.amount} count={agingReport.current.count} currency={currencySymbol} icon={CalendarClock} />
                                <AgingCard title="1-30 Days Overdue" amount={agingReport['1-30'].amount} count={agingReport['1-30'].count} currency={currencySymbol} icon={FileWarning} />
                                <AgingCard title="31-60 Days Overdue" amount={agingReport['31-60'].amount} count={agingReport['31-60'].count} currency={currencySymbol} icon={FileWarning} />
                                <AgingCard title="61-90 Days Overdue" amount={agingReport['61-90'].amount} count={agingReport['61-90'].count} currency={currencySymbol} icon={FileWarning} />
                                <AgingCard title="90+ Days Overdue" amount={agingReport['90+'].amount} count={agingReport['90+'].count} currency={currencySymbol} icon={FileWarning} />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Overdue Invoices</CardTitle>
                            <CardDescription>All invoices that are past their due date.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice ID</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Amount Due</TableHead>
                                        <TableHead className="text-right">Days Overdue</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                {!isDataLoaded ? (
                                  <TableSkeleton rows={8} cols={5} />
                                ) : (
                                <TableBody>
                                    {overdueInvoices.map(invoice => {
                                        const customer = invoice.customerId ? customersMap.get(invoice.customerId) : null;
                                        return (
                                            <TableRow key={invoice.id}>
                                                <TableCell className="font-medium">{invoice.id}</TableCell>
                                                <TableCell>{invoice.customerName}</TableCell>
                                                <TableCell>{format(parseISO(invoice.date), 'PPP')}</TableCell>
                                                <TableCell className="text-right">{currencySymbol}{invoice.amount.toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-destructive font-medium">{differenceInDays(new Date(), parseISO(invoice.date))}</TableCell>
                                                <TableCell className="text-right">
                                                    {customer?.email && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={sendingReminderFor === invoice.id}
                                                            onClick={() => handleSendReminder(invoice, customer.email, customer.name)}
                                                        >
                                                           {sendingReminderFor === invoice.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4"/>} Send Reminder
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {overdueInvoices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No overdue invoices.</TableCell></TableRow>}
                                </TableBody>
                                )}
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

const AgingCard = ({ title, amount, count, currency, icon: Icon }: { title: string, amount: number, count: number, currency: string, icon: React.ElementType }) => (
    <div className="p-4 rounded-lg bg-secondary/50 text-center">
        <Icon className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xl font-bold">{currency}{amount.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground">{count} invoice(s)</p>
    </div>
);




// Permission guard lives in a wrapper so all hooks inside ReceivablesPageInner
// run unconditionally (React rules-of-hooks).
export default function ReceivablesPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <ReceivablesPageInner />;
}
