'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Save } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { CSVExportButton } from '@/components/CSVExportButton';
import { REPORT_SOURCE_COLUMNS, runReport } from '@/lib/report-builder';
import type { ReportAggregate, ReportDefinition, ReportFilter, ReportFilterOperator, ReportSource } from '@/types';
import { formatNumber } from '@/lib/money';

const SOURCE_LABELS: Record<ReportSource, string> = {
  invoices: 'Invoices',
  products: 'Products',
  customers: 'Customers',
  vendors: 'Vendors',
  purchaseOrders: 'Purchase Orders',
  ledgerEntries: 'Ledger Entries',
  vendorBills: 'Vendor Bills',
};

const OPERATOR_LABELS: Record<ReportFilterOperator, string> = {
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
};

const AGGREGATES: ReportAggregate[] = ['sum', 'avg', 'count', 'min', 'max'];

function ReportBuilderInner() {
  const { tenantId, user, invoices, products, customers, vendors, purchaseOrders, ledgerEntries, vendorBills } = useAppContext();
  const { toast } = useToast();
  const [definitions, setDefinitions] = useFirestoreCollection<ReportDefinition>('reportDefinitions', [], tenantId);

  const [name, setName] = useState('');
  const [source, setSource] = useState<ReportSource>('invoices');
  const [columns, setColumns] = useState<string[]>(['id', 'date', 'amount']);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groupByField, setGroupByField] = useState<string | undefined>(undefined);
  const [aggregateField, setAggregateField] = useState<string | undefined>(undefined);
  const [aggregate, setAggregate] = useState<ReportAggregate | undefined>(undefined);
  const [loadedDefinitionId, setLoadedDefinitionId] = useState<string | null>(null);

  const sourceData: Record<ReportSource, Record<string, unknown>[]> = {
    invoices, products, customers, vendors, purchaseOrders, ledgerEntries, vendorBills,
  };

  const availableColumns = REPORT_SOURCE_COLUMNS[source];

  const currentDefinition: ReportDefinition = {
    id: loadedDefinitionId ?? 'draft',
    name: name || 'Untitled report',
    source,
    columns,
    filters,
    groupByField,
    aggregateField,
    aggregate,
    createdBy: user?.name ?? 'unknown',
    createdAt: new Date().toISOString(),
  };

  const results = useMemo(
    () => runReport(currentDefinition, sourceData[source]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, columns, filters, groupByField, aggregateField, aggregate, invoices, products, customers, vendors, purchaseOrders, ledgerEntries, vendorBills]
  );

  const isGrouped = !!(groupByField && aggregate);
  const resultColumns = isGrouped ? [groupByField!, `${aggregate}(${aggregateField ?? 'count'})`] : columns;

  const changeSource = (next: ReportSource) => {
    setSource(next);
    setColumns(REPORT_SOURCE_COLUMNS[next].slice(0, 3));
    setFilters([]);
    setGroupByField(undefined);
    setAggregateField(undefined);
    setAggregate(undefined);
  };

  const toggleColumn = (col: string) => {
    setColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const addFilter = () => {
    setFilters(prev => [...prev, { field: availableColumns[0], operator: 'equals', value: '' }]);
  };
  const updateFilter = (index: number, patch: Partial<ReportFilter>) => {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
  };
  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const loadDefinition = (id: string) => {
    const def = definitions.find(d => d.id === id);
    if (!def) return;
    setLoadedDefinitionId(def.id);
    setName(def.name);
    setSource(def.source);
    setColumns(def.columns);
    setFilters(def.filters);
    setGroupByField(def.groupByField);
    setAggregateField(def.aggregateField);
    setAggregate(def.aggregate);
  };

  const saveDefinition = () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }
    const id = loadedDefinitionId ?? `report-${Date.now()}`;
    const toSave: ReportDefinition = { ...currentDefinition, id, name: name.trim() };
    setDefinitions(prev => {
      const exists = prev.some(d => d.id === id);
      return exists ? prev.map(d => d.id === id ? toSave : d) : [toSave, ...prev];
    });
    setLoadedDefinitionId(id);
    toast({ title: 'Report saved' });
  };

  const deleteDefinition = (id: string) => {
    setDefinitions(prev => prev.filter(d => d.id !== id));
    if (loadedDefinitionId === id) setLoadedDefinitionId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Report Builder" />
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Report Builder' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Configure</CardTitle>
              <CardDescription>Pick a data source, columns, filters, and an optional group-by.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {definitions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Saved reports</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {definitions.map(def => (
                      <div key={def.id} className="flex items-center gap-1">
                        <Button size="sm" variant={loadedDefinitionId === def.id ? 'default' : 'outline'} onClick={() => loadDefinition(def.id)}>
                          {def.name}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteDefinition(def.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="report-name">Report name</Label>
                <Input id="report-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Unpaid bills over $500" />
              </div>

              <div className="space-y-1.5">
                <Label>Data source</Label>
                <Select value={source} onValueChange={(v) => changeSource(v as ReportSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOURCE_LABELS) as ReportSource[]).map(s => (
                      <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Columns</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {availableColumns.map(col => (
                    <label key={col} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={columns.includes(col)} onCheckedChange={() => toggleColumn(col)} />
                      {col}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Filters</Label>
                  <Button size="sm" variant="outline" className="gap-1" onClick={addFilter}>
                    <PlusCircle className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-1.5 flex-wrap">
                    <Select value={filter.field} onValueChange={(v) => updateFilter(index, { field: v })}>
                      <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{availableColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filter.operator} onValueChange={(v) => updateFilter(index, { operator: v as ReportFilterOperator })}>
                      <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(OPERATOR_LABELS) as ReportFilterOperator[]).map(op => <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="w-[90px] h-8 text-xs" value={filter.value} onChange={e => updateFilter(index, { value: e.target.value })} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFilter(index)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Group & aggregate (optional)</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Select value={groupByField ?? '__none'} onValueChange={(v) => setGroupByField(v === '__none' ? undefined : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Group by" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {availableColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={aggregateField ?? '__none'} onValueChange={(v) => setAggregateField(v === '__none' ? undefined : v)} disabled={!groupByField}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {availableColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={aggregate ?? '__none'} onValueChange={(v) => setAggregate(v === '__none' ? undefined : v as ReportAggregate)} disabled={!groupByField}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Function" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {AGGREGATES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={saveDefinition} className="w-full gap-1.5">
                <Save className="h-4 w-4" /> {loadedDefinitionId ? 'Update report' : 'Save report'}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">{name || 'Preview'}</CardTitle>
                  <CardDescription>{results.length} row(s)</CardDescription>
                </div>
                <CSVExportButton data={results as Record<string, unknown>[]} filename={name || 'report'} />
              </div>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No matching rows — adjust filters or columns.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>{resultColumns.map(col => <TableHead key={col}>{col}</TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.slice(0, 200).map((row, i) => (
                        <TableRow key={i}>
                          {isGrouped ? (
                            <>
                              <TableCell>{(row as { group: string }).group}</TableCell>
                              <TableCell>{formatNumber((row as { value: number }).value)}</TableCell>
                            </>
                          ) : (
                            columns.map(col => <TableCell key={col}>{String((row as Record<string, unknown>)[col] ?? '')}</TableCell>)
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function ReportBuilderPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <ReportBuilderInner />;
}
