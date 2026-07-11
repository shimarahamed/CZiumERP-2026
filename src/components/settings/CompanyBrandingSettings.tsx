'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { ThemeSettings } from '@/types';
import { PRESET_PALETTES, primaryReadable } from '@/lib/palettes';
import { hexToHsl, hslToHex } from '@/lib/color-utils';
import Image from 'next/image';
import { Loader2 } from '@/components/icons';

const ColorPicker = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <div className="grid w-full items-center gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
            <Input type="color" value={hslToHex(value)} onChange={(e) => onChange(hexToHsl(e.target.value))} className="w-12 h-10 p-1" />
            <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    </div>
);

export default function CompanyBrandingSettings() {
    const { themeSettings, saveThemeSettings, addActivityLog, user } = useAppContext();
    const { toast } = useToast();
    const canManage = user?.role === 'admin';

    const [local, setLocal] = useState<ThemeSettings>(themeSettings);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // 'minimal' was renamed to 'lined' (boxed/ruled redesign) — migrate any
        // tenant doc still holding the old value so the picker highlights correctly.
        const template = themeSettings.invoiceTemplate as string | undefined;
        setLocal(template === 'minimal' ? { ...themeSettings, invoiceTemplate: 'lined' } : themeSettings);
    }, [themeSettings]);

    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        // Upload security: restrict to real image types and a sane size —
        // the logo is stored as a data URL inside the settings document.
        const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        const MAX_BYTES = 512 * 1024; // 512KB keeps the settings doc well under Firestore's 1MB limit
        if (!ALLOWED.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Unsupported file type', description: 'Use a PNG, JPEG, WebP, or SVG image.' });
            event.target.value = '';
            return;
        }
        if (file.size > MAX_BYTES) {
            toast({ variant: 'destructive', title: 'Logo too large', description: 'Please use an image under 512KB.' });
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setLocal(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!canManage) {
            toast({ variant: 'destructive', title: 'Permission Denied' });
            return;
        }
        setIsSaving(true);
        try {
            await saveThemeSettings(local);
            addActivityLog('Settings Updated', 'Company & Branding settings were updated.');
            toast({ title: 'Company & Branding Saved', description: 'Your changes have been saved.' });
        } catch {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save your changes. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader><CardTitle>Company & Branding</CardTitle><CardDescription>Manage your organization&apos;s global information and appearance.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="company-name">Company Name</Label>
                        <Input id="company-name" value={local.companyName ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, companyName: e.target.value }))} />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="company-website">Website</Label>
                        <Input id="company-website" placeholder="https://example.com" value={local.companyWebsite ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, companyWebsite: e.target.value }))} />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="company-phone">Phone Number</Label>
                        <Input id="company-phone" placeholder="+1 555 000 0000" value={local.companyPhone ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, companyPhone: e.target.value }))} />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="company-email">Business Email</Label>
                        <Input id="company-email" type="email" placeholder="contact@example.com" value={local.companyEmail ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, companyEmail: e.target.value }))} />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="tax-registration">Tax Registration Number</Label>
                        <Input id="tax-registration" value={local.taxRegistrationNumber ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, taxRegistrationNumber: e.target.value }))} />
                    </div>
                    <div className="grid w-full items-center gap-2">
                        <Label htmlFor="company-reg-number">Reg Number</Label>
                        <Input id="company-reg-number" placeholder="Business registration number" value={local.companyRegNumber ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, companyRegNumber: e.target.value }))} />
                        <p className="text-xs text-muted-foreground">Printed on invoices and receipts as “Reg No”.</p>
                    </div>
                </div>
                <div className="grid w-full max-w-md items-center gap-2">
                    <Label htmlFor="company-address">Company Address</Label>
                    <Textarea id="company-address" value={local.companyAddress ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, companyAddress: e.target.value }))} />
                </div>
                <div className="space-y-2">
                    <Label>Company Logo</Label>
                    <div className="flex items-center gap-4">
                        {local.logoUrl && <Image src={local.logoUrl} alt="Logo preview" width={48} height={48} className="rounded-md object-contain bg-muted p-1" />}
                        <Input id="logo-url" type="file" accept="image/*" onChange={handleLogoUpload} className="max-w-xs" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ColorPicker label="Primary Color" value={local.primaryColor} onChange={(value) => setLocal(prev => ({ ...prev, primaryColor: value }))} />
                    <ColorPicker label="Background Color" value={local.backgroundColor} onChange={(value) => setLocal(prev => ({ ...prev, backgroundColor: value }))} />
                    <ColorPicker label="Accent Color" value={local.accentColor} onChange={(value) => setLocal(prev => ({ ...prev, accentColor: value }))} />
                </div>
                <div className="space-y-2">
                    <Label>Quick Palettes (WCAG-AA safe)</Label>
                    <div className="flex flex-wrap gap-2">
                        {PRESET_PALETTES.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setLocal(prev => ({ ...prev, primaryColor: p.primaryColor, backgroundColor: p.backgroundColor, accentColor: p.accentColor }))}
                                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                                aria-label={`Apply ${p.name} palette`}
                            >
                                <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: `hsl(${p.primaryColor})` }} />
                                {p.name}
                            </button>
                        ))}
                    </div>
                    {!primaryReadable(local.primaryColor) && (
                        <p className="text-sm text-destructive">Warning: white text on this primary color fails WCAG AA contrast — buttons may be hard to read.</p>
                    )}
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                    <div>
                        <Label className="text-base">Document Templates</Label>
                        <p className="text-sm text-muted-foreground">Applies to invoices, POS receipts, and printed documents.</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Select Template</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { id: 'classic', label: 'Classic', desc: 'Logo left, bold header' },
                                    { id: 'modern', label: 'Modern', desc: 'Color banner header' },
                                    { id: 'lined', label: 'Lined', desc: 'Boxed, fully ruled table' },
                                    { id: 'thermal-receipt', label: 'POS Receipt', desc: '80mm thermal style' },
                                ] as const).map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setLocal(prev => ({ ...prev, invoiceTemplate: t.id }))}
                                        className={`rounded-md border p-2 text-left transition-colors hover:bg-muted text-sm ${(local.invoiceTemplate ?? 'classic') === t.id ? 'border-primary ring-2 ring-primary bg-primary/5' : ''}`}
                                    >
                                        <p className="font-medium text-xs">{t.label}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-1">{t.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Preview</Label>
                            <div className="border rounded-md p-3 bg-muted/30 text-xs">
                                {(local.invoiceTemplate ?? 'classic') === 'classic' && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-primary rounded-sm" />
                                            <p className="font-bold">{local.companyName || 'Company Name'}</p>
                                        </div>
                                        <p className="text-muted-foreground text-[10px]">Address line</p>
                                        <div className="mt-2 text-right">
                                            <p className="font-bold text-sm">INVOICE</p>
                                            <p className="text-muted-foreground">#INV-001</p>
                                        </div>
                                    </div>
                                )}
                                {(local.invoiceTemplate ?? 'classic') === 'modern' && (
                                    <div className="rounded p-2 text-white" style={{ backgroundColor: local.documentAccent || '#1f2937' }}>
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-sm">{local.companyName || 'Company'}</p>
                                            <p className="font-bold">INVOICE</p>
                                        </div>
                                    </div>
                                )}
                                {(local.invoiceTemplate ?? 'classic') === 'lined' && (
                                    <div className="border-2 border-black">
                                        <div className="flex justify-between p-1.5 border-b-2 border-black">
                                            <p className="font-bold">{local.companyName || 'Company'}</p>
                                            <p className="font-bold">INVOICE</p>
                                        </div>
                                        <div className="grid grid-cols-2 text-[10px]">
                                            <p className="p-1 border-r border-black">Item x1</p>
                                            <p className="p-1 text-right">$0.00</p>
                                        </div>
                                    </div>
                                )}
                                {(local.invoiceTemplate ?? 'classic') === 'thermal-receipt' && (
                                    <div className="text-center space-y-1 font-mono">
                                        <p className="font-bold text-[10px]">{local.companyName || 'Store'}</p>
                                        <p className="text-[8px] border-t border-dashed pt-1">Receipt #001</p>
                                        <p className="text-[8px]">Item x1 ........ $0.00</p>
                                        <p className="text-[8px] border-t border-dashed pt-1">TOTAL $0.00</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="doc-footer">Document footer text</Label>
                            <Input id="doc-footer" placeholder="Thank you for your business!" value={local.documentFooter ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, documentFooter: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="doc-accent">Header color (Modern template)</Label>
                            <div className="flex items-center gap-2">
                                <input id="doc-accent" type="color" className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1" value={local.documentAccent ?? '#1f2937'} onChange={(e) => setLocal(prev => ({ ...prev, documentAccent: e.target.value }))} />
                                <span className="text-sm text-muted-foreground">{local.documentAccent ?? '#1f2937'}</span>
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <Switch checked={local.showLogoOnDocuments !== false} onCheckedChange={(c) => setLocal(prev => ({ ...prev, showLogoOnDocuments: c }))} />
                        Show company logo on documents
                    </label>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? 'Saving…' : 'Save Branding'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
