'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { Module, ThemeSettings } from '@/types';
import { Loader2 } from '@/components/icons';

const modules: { id: Module; label: string; description: string }[] = [
    { id: 'General', label: 'General', description: 'Includes Dashboard and Reports.' },
    { id: 'Sales & Customers', label: 'Sales & Customers', description: 'Includes invoices, payments, customers, and upselling tools.' },
    { id: 'Supply Chain', label: 'Supply Chain', description: 'Manages vendors, purchase orders, and inventory.' },
    { id: 'Shipping & Logistics', label: 'Shipping & Logistics', description: 'Handles shipments, fleet, and route planning.' },
    { id: 'Manufacturing', label: 'Manufacturing', description: 'BOM, production orders, and quality control.' },
    { id: 'Project Management', label: 'Project Management', description: 'Manage projects, tasks, and team collaboration.' },
    { id: 'Finance', label: 'Finance', description: 'General ledger, budgeting, tax, and asset management.' },
    { id: 'Human Resources', label: 'Human Resources', description: 'Employee directory, recruitment, leave, and performance.' },
    { id: 'Service Desk', label: 'Service Desk', description: 'Manages support tickets and customer service.' },
    { id: 'System', label: 'System', description: 'User accounts, stores, and system-wide settings. Cannot be disabled.' },
];

export default function ModulesSettings() {
    const { themeSettings, saveThemeSettings, user, addActivityLog } = useAppContext();
    const { toast } = useToast();
    const canManage = user?.role === 'admin';

    const [local, setLocal] = useState<ThemeSettings>(themeSettings);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocal(themeSettings);
    }, [themeSettings]);

    const handleModuleToggle = (moduleId: Module, checked: boolean) => {
        setLocal(prev => {
            const disabledModules = prev.disabledModules || [];
            if (!checked) {
                return { ...prev, disabledModules: [...new Set([...disabledModules, moduleId])] };
            }
            return { ...prev, disabledModules: disabledModules.filter(id => id !== moduleId) };
        });
    };

    const handleSave = async () => {
        if (!canManage) {
            toast({ variant: 'destructive', title: 'Permission Denied' });
            return;
        }
        setIsSaving(true);
        try {
            await saveThemeSettings({ disabledModules: local.disabledModules });
            addActivityLog('Settings Updated', 'Module settings were updated.');
            toast({ title: 'Modules Saved', description: 'Your changes have been saved.' });
        } catch (err) {
            console.error('Failed to save Module settings:', err);
            const description = err instanceof Error ? err.message : 'Could not save your changes. Please try again.';
            toast({ variant: 'destructive', title: 'Save Failed', description });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Module Management</CardTitle>
                <CardDescription>Enable or disable major features across the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {modules.map(module => (
                    <div key={module.id} className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">{module.label}</Label>
                            <p className="text-sm text-muted-foreground">{module.description}</p>
                        </div>
                        <Switch
                            checked={!local.disabledModules?.includes(module.id)}
                            onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                            disabled={module.id === 'System'}
                        />
                    </div>
                ))}
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? 'Saving…' : 'Save Module Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
