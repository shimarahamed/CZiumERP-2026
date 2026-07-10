
'use client';

import { usePageTitle } from '@/hooks/use-page-title';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import { useAppContext } from "@/context/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb } from '@/components/Breadcrumb';
import CompanyBrandingSettings from '@/components/settings/CompanyBrandingSettings';
import FinancialRegionalSettings from '@/components/settings/FinancialRegionalSettings';
import LoyaltySettings from '@/components/settings/LoyaltySettings';
import ModulesSettings from '@/components/settings/ModulesSettings';
import DataPrivacySettings from '@/components/settings/DataPrivacySettings';
import DeveloperSettings from '@/components/settings/DeveloperSettings';
import EmailNotificationsSettings from '@/components/settings/EmailNotificationsSettings';
import ApiWebhooksSettings from '@/components/settings/ApiWebhooksSettings';
import Link from 'next/link';
import { Shield, ClipboardList, Upload } from '@/components/icons';

const moreSettingsLinks = [
    { href: '/settings/roles', label: 'Custom Roles', description: 'Fine-tune permissions beyond the base roles.', icon: Shield },
    { href: '/settings/custom-fields', label: 'Custom Fields', description: 'Add extra fields to records across the app.', icon: ClipboardList },
    { href: '/settings/import', label: 'Bulk Import', description: 'Import records in bulk from a spreadsheet.', icon: Upload },
];

export default function SettingsPage() {
    usePageTitle('Settings');
    const { user } = useAppContext();
    const canManage = user?.role === 'admin';

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You must be an administrator to access this page.</p></CardContent></Card></main>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Settings" />
            <Breadcrumb items={[{ label: 'System', href: '/users' }, { label: 'Settings' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Tabs defaultValue="company-branding" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 h-auto">
                        <TabsTrigger value="company-branding">Company & Branding</TabsTrigger>
                        <TabsTrigger value="financial-regional">Financial & Regional</TabsTrigger>
                        <TabsTrigger value="loyalty">Loyalty Program</TabsTrigger>
                        <TabsTrigger value="modules">Modules</TabsTrigger>
                        <TabsTrigger value="email-notifications">Email & Notifications</TabsTrigger>
                        <TabsTrigger value="data-privacy">Data & Privacy</TabsTrigger>
                        <TabsTrigger value="api-webhooks">API & Webhooks</TabsTrigger>
                        <TabsTrigger value="developer">Developer</TabsTrigger>
                    </TabsList>
                    <TabsContent value="company-branding">
                        <CompanyBrandingSettings />
                    </TabsContent>
                    <TabsContent value="financial-regional">
                        <FinancialRegionalSettings />
                    </TabsContent>
                    <TabsContent value="loyalty">
                        <LoyaltySettings />
                    </TabsContent>
                    <TabsContent value="modules">
                        <ModulesSettings />
                    </TabsContent>
                    <TabsContent value="email-notifications">
                        <EmailNotificationsSettings />
                    </TabsContent>
                    <TabsContent value="data-privacy">
                        <DataPrivacySettings />
                    </TabsContent>
                    <TabsContent value="api-webhooks">
                        <Card>
                            <CardHeader>
                                <CardTitle>API & Webhooks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ApiWebhooksSettings />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="developer">
                        <DeveloperSettings />
                    </TabsContent>
                </Tabs>

                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="text-base">More Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {moreSettingsLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted"
                            >
                                <link.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">{link.label}</p>
                                    <p className="text-xs text-muted-foreground">{link.description}</p>
                                </div>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
