'use client';
import { useRequireRole } from '@/hooks/use-require-role';

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableSkeleton } from '@/components/TableSkeleton';
import { buildPayrollLedgerEntries } from '@/lib/posting';
import { addMoney, formatNumber } from '@/lib/money';
import type { PayrollRun } from '@/types';
import { format } from 'date-fns/format';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const PAYROLL_SUMMARY_COLUMNS: ColumnDef[] = [
  { id: 'employee', label: 'Employee', locked: true },
  { id: 'department', label: 'Department' },
  { id: 'salary', label: 'Annual Salary' },
  { id: 'leaveTaken', label: 'Leave Days Taken' },
  { id: 'deduction', label: 'Deduction' },
  { id: 'netPay', label: 'Net Pay' },
  { id: 'status', label: 'Status' },
];

const PAYROLL_HISTORY_COLUMNS: ColumnDef[] = [
  { id: 'period', label: 'Period', locked: true },
  { id: 'posted', label: 'Posted' },
  { id: 'gross', label: 'Gross' },
  { id: 'deductions', label: 'Deductions' },
  { id: 'net', label: 'Net' },
  { id: 'postedBy', label: 'Posted By' },
];

function PayrollPageInner() {
  const { employees, currencySymbol, currentStore, isDataLoaded, user, payrollRuns, setPayrollRuns, setLedgerEntries, addActivityLog } = useAppContext();
  const { toast } = useToast();
  const [isPosting, setIsPosting] = useState(false);
  const summaryColumnVisibility = useColumnVisibility('payroll-summary', PAYROLL_SUMMARY_COLUMNS);
  const { isVisible: isSummaryVisible } = summaryColumnVisibility;
  const historyColumnVisibility = useColumnVisibility('payroll-history', PAYROLL_HISTORY_COLUMNS);
  const { isVisible: isHistoryVisible } = historyColumnVisibility;

  const periodLabel = format(new Date(), 'yyyy-MM');
  const existingRunForPeriod = payrollRuns.find(r => r.periodLabel === periodLabel && r.storeId === (currentStore?.id === 'all' ? undefined : currentStore?.id));

  const payrollSummary = useMemo(() => {
    const storeEmployees = currentStore?.id === 'all'
      ? employees
      : employees.filter(e => e.storeId === currentStore?.id);

    return storeEmployees.map(emp => {
      const dailyRate = emp.salary / 365;
      const leaveTaken = emp.leaveTaken ?? 0;
      const deduction = dailyRate * leaveTaken;
      const netPay = emp.salary - deduction;
      const status = leaveTaken > (emp.annualLeaveAllowance ?? 20) ? 'Over Leave' : 'Normal';

      return {
        ...emp,
        dailyRate,
        leaveTaken,
        deduction,
        netPay,
        status,
      };
    });
  }, [employees, currentStore]);

  const totalGross = payrollSummary.reduce((s, e) => s + e.salary, 0);
  const totalDeductions = payrollSummary.reduce((s, e) => s + e.deduction, 0);
  const totalNet = payrollSummary.reduce((s, e) => s + e.netPay, 0);

  const runPayroll = () => {
    if (!user || payrollSummary.length === 0) return;
    setIsPosting(true);
    try {
      const runId = `payroll-${periodLabel}-${currentStore?.id === 'all' ? 'all' : currentStore?.id ?? 'all'}-${Date.now()}`;
      const run: PayrollRun = {
        id: runId,
        periodLabel,
        storeId: currentStore?.id === 'all' ? undefined : currentStore?.id,
        runDate: format(new Date(), 'yyyy-MM-dd'),
        lines: payrollSummary.map(e => ({
          employeeId: e.id,
          employeeName: e.name,
          grossPay: e.salary,
          deductions: e.deduction,
          netPay: e.netPay,
        })),
        totalGross: addMoney(totalGross, 0),
        totalDeductions: addMoney(totalDeductions, 0),
        totalNet: addMoney(totalNet, 0),
        postedBy: user.email,
        ledgerEntryIds: [],
      };
      const entries = buildPayrollLedgerEntries(run);
      run.ledgerEntryIds = entries.map(e => e.id);
      setLedgerEntries(prev => {
        const entryIds = new Set(entries.map(e => e.id));
        return [...entries, ...prev.filter(e => !entryIds.has(e.id))];
      });
      setPayrollRuns(prev => [run, ...prev]);
      addActivityLog('Payroll Posted', `Posted payroll for ${periodLabel} — ${currencySymbol} ${formatNumber(totalNet)} net across ${payrollSummary.length} employee(s).`);
      toast({ title: 'Payroll posted', description: `${periodLabel} payroll posted to the general ledger.` });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Payroll" />
      <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources' }, { label: 'Payroll' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            {existingRunForPeriod ? (
              <p className="text-sm text-muted-foreground">
                {periodLabel} payroll posted {format(new Date(existingRunForPeriod.runDate), 'PPP')} by {existingRunForPeriod.postedBy}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">This period&apos;s payroll has not been posted to the ledger yet.</p>
            )}
          </div>
          <Button onClick={runPayroll} disabled={isPosting || !!existingRunForPeriod || payrollSummary.length === 0}>
            {existingRunForPeriod ? `${periodLabel} Already Posted` : isPosting ? 'Posting…' : `Run Payroll for ${periodLabel}`}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Gross Pay</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{currencySymbol} {totalGross.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Deductions</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">{currencySymbol} {formatNumber(totalDeductions)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Net Pay</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{currencySymbol} {formatNumber(totalNet)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <CardTitle>Payroll Summary</CardTitle>
                <CardDescription>Annual salary breakdown with leave deductions per employee.</CardDescription>
              </div>
              <ColumnVisibilityMenu visibility={summaryColumnVisibility} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  {isSummaryVisible('department') && <TableHead>Department</TableHead>}
                  {isSummaryVisible('salary') && <TableHead className="text-right">Annual Salary</TableHead>}
                  {isSummaryVisible('leaveTaken') && <TableHead className="text-right">Leave Days Taken</TableHead>}
                  {isSummaryVisible('deduction') && <TableHead className="text-right">Deduction</TableHead>}
                  {isSummaryVisible('netPay') && <TableHead className="text-right">Net Pay</TableHead>}
                  {isSummaryVisible('status') && <TableHead>Status</TableHead>}
                </TableRow>
              </TableHeader>
              {!isDataLoaded ? (
                <TableSkeleton rows={8} cols={5} />
              ) : (
                <TableBody>
                  {payrollSummary.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={emp.avatar} />
                            <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.jobTitle}</p>
                          </div>
                        </div>
                      </TableCell>
                      {isSummaryVisible('department') && <TableCell>{emp.department || '-'}</TableCell>}
                      {isSummaryVisible('salary') && <TableCell className="text-right">{currencySymbol} {emp.salary.toLocaleString()}</TableCell>}
                      {isSummaryVisible('leaveTaken') && <TableCell className="text-right">{emp.leaveTaken} / {emp.annualLeaveAllowance ?? 20}</TableCell>}
                      {isSummaryVisible('deduction') && <TableCell className="text-right text-destructive">- {currencySymbol} {formatNumber(emp.deduction)}</TableCell>}
                      {isSummaryVisible('netPay') && <TableCell className="text-right font-semibold">{currencySymbol} {formatNumber(emp.netPay)}</TableCell>}
                      {isSummaryVisible('status') && (
                        <TableCell>
                          <Badge variant={emp.status === 'Over Leave' ? 'destructive' : 'default'}>
                            {emp.status}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              )}
            </Table>
          </CardContent>
        </Card>

        {payrollRuns.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Payroll History</CardTitle>
                  <CardDescription>Posted runs — each one produced a balanced entry in the General Ledger.</CardDescription>
                </div>
                <ColumnVisibilityMenu visibility={historyColumnVisibility} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Period</TableHead>
                  {isHistoryVisible('posted') && <TableHead>Posted</TableHead>}
                  {isHistoryVisible('gross') && <TableHead className="text-right">Gross</TableHead>}
                  {isHistoryVisible('deductions') && <TableHead className="text-right">Deductions</TableHead>}
                  {isHistoryVisible('net') && <TableHead className="text-right">Net</TableHead>}
                  {isHistoryVisible('postedBy') && <TableHead>Posted By</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {payrollRuns.map(run => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{run.periodLabel}</TableCell>
                      {isHistoryVisible('posted') && <TableCell>{format(new Date(run.runDate), 'PPP')}</TableCell>}
                      {isHistoryVisible('gross') && <TableCell className="text-right">{currencySymbol} {formatNumber(run.totalGross)}</TableCell>}
                      {isHistoryVisible('deductions') && <TableCell className="text-right text-destructive">- {currencySymbol} {formatNumber(run.totalDeductions)}</TableCell>}
                      {isHistoryVisible('net') && <TableCell className="text-right font-semibold">{currencySymbol} {formatNumber(run.totalNet)}</TableCell>}
                      {isHistoryVisible('postedBy') && <TableCell>{run.postedBy}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// Permission guard lives in a wrapper so all hooks inside PayrollPageInner
// run unconditionally (React rules-of-hooks).
export default function PayrollPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <PayrollPageInner />;
}
