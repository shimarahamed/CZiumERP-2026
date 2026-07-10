'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { buildApprovalWorkflow } from '@/lib/approvals';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';
import type { ApprovalWorkflow, ExpenseClaim } from '@/types';

function ExpensesInner() {
  const { user, users, employees, tenantId, currencySymbol, themeSettings, approvalWorkflows, setApprovalWorkflows } = useAppContext();
  const [claims, setClaims] = useFirestoreCollection<ExpenseClaim>('expenseClaims', [], tenantId);
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reviewing, setReviewing] = useState<ExpenseClaim | null>(null);

  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const visible = isManager ? claims : claims.filter(c => c.employeeId === user?.id);

  const workflowFor = (c: ExpenseClaim) =>
    approvalWorkflows.find(w => w.entityType === 'expense-claim' && w.entityId === c.id && w.finalStatus === 'in-progress');

  const submit = () => {
    const amt = Number(amount);
    if (!date || !amt || !user) return;
    const id = `exp-${Date.now()}`;
    const workflow = buildApprovalWorkflow('expense-claim', id, `${category} — ${currencySymbol}${amt.toFixed(2)}`, amt, user, themeSettings.approvalRules, users, undefined, employees);
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
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Submit a claim</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-4">
            <div className="space-y-2"><Label htmlFor="ex-date">Date</Label><Input id="ex-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Category</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
                {['Travel', 'Meals', 'Accommodation', 'Supplies', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="ex-amt">Amount ({currencySymbol})</Label><Input id="ex-amt" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="ex-desc">Description</Label><Input id="ex-desc" value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div className="sm:col-span-4"><Button onClick={submit}>Submit claim</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{isManager ? 'All claims' : 'My claims'}</CardTitle></CardHeader>
          <CardContent>
            {visible.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No claims yet.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Date</TableHead>{isManager && <TableHead>Employee</TableHead>}<TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>{isManager && <TableHead className="text-right">Action</TableHead>}</TableRow></TableHeader>
                <TableBody>{visible.map(c => {
                  const wf = workflowFor(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{c.date}</TableCell>
                      {isManager && <TableCell>{c.employeeName}</TableCell>}
                      <TableCell>{c.category}</TableCell>
                      <TableCell className="text-right">{currencySymbol} {c.amount.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={c.status === 'approved' ? 'default' : c.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{c.status}</Badge></TableCell>
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
              entityTitle={`${reviewing.category} — ${currencySymbol}${reviewing.amount.toFixed(2)}`}
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
