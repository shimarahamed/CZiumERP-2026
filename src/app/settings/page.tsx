
'use client';

import { useState } from 'react';
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
import BackupSettings from '@/components/settings/BackupSettings';
import DeveloperSettings from '@/components/settings/DeveloperSettings';
import EmailNotificationsSettings from '@/components/settings/EmailNotificationsSettings';
import SmsWhatsappSettings from '@/components/settings/SmsWhatsappSettings';
import ApiWebhooksSettings from '@/components/settings/ApiWebhooksSettings';
import { cn } from '@/lib/utils';
import {
    Building2, Wallet, Mail, PlugZap,
} from '@/components/icons';
import type { LucideIcon } from 'lucide-react';

type SettingsGroup = {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    tabs: { value: string; label: string; content: React.ReactNode }[];
};

const groups: SettingsGroup[] = [
    {
        id: 'organization',
        label: 'Organization',
        description: 'Branding, regional defaults, and which modules are enabled for this tenant.',
        icon: Building2,
        tabs: [
            { value: 'company-branding', label: 'Company & Branding', content: <CompanyBrandingSettings /> },
            { value: 'financial-regional', label: 'Financial & Regional', content: <FinancialRegionalSettings /> },
            { value: 'modules', label: 'Modules', content: <ModulesSettings /> },
        ],
    },
    {
        id: 'sales',
        label: 'Sales & Loyalty',
        description: 'Customer-facing programs like loyalty tiers and rewards.',
        icon: Wallet,
        tabs: [
            { value: 'loyalty', label: 'Loyalty Program', content: <LoyaltySettings /> },
        ],
    },
    {
        id: 'communications',
        label: 'Communications',
        description: 'Outbound email, SMS, and WhatsApp channels used across the app.',
        icon: Mail,
        tabs: [
            { value: 'email-notifications', label: 'Email & Notifications', content: <EmailNotificationsSettings /> },
            { value: 'sms-whatsapp', label: 'SMS & WhatsApp', content: <SmsWhatsappSettings /> },
        ],
    },
    {
        id: 'advanced',
        label: 'Data & Developer',
        description: 'Data exports, API access, webhooks, and sync behavior for developers.',
        icon: PlugZap,
        tabs: [
            { value: 'data-privacy', label: 'Data & Privacy', content: <DataPrivacySettings /> },
            { value: 'backups', label: 'Backups', content: <BackupSettings /> },
            {
                value: 'api-webhooks', label: 'API & Webhooks', content: (
                    <Card>
                        <CardHeader>
                            <CardTitle>API & Webhooks</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ApiWebhooksSettings />
                        </CardContent>
                    </Card>
                )
            },
            { value: 'developer', label: 'Developer', content: <DeveloperSettings /> },
        ],
    },
];

export default function SettingsPage() {
    usePageTitle('Settings');
    const { user } = useAppContext();
    const canManage = user?.role === 'admin';
    const [activeGroup, setActiveGroup] = useState(groups[0].id);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You must be an administrator to access this page.</p></CardContent></Card></main>
            </div>
        );
    }

    const current = groups.find(g => g.id === activeGroup) ?? groups[0];

    return (
        <div className="flex flex-col h-full">
            <Header title="Settings" />
            <Breadcrumb items={[{ label: 'System', href: '/users' }, { label: 'Settings' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Group sidebar */}
                    <nav className="lg:w-56 shrink-0">
                        <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => setActiveGroup(group.id)}
                                    className={cn(
                                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left whitespace-nowrap transition-colors",
                                        activeGroup === group.id
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <group.icon className="h-4 w-4 shrink-0" />
                                    {group.label}
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* Active group content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground mb-4">{current.description}</p>
                        {current.tabs.length > 1 ? (
                            <Tabs defaultValue={current.tabs[0].value} className="w-full">
                                <TabsList className="flex-wrap h-auto">
                                    {current.tabs.map(tab => (
                                        <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                                    ))}
                                </TabsList>
                                {current.tabs.map(tab => (
                                    <TabsContent key={tab.value} value={tab.value}>
                                        {tab.content}
                                    </TabsContent>
                                ))}
                            </Tabs>
                        ) : (
                            current.tabs[0].content
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
