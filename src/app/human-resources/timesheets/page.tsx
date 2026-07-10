'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import type { Timesheet } from '@/types';

function TimesheetsInner() {
  const { user, tenantId } = useAppContext();
  const [sheets, setSheets] = useFirestoreCollection<Timesheet>('timesheets', [], tenantId);
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [project, setProject] = useState('');

  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const visible = isManager ? sheets : sheets.filter(s => s.employeeId === user?.id);

  const add = () => {
    const h = Number(hours);
    if (!date || !h) return;
    const t: Timesheet = { id: `ts-${Date.now()}`, employeeId: user?.id ?? '', employeeName: user?.name ?? '', date, hours: h, project: project || undefined };
    setSheets(prev => [t, ...prev]);
    setDate(''); setHours(''); setProject('');
  };
  const approve = (t: Timesheet) => setSheets(prev => prev.map(x => x.id === t.id ? { ...x, approved: true } : x));

  return (
    <div className="flex flex-col h-full">
      <Header title="Timesheets" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Log time</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-4">
            <div className="space-y-2"><Label htmlFor="ts-date">Date</Label><Input id="ts-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="ts-hrs">Hours</Label><Input id="ts-hrs" type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="ts-proj">Project</Label><Input id="ts-proj" value={project} onChange={e => setProject(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={add}>Add entry</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{isManager ? 'All timesheets' : 'My timesheets'}</CardTitle></CardHeader>
          <CardContent>
            {visible.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No entries yet.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Date</TableHead>{isManager && <TableHead>Employee</TableHead>}<TableHead>Project</TableHead><TableHead className="text-right">Hours</TableHead><TableHead>Status</TableHead>{isManager && <TableHead className="text-right">Action</TableHead>}</TableRow></TableHeader>
                <TableBody>{visible.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.date}</TableCell>
                    {isManager && <TableCell>{t.employeeName}</TableCell>}
                    <TableCell>{t.project || '—'}</TableCell>
                    <TableCell className="text-right">{t.hours}</TableCell>
                    <TableCell><Badge variant={t.approved ? 'default' : 'secondary'}>{t.approved ? 'Approved' : 'Pending'}</Badge></TableCell>
                    {isManager && <TableCell className="text-right">{!t.approved && <Button size="sm" variant="outline" onClick={() => approve(t)}>Approve</Button>}</TableCell>}
                  </TableRow>
                ))}</TableBody>
              </Table></div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function TimesheetsPage() {
  const isAllowed = useRequireRole(['admin', 'manager', 'cashier', 'inventory-staff']);
  if (!isAllowed) return null;
  return <TimesheetsInner />;
}
