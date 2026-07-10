'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db, enableNetwork, disableNetwork } from '@/lib/firebase';

const getStoredIsOnline = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('isOnline') === 'true';
    }
    return false;
};

export default function DeveloperSettings() {
    const { toast } = useToast();
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        setIsOnline(getStoredIsOnline());
    }, []);

    const handleOnlineSyncToggle = (checked: boolean) => {
        setIsOnline(checked);
        if (checked) {
            enableNetwork(db).then(() => {
                toast({ title: 'Online Sync Enabled', description: 'Data will now sync with the cloud.' });
                localStorage.setItem('isOnline', 'true');
            });
        } else {
            disableNetwork(db).then(() => {
                toast({ title: 'Online Sync Disabled', description: 'Application is now in offline mode.' });
                localStorage.setItem('isOnline', 'false');
            });
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
                        <Label className="text-base">Enable Online Sync</Label>
                        <p className="text-sm text-muted-foreground">
                            Connect to the live Firestore database. When disabled, the app works offline.
                        </p>
                    </div>
                    <Switch
                        checked={isOnline}
                        onCheckedChange={handleOnlineSyncToggle}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
