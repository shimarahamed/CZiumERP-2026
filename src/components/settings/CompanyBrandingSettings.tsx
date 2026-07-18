'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { ThemeSettings, DocumentTemplate } from '@/types';
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

    // Shared by the company logo and the letterhead artwork uploads.
    // Upload security: restrict to real image types and a sane size —
    // both images are stored as data URLs inside the settings document.
    const makeImageUploadHandler = (field: 'logoUrl' | 'letterheadImageUrl') => (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        const MAX_BYTES = 512 * 1024; // 512KB keeps the settings doc well under Firestore's 1MB limit
        if (!ALLOWED.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Unsupported file type', description: 'Use a PNG, JPEG, WebP, or SVG image.' });
            event.target.value = '';
            return;
        }
        if (file.size > MAX_BYTES) {
            toast({ variant: 'destructive', title: 'Image too large', description: 'Please use an image under 512KB.' });
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setLocal(prev => ({ ...prev, [field]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };
    const handleLogoUpload = makeImageUploadHandler('logoUrl');
    const handleLetterheadUpload = makeImageUploadHandler('letterheadImageUrl');

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
                <div className="space-y-4 rounded-lg border p-4">
                    <div>
                        <Label className="text-base">Bank Details & Payment Terms</Label>
                        <p className="text-sm text-muted-foreground">Shown on invoices below the Grand Total whenever an invoice has a balance due (status Pending/Overdue).</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid w-full items-center gap-2">
                            <Label htmlFor="bank-name">Bank Name</Label>
                            <Input id="bank-name" value={local.bankName ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, bankName: e.target.value }))} />
                        </div>
                        <div className="grid w-full items-center gap-2">
                            <Label htmlFor="bank-account-name">Account Name</Label>
                            <Input id="bank-account-name" value={local.bankAccountName ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, bankAccountName: e.target.value }))} />
                        </div>
                        <div className="grid w-full items-center gap-2">
                            <Label htmlFor="bank-account-number">Account Number</Label>
                            <Input id="bank-account-number" value={local.bankAccountNumber ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, bankAccountNumber: e.target.value }))} />
                        </div>
                        <div className="grid w-full items-center gap-2">
                            <Label htmlFor="bank-iban-swift">IBAN / SWIFT</Label>
                            <Input id="bank-iban-swift" value={local.bankIbanSwift ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, bankIbanSwift: e.target.value }))} />
                        </div>
                        <div className="grid w-full items-center gap-2">
                            <Label htmlFor="bank-branch">Branch</Label>
                            <Input id="bank-branch" value={local.bankBranch ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, bankBranch: e.target.value }))} />
                        </div>
                        <div className="grid w-full items-center gap-2">
                            <Label htmlFor="payment-due-days">Pay By (days after invoice date)</Label>
                            <Input id="payment-due-days" type="number" min={0} placeholder="e.g. 30" value={local.defaultPaymentDueDays ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, defaultPaymentDueDays: e.target.value ? Number(e.target.value) : undefined }))} />
                            <p className="text-xs text-muted-foreground">Used to set a new invoice&apos;s due date automatically.</p>
                        </div>
                    </div>
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
                        <p className="text-sm text-muted-foreground">Choose a layout for each document type separately.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Invoice</Label>
                            <Select value={local.invoiceTemplate ?? 'classic'} onValueChange={(v) => setLocal(prev => ({ ...prev, invoiceTemplate: v as DocumentTemplate }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="classic">Classic — logo left, bold header</SelectItem>
                                    <SelectItem value="modern">Modern — color banner header</SelectItem>
                                    <SelectItem value="lined">Lined — boxed, fully ruled table</SelectItem>
                                    <SelectItem value="letterhead">Letterhead — custom header + watermark</SelectItem>
                                    <SelectItem value="thermal-receipt">POS Receipt — 80mm thermal style</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Purchase Order</Label>
                            <Select value={local.purchaseOrderTemplate ?? 'classic'} onValueChange={(v) => setLocal(prev => ({ ...prev, purchaseOrderTemplate: v as DocumentTemplate }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="classic">Classic — logo left, bold header</SelectItem>
                                    <SelectItem value="modern">Modern — color banner header</SelectItem>
                                    <SelectItem value="lined">Lined — boxed, fully ruled table</SelectItem>
                                    <SelectItem value="letterhead">Letterhead — custom header + watermark</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">POS Receipt</Label>
                            <Select value={local.receiptTemplate ?? 'thermal-receipt'} onValueChange={(v) => setLocal(prev => ({ ...prev, receiptTemplate: v as DocumentTemplate }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="thermal-receipt">Thermal — 80mm slip</SelectItem>
                                    <SelectItem value="letterhead">Letterhead — slip with header artwork + watermark</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">RFQ</Label>
                            <Select value={local.rfqTemplate ?? 'classic'} onValueChange={(v) => setLocal(prev => ({ ...prev, rfqTemplate: v as DocumentTemplate }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="classic">Classic — logo left, bold header</SelectItem>
                                    <SelectItem value="modern">Modern — color banner header</SelectItem>
                                    <SelectItem value="lined">Lined — boxed, fully ruled table</SelectItem>
                                    <SelectItem value="letterhead">Letterhead — custom header + watermark</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Applies once RFQ printing is available.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Invoice Preview</Label>
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
                                {(local.invoiceTemplate ?? 'classic') === 'letterhead' && (
                                    <div className="relative space-y-1 overflow-hidden">
                                        {local.logoUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={local.logoUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 m-auto w-2/5 max-h-[60%] object-contain opacity-[0.05]" />
                                        )}
                                        <div className="flex justify-between items-center gap-2 pb-1 border-b-2" style={{ borderColor: local.documentAccent || '#1f2937' }}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-5 h-5 bg-primary rounded-sm shrink-0" />
                                                {local.letterheadImageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={local.letterheadImageUrl} alt="Letterhead" className="h-10 w-auto object-contain" />
                                                ) : (
                                                    <p className="font-bold truncate" style={{ color: local.documentAccent || '#1f2937' }}>{local.letterheadText || local.companyName || 'Your Wordings'}</p>
                                                )}
                                            </div>
                                            <div className="text-right text-[8px] text-muted-foreground shrink-0">
                                                <p>Address</p>
                                                <p>Tel: 000 000</p>
                                                <p>Email: hi@co.com</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <p className="font-bold">INVOICE #INV-001</p>
                                            <p className="text-muted-foreground">Date · Status</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-3 rounded-md border p-3">
                            <div>
                                <Label className="text-sm font-medium">Letterhead Template</Label>
                                <p className="text-xs text-muted-foreground">Used when a document above is set to “Letterhead”. The uploaded header artwork (or custom wordings) shows big right next to your company logo and replaces the company name text; company details move to the right side of the page.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="letterhead-image" className="text-xs">Header artwork</Label>
                                <div className="flex items-center gap-3">
                                    {local.letterheadImageUrl && (
                                        <Image src={local.letterheadImageUrl} alt="Letterhead preview" width={96} height={40} className="h-10 w-auto rounded-md object-contain bg-muted p-1" />
                                    )}
                                    <Input id="letterhead-image" type="file" accept="image/*" onChange={handleLetterheadUpload} className="max-w-xs" />
                                    {local.letterheadImageUrl && (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setLocal(prev => ({ ...prev, letterheadImageUrl: '' }))}>Remove</Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="letterhead-text" className="text-xs">Header wordings (used when no artwork is uploaded)</Label>
                                <Input id="letterhead-text" placeholder="e.g. AL-SAFA TRADING & SERVICES" value={local.letterheadText ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, letterheadText: e.target.value }))} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <Switch checked={local.letterheadWatermark !== false} onCheckedChange={(c) => setLocal(prev => ({ ...prev, letterheadWatermark: c }))} />
                                Show big logo watermark behind the page
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="doc-footer">Document footer text</Label>
                            <Input id="doc-footer" placeholder="Thank you for your business!" value={local.documentFooter ?? ''} onChange={(e) => setLocal(prev => ({ ...prev, documentFooter: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="doc-accent">Accent color (Modern banner & Letterhead rule)</Label>
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
