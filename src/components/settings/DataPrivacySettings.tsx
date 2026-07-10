'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { Loader2 } from '@/components/icons';

type ExportType = 'customers' | 'employees' | 'invoices' | 'products';

export default function DataPrivacySettings() {
    const { customers, employees, invoices, products, addActivityLog } = useAppContext();
    const { toast } = useToast();
    const [exportingType, setExportingType] = useState<ExportType | null>(null);

    const handleExportData = (type: ExportType) => {
        setExportingType(type);
        // Defer to the next tick so the disabled/spinner state paints before
        // the synchronous stringify+Blob work runs on the main thread — for a
        // large dataset this is what previously read as a "frozen" click.
        setTimeout(() => {
            try {
                const dataMap = { customers, employees, invoices, products };
                const data = dataMap[type];
                const sanitized = data.map((item: any) => {
                    const { password: _pw, ...rest } = item;
                    return rest;
                });
                const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                addActivityLog('Data Export', `Exported ${type} data for GDPR compliance.`);
                toast({ title: 'Export Complete', description: `${type} data has been downloaded.` });
            } finally {
                setExportingType(null);
            }
        }, 0);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Data Export (GDPR)</CardTitle>
                <CardDescription>Download a copy of your business data in JSON format for compliance, auditing, or migration purposes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {(['customers', 'employees', 'invoices', 'products'] as const).map(type => (
                    <div key={type} className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div>
                            <Label className="text-base capitalize">{type}</Label>
                            <p className="text-sm text-muted-foreground">Export all {type} records as JSON.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleExportData(type)} disabled={exportingType === type}>
                            {exportingType === type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {exportingType === type ? 'Exporting…' : `Export ${type}`}
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
