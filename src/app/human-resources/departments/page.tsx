'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { Trash2 } from 'lucide-react';
import type { Department } from '@/types';

function DeptNode({ dept, all, depth }: { dept: Department; all: Department[]; depth: number }) {
  const children = all.filter(d => d.parentId === dept.id);
  return (
    <div style={{ marginLeft: depth * 20 }} className="py-1">
      <div className="flex items-center gap-2">
        <span className="stat-accent-bar pl-2 font-medium">{dept.name}</span>
      </div>
      {children.map(c => <DeptNode key={c.id} dept={c} all={all} depth={depth + 1} />)}
    </div>
  );
}

function DepartmentsInner() {
  const { tenantId } = useAppContext();
  const [depts, setDepts] = useFirestoreCollection<Department>('departments', [], tenantId);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  const roots = useMemo(() => depts.filter(d => !d.parentId), [depts]);

  const add = () => {
    if (!name.trim()) return;
    setDepts(prev => [...prev, { id: `dept-${Date.now()}`, name: name.trim(), parentId: parentId || undefined }]);
    setName(''); setParentId('');
  };
  const remove = (d: Department) => setDepts(prev => prev.filter(x => x.id !== d.id && x.parentId !== d.id));

  return (
    <div className="flex flex-col h-full">
      <Header title="Departments & Org Chart" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Add department</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label htmlFor="d-name">Name</Label><Input id="d-name" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Reports to</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">(top level)</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex items-end"><Button onClick={add}>Add</Button></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Organization hierarchy</CardTitle><CardDescription>Nested by reporting line.</CardDescription></CardHeader>
          <CardContent>
            {roots.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No departments yet.</p> : (
              <div className="space-y-1">
                {roots.map(r => (
                  <div key={r.id} className="flex items-start justify-between">
                    <DeptNode dept={r} all={depts} depth={0} />
                    <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function DepartmentsPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <DepartmentsInner />;
}
