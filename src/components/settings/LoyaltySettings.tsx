'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { LoyaltySettings as LoyaltySettingsType, ThemeSettings } from '@/types';
import { Loader2 } from '@/components/icons';

export default function LoyaltySettings() {
    const { themeSettings, saveThemeSettings, user, addActivityLog } = useAppContext();
    const { toast } = useToast();
    const canManage = user?.role === 'admin';

    const [local, setLocal] = useState<ThemeSettings>(themeSettings);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocal(themeSettings);
    }, [themeSettings]);

    const handleTierSettingChange = (tier: 'Silver' | 'Gold', field: 'points' | 'discount', value: string) => {
        const numericValue = Number(value);
        if (isNaN(numericValue)) return;

        setLocal(prev => {
            const currentTiers = prev.loyaltySettings?.tiers ?? { Silver: { points: 0, discount: 0 }, Gold: { points: 0, discount: 0 } };
            const updatedTier = { ...currentTiers[tier], [field]: numericValue };
            const newTiers = { ...currentTiers, [tier]: updatedTier } as LoyaltySettingsType['tiers'];
            return { ...prev, loyaltySettings: { tiers: newTiers } } as ThemeSettings;
        });
    };

    const handleSave = async () => {
        if (!canManage) {
            toast({ variant: 'destructive', title: 'Permission Denied' });
            return;
        }
        setIsSaving(true);
        try {
            await saveThemeSettings({ loyaltySettings: local.loyaltySettings });
            addActivityLog('Settings Updated', 'Loyalty Program settings were updated.');
            toast({ title: 'Loyalty Program Saved', description: 'Your changes have been saved.' });
        } catch {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save your changes. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Customer Loyalty Program</CardTitle>
                <CardDescription>Define the tiers and rewards for your customer loyalty program.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-base px-4 py-1">Bronze</Badge>
                            <p className="text-sm text-muted-foreground">Default tier for all new customers. No special discounts.</p>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                            <Badge className="text-base px-4 py-1 bg-gray-400">Silver</Badge>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Points to Reach Tier</Label>
                                <Input type="number" value={local.loyaltySettings?.tiers?.Silver?.points || ''} onChange={(e) => handleTierSettingChange('Silver', 'points', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Discount Percentage</Label>
                                <Input type="number" value={local.loyaltySettings?.tiers?.Silver?.discount || ''} onChange={(e) => handleTierSettingChange('Silver', 'discount', e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg">
                        <div className="flex items-center gap-2">
                            <Badge className="text-base px-4 py-1 bg-amber-500 text-white">Gold</Badge>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Points to Reach Tier</Label>
                                <Input type="number" value={local.loyaltySettings?.tiers?.Gold?.points || ''} onChange={(e) => handleTierSettingChange('Gold', 'points', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Discount Percentage</Label>
                                <Input type="number" value={local.loyaltySettings?.tiers?.Gold?.discount || ''} onChange={(e) => handleTierSettingChange('Gold', 'discount', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? 'Saving…' : 'Save Loyalty Settings'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
