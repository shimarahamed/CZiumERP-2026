'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db, enableNetwork, disableNetwork } from '@/lib/firebase';

const getStoredIsOnline = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('isOnline') !== 'false';
    }
    return true;
};

export default function DeveloperSettings() {
    const { toast } = useToast();
    const [syncEnabled, setSyncEnabled] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        setSyncEnabled(getStoredIsOnline());
    }, []);

    const handleOnlineSyncToggle = async (checked: boolean) => {
        const previousValue = syncEnabled;
        setSyncEnabled(checked);
        setIsUpdating(true);

        try {
            if (checked) {
                await enableNetwork(db);
                toast({ title: 'Online Sync Enabled', description: 'Data will now sync with the cloud.' });
            } else {
                await disableNetwork(db);
                toast({ title: 'Cloud Sync Paused', description: 'Firestore will use its local cache until sync is enabled again.' });
            }
            localStorage.setItem('isOnline', String(checked));
        } catch {
            setSyncEnabled(previousValue);
            toast({
                variant: 'destructive',
                title: 'Sync Setting Failed',
                description: 'The Firestore network setting could not be changed. Please try again.',
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Developer Settings</CardTitle>
                <CardDescription>Advanced options for development and testing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Enable Cloud Sync</Label>
                        <p className="text-sm text-muted-foreground">
                            When disabled, Firestore uses cached data and queues supported changes locally. Re-enable it to sync with the cloud.
                        </p>
                    </div>
                    <Switch
                        checked={syncEnabled}
                        onCheckedChange={handleOnlineSyncToggle}
                        disabled={isUpdating}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
