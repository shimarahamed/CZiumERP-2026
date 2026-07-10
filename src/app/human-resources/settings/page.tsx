
'use client'

import { useState } from 'react';
import { useRequireRole } from '@/hooks/use-require-role';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import { sendTenantEmail, isSmtpConfigured } from '@/lib/email';
import { format, parseISO } from 'date-fns';
import { Loader2, Mail, Send, Settings as SettingsIcon } from '@/components/icons';
import Link from 'next/link';

function HrSettingsPageInner() {
  const { smtpConfigList, emailTemplates, setEmailTemplates, emailLogs, user, companyName } = useAppContext();
  const { toast } = useToast();
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const smtp = smtpConfigList.find(s => s.id === 'default');
  const onboardingTemplate = emailTemplates.find(t => t.id === 'onboarding');
  const offboardingTemplate = emailTemplates.find(t => t.id === 'offboarding');

  const toggleTemplate = (id: string, checked: boolean) => {
    setEmailTemplates(prev => prev.map(t => t.id === id ? { ...t, enabled: checked, updatedAt: new Date().toISOString(), updatedBy: user?.name } : t));
  };

  const handleSendTest = async () => {
    if (!smtp || !isSmtpConfigured(smtp)) {
      toast({ variant: 'destructive', title: 'SMTP Not Configured', description: 'Configure the outgoing mail server in Settings → Email & Notifications first.' });
      return;
    }
    if (!testRecipient) {
      toast({ variant: 'destructive', title: 'Recipient Required', description: 'Enter an email address to send the test to.' });
      return;
    }
    setIsSendingTest(true);
    try {
      await sendTenantEmail(smtp, {
        to: testRecipient,
        subject: `${companyName || 'CZium'} HR — SMTP test email`,
        html: '<p>This is a test email from your HR system. Your SMTP configuration is working correctly. ✅</p>',
        text: 'This is a test email from your HR system. Your SMTP configuration is working correctly.',
      });
      toast({ title: 'Test Email Sent', description: `A test email was sent to ${testRecipient}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Test Email Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const hrLogs = [...emailLogs]
    .filter(l => l.department === 'Human Resources')
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, 50);

  return (
    <div className="flex flex-col h-full">
      <Header title="HR Settings" />
      <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources/dashboard' }, { label: 'HR Settings' }]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <CardTitle>HR Lifecycle Emails</CardTitle>
            </div>
            <CardDescription>
              Onboarding and offboarding emails use the organization&apos;s shared outgoing mail
              server. Configure the SMTP server and edit these templates in{' '}
              <Link href="/settings" className="underline">Settings → Email &amp; Notifications</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!smtp || !isSmtpConfigured(smtp) ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center justify-between gap-4">
                <span>The organization&apos;s SMTP server is not configured or is disabled — no HR emails will be sent.</span>
                <Button asChild variant="outline" size="sm" className="gap-1 shrink-0">
                  <Link href="/settings"><SettingsIcon className="h-4 w-4" />Configure</Link>
                </Button>
              </div>
            ) : null}

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-send Onboarding Email</Label>
                <p className="text-sm text-muted-foreground">Send the welcome email automatically when onboarding an employee.</p>
              </div>
              <Switch
                checked={onboardingTemplate?.enabled ?? false}
                onCheckedChange={(checked) => toggleTemplate('onboarding', checked)}
                disabled={!onboardingTemplate}
              />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Auto-send Offboarding Email</Label>
                <p className="text-sm text-muted-foreground">Send the exit email automatically when offboarding begins.</p>
              </div>
              <Switch
                checked={offboardingTemplate?.enabled ?? false}
                onCheckedChange={(checked) => toggleTemplate('offboarding', checked)}
                disabled={!offboardingTemplate}
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Send a test email</p>
              <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm"
                />
                <Button type="button" variant="secondary" onClick={handleSendTest} disabled={isSendingTest} className="gap-1 shrink-0">
                  {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Log</CardTitle>
            <CardDescription>The 50 most recent HR emails sent from this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="hidden md:table-cell">Recipient</TableHead>
                  <TableHead className="hidden lg:table-cell">Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hrLogs.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No emails sent yet.</TableCell></TableRow>
                )}
                {hrLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(log.sentAt), 'MMM d, yyyy HH:mm')}</TableCell>
                    <TableCell className="capitalize">{log.templateId}</TableCell>
                    <TableCell className="hidden md:table-cell">{log.to}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[280px] truncate">{log.subject}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} title={log.error}>
                        {log.status === 'sent' ? 'Sent' : 'Failed'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Permission guard lives in a wrapper so all hooks inside the inner component
// run unconditionally (React rules-of-hooks).
export default function HrSettingsPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <HrSettingsPageInner />;
}
