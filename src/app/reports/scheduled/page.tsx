'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, addWeeks, addMonths } from 'date-fns';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlusCircle, MoreHorizontal, Mail, Trash2 } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/context/AppContext';
import type { ScheduledReport, ReportFrequency, ReportType } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const SCHEDULED_REPORTS_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', locked: true },
  { id: 'type', label: 'Type' },
  { id: 'frequency', label: 'Frequency' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'nextRun', label: 'Next Run' },
  { id: 'active', label: 'Active' },
];

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  reportType: z.enum(['revenue', 'inventory', 'hr', 'profitability'] as const),
  frequency: z.enum(['weekly', 'monthly'] as const),
  recipients: z.string().min(1, 'At least one email required'),
});

type FormData = z.infer<typeof schema>;

const REPORT_LABELS: Record<ReportType, string> = {
  revenue: 'Revenue Summary',
  inventory: 'Inventory Status',
  hr: 'HR Overview',
  profitability: 'Profitability Report',
};

export default function ScheduledReportsPage() {
  const { user , tenantId } = useAppContext();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reports, setReports] = useFirestoreCollection<ScheduledReport>('scheduledReports', [], tenantId);
  const columnVisibility = useColumnVisibility('scheduled-reports', SCHEDULED_REPORTS_COLUMNS);
  const { isVisible } = columnVisibility;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', reportType: 'revenue', frequency: 'weekly', recipients: '' },
  });

  const onSubmit = async (data: FormData) => {
    const now = new Date();
    const nextRunAt = data.frequency === 'weekly'
      ? format(addWeeks(now, 1), "yyyy-MM-dd'T'HH:mm:ss")
      : format(addMonths(now, 1), "yyyy-MM-dd'T'HH:mm:ss");

    const report: ScheduledReport = {
      id: `sr-${Date.now()}`,
      name: data.name,
      reportType: data.reportType,
      frequency: data.frequency,
      recipients: data.recipients.split(',').map(e => e.trim()).filter(Boolean),
      isActive: true,
      nextRunAt,
      createdBy: user?.email ?? 'unknown',
      createdAt: new Date().toISOString(),
    };

    if (!tenantId) return;
    await setDoc(doc(db, 'tenants', tenantId, 'scheduledReports', report.id), report);
    toast({ title: 'Report scheduled', description: `Next run: ${nextRunAt.slice(0, 10)}` });
    form.reset();
    setIsFormOpen(false);
  };

  const toggleActive = async (report: ScheduledReport) => {
    if (!tenantId) return;
    const updated = { ...report, isActive: !report.isActive };
    await setDoc(doc(db, 'tenants', tenantId, 'scheduledReports', report.id), updated);
  };

  const deleteReport = async (id: string) => {
    if (!tenantId) return;
    await deleteDoc(doc(db, 'tenants', tenantId, 'scheduledReports', id));
    toast({ title: 'Report deleted' });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Scheduled Reports" />
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Scheduled Reports' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-end gap-2">
          <ColumnVisibilityMenu visibility={columnVisibility} />
          <Button size="sm" className="gap-1" onClick={() => setIsFormOpen(v => !v)}>
            <PlusCircle className="h-4 w-4" />
            {isFormOpen ? 'Cancel' : 'New Schedule'}
          </Button>
        </div>

        {isFormOpen && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Scheduled Report</CardTitle>
              <CardDescription>Reports will be queued for delivery based on frequency. Wire a Cloud Function or Resend integration to send emails.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Report Name</FormLabel><FormControl><Input placeholder="Weekly Revenue" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="reportType" render={({ field }) => (
                    <FormItem><FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(Object.keys(REPORT_LABELS) as ReportType[]).map(t => (
                            <SelectItem key={t} value={t}>{REPORT_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="frequency" render={({ field }) => (
                    <FormItem><FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="recipients" render={({ field }) => (
                    <FormItem><FormLabel>Recipients (comma-separated emails)</FormLabel>
                      <FormControl><Input placeholder="ceo@company.com, cfo@company.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit">Save Schedule</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Active Schedules</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {isVisible('type') && <TableHead>Type</TableHead>}
                  {isVisible('frequency') && <TableHead>Frequency</TableHead>}
                  {isVisible('recipients') && <TableHead>Recipients</TableHead>}
                  {isVisible('nextRun') && <TableHead>Next Run</TableHead>}
                  {isVisible('active') && <TableHead>Active</TableHead>}
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No scheduled reports yet.</TableCell></TableRow>
                ) : reports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    {isVisible('type') && <TableCell><Badge variant="secondary">{REPORT_LABELS[r.reportType]}</Badge></TableCell>}
                    {isVisible('frequency') && <TableCell className="capitalize">{r.frequency}</TableCell>}
                    {isVisible('recipients') && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.recipients.map(e => (
                          <Badge key={e} variant="outline" className="text-xs font-normal">
                            <Mail className="h-3 w-3 mr-1" />{e}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    )}
                    {isVisible('nextRun') && <TableCell className="text-sm text-muted-foreground">{r.nextRunAt?.slice(0, 10)}</TableCell>}
                    {isVisible('active') && (
                    <TableCell>
                      <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} />
                    </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => deleteReport(r.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
