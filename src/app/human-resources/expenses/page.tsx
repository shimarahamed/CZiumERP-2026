'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { buildApprovalWorkflow } from '@/lib/approvals';
import { formatNumber } from '@/lib/money';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';
import type { ApprovalWorkflow, ExpenseClaim } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const EXPENSE_CLAIMS_COLUMNS: ColumnDef[] = [
  { id: 'date', label: 'Date', locked: true },
  { id: 'employee', label: 'Employee' },
  { id: 'category', label: 'Category' },
  { id: 'amount', label: 'Amount' },
  { id: 'status', label: 'Status' },
];

function ExpensesInner() {
  const { user, users, employees, tenantId, currencySymbol, themeSettings, approvalWorkflows, setApprovalWorkflows } = useAppContext();
  const [claims, setClaims] = useFirestoreCollection<ExpenseClaim>('expenseClaims', [], tenantId);
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reviewing, setReviewing] = useState<ExpenseClaim | null>(null);
  const columnVisibility = useColumnVisibility('expense-claims', EXPENSE_CLAIMS_COLUMNS);
  const { isVisible } = columnVisibility;

  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const visible = isManager ? claims : claims.filter(c => c.employeeId === user?.id);

  const workflowFor = (c: ExpenseClaim) =>
    approvalWorkflows.find(w => w.entityType === 'expense-claim' && w.entityId === c.id && w.finalStatus === 'in-progress');

  const submit = () => {
    const amt = Number(amount);
    if (!date || !amt || !user) return;
    const id = `exp-${Date.now()}`;
    const workflow = buildApprovalWorkflow('expense-claim', id, `${category} — ${currencySymbol}${formatNumber(amt)}`, amt, user, themeSettings.approvalRules, users, undefined, employees);
    const c: ExpenseClaim = { id, employeeId: user.id, employeeName: user.name, date, category, amount: amt, description: description || undefined, status: 'pending' };
    setClaims(prev => [c, ...prev]);
    if (workflow) setApprovalWorkflows(prev => [workflow, ...prev]);
    setDate(''); setAmount(''); setDescription('');
  };
  const decide = (c: ExpenseClaim, status: 'approved' | 'rejected') => setClaims(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));

  const onWorkflowChange = (c: ExpenseClaim) => (wf: ApprovalWorkflow) => {
    setApprovalWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
    if (wf.finalStatus === 'approved' || wf.finalStatus === 'rejected') {
      decide(c, wf.finalStatus);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Expense Claims" />
      <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources/dashboard' }, { label: 'Expense Claims' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Submit a claim</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-4">
            <div className="space-y-2"><Label htmlFor="ex-date">Date</Label><Input id="ex-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Travel', 'Meals', 'Accommodation', 'Supplies', 'Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="ex-amt">Amount ({currencySymbol})</Label><Input id="ex-amt" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="ex-desc">Description</Label><Input id="ex-desc" value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div className="sm:col-span-4"><Button onClick={submit}>Submit claim</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">{isManager ? 'All claims' : 'My claims'}</CardTitle>
              <ColumnVisibilityMenu visibility={columnVisibility} />
            </div>
          </CardHeader>
          <CardContent>
            {visible.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No claims yet.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Date</TableHead>{isManager && isVisible('employee') && <TableHead>Employee</TableHead>}{isVisible('category') && <TableHead>Category</TableHead>}{isVisible('amount') && <TableHead className="text-right">Amount</TableHead>}{isVisible('status') && <TableHead>Status</TableHead>}{isManager && <TableHead className="text-right">Action</TableHead>}</TableRow></TableHeader>
                <TableBody>{visible.map(c => {
                  const wf = workflowFor(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{c.date}</TableCell>
                      {isManager && isVisible('employee') && <TableCell>{c.employeeName}</TableCell>}
                      {isVisible('category') && <TableCell>{c.category}</TableCell>}
                      {isVisible('amount') && <TableCell className="text-right">{currencySymbol} {formatNumber(c.amount)}</TableCell>}
                      {isVisible('status') && <TableCell><Badge variant={c.status === 'approved' ? 'default' : c.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{c.status}</Badge></TableCell>}
                      {isManager && (
                        <TableCell className="text-right space-x-1">
                          {c.status === 'pending' && wf && (
                            <Button size="sm" variant="outline" onClick={() => setReviewing(c)}>Review</Button>
                          )}
                          {c.status === 'pending' && !wf && (
                            <><Button size="sm" variant="outline" onClick={() => decide(c, 'approved')}>Approve</Button><Button size="sm" variant="ghost" onClick={() => decide(c, 'rejected')}>Reject</Button></>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
      </main>
      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review expense claim</DialogTitle></DialogHeader>
          {reviewing && (
            <ApprovalWorkflowPanel
              entityType="expense-claim"
              entityId={reviewing.id}
              entityTitle={`${reviewing.category} — ${currencySymbol}${formatNumber(reviewing.amount)}`}
              workflow={workflowFor(reviewing)}
              onWorkflowChange={onWorkflowChange(reviewing)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ExpenseClaimsPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'cashier', 'inventory-staff']);
  if (!isAllowed) return null;
  return <ExpensesInner />;
}
