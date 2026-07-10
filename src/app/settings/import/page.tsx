'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { useRequireRole } from '@/hooks/use-require-role';
import { Upload, Download, Loader2, AlertTriangle } from 'lucide-react';
import {
  IMPORT_SCHEMAS, readSheet, validateRows, buildTemplateWorkbook,
  toProducts, toCustomers, toVendors, toInvoices,
  type ImportKind, type ParsedRow,
} from '@/lib/import-data';

function ImportInner() {
  const { setProducts, setCustomers, setVendors, setInvoices, products, customers, vendors, invoices, addActivityLog, currentStore } = useAppContext();
  const { toast } = useToast();
  const [kind, setKind] = useState<ImportKind>('products');
  const [fileName, setFileName] = useState('');
  const [records, setRecords] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const schema = IMPORT_SCHEMAS[kind];
  const existing = useMemo(() => ({ products, customers, vendors, invoices }), [products, customers, vendors, invoices]);

  const reset = () => { setRecords([]); setErrors([]); setWarnings([]); setFileName(''); };

  const switchKind = (k: ImportKind) => { setKind(k); reset(); };

  const downloadTemplate = () => {
    const blob = buildTemplateWorkbook(kind);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}-import-template.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const matrix = await readSheet(file);
      const result = validateRows(kind, matrix, existing);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setRecords(result.records);
    } catch {
      setErrors(['Could not read this file. Make sure it is a valid CSV or Excel (.xlsx) file.']);
    } finally {
      e.target.value = '';
    }
  };

  const runImport = () => {
    if (errors.length || records.length === 0) return;
    setImporting(true);
    try {
      const ts = Date.now();
      const storeId = currentStore?.id;
      let count = records.length;
      if (kind === 'products') {
        const items = toProducts(records, storeId, ts);
        setProducts(prev => [...items, ...prev]);
      } else if (kind === 'customers') {
        const items = toCustomers(records, storeId, ts);
        setCustomers(prev => [...items, ...prev]);
      } else if (kind === 'vendors') {
        const items = toVendors(records, storeId, ts);
        setVendors(prev => [...items, ...prev]);
      } else {
        const items = toInvoices(records, storeId);
        count = items.length;
        setInvoices(prev => [...items, ...prev]);
      }
      addActivityLog('Bulk Import', `Imported ${count} ${kind} from ${fileName || 'file'}.`);
      toast({ title: 'Import complete', description: `${count} ${kind === 'invoices' ? 'invoice(s)' : kind} added.` });
      reset();
    } finally {
      setImporting(false);
    }
  };

  const previewCols = schema.columns.map(c => c.key);

  return (
    <div className="flex flex-col h-full">
      <Header title="Bulk Import" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import from CSV or Excel</CardTitle>
            <CardDescription>Load products, customers, vendors, or historical invoices in bulk from a <span className="font-medium">.csv</span> or <span className="font-medium">.xlsx</span> file — the fastest way to onboard existing data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>What are you importing?</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(IMPORT_SCHEMAS) as ImportKind[]).map(k => (
                  <Button key={k} variant={kind === k ? 'default' : 'outline'} size="sm" onClick={() => switchKind(k)}>
                    {IMPORT_SCHEMAS[k].label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{schema.description}</p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Download Excel template</Button>
              <div>
                <Label htmlFor="import-file" className="sr-only">Data file</Label>
                <input id="import-file" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground file:cursor-pointer" />
              </div>
              {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            </div>

            {/* Expected columns guide */}
            <div className="rounded-md border p-3 text-xs">
              <p className="font-medium mb-1">Expected columns</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                {schema.columns.map(c => (
                  <span key={c.key}>
                    <span className="font-mono">{c.key}</span>
                    {c.required && <span className="text-destructive"> *</span>}
                    {c.hint && <span className="opacity-70"> — {c.hint}</span>}
                  </span>
                ))}
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive space-y-1" role="alert">
                <p className="font-medium">This file can&apos;t be imported yet:</p>
                {errors.slice(0, 8).map((e, i) => <p key={`error-${i}`}>{e}</p>)}
                {errors.length > 8 && <p>…and {errors.length - 8} more. Fix the file and re-upload.</p>}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1" role="status">
                <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Heads up — you can still proceed:</p>
                {warnings.map((w, i) => <p key={`warn-${i}`}>{w}</p>)}
              </div>
            )}

            {records.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">Previewing {records.length} row(s) (first 10 shown):</p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader><TableRow>{previewCols.map(h => <TableHead key={h} className="capitalize whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {records.slice(0, 10).map((r, i) => (
                        <TableRow key={`preview-row-${i}`}>{previewCols.map(h => <TableCell key={`${i}-${h}`} className="whitespace-nowrap">{r[h] ?? ''}</TableCell>)}</TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={runImport} disabled={importing || errors.length > 0}>
                  {importing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>) : (<><Upload className="mr-2 h-4 w-4" />Import {records.length} row(s)</>)}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function ImportPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <ImportInner />;
}
