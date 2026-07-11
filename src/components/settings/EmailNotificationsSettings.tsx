'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { EmailTemplateConfig, SmtpConfig } from '@/types';
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_DEPARTMENTS, CATALOG_VERSION, sendTenantEmail, verifySmtpConnection, isSmtpConfigured } from '@/lib/email';
import { format, parseISO } from 'date-fns';
import { Loader2, Mail, Send, ShieldCheck, Pencil } from '@/components/icons';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const EMAIL_LOG_COLUMNS: ColumnDef[] = [
  { id: 'sent', label: 'Sent', locked: true },
  { id: 'department', label: 'Department' },
  { id: 'recipient', label: 'Recipient' },
  { id: 'subject', label: 'Subject' },
  { id: 'status', label: 'Status' },
];

const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  id: 'default',
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
  ccEmail: '',
};

const smtpSchema = z.object({
  enabled: z.boolean(),
  host: z.string().min(1, "SMTP host is required."),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string(),
  password: z.string(),
  fromName: z.string().min(1, "Sender name is required."),
  fromEmail: z.string().email("Invalid sender email."),
  replyTo: z.string().email("Invalid reply-to email.").or(z.literal('')),
  ccEmail: z.string().email("Invalid CC email.").or(z.literal('')),
});

type SmtpFormData = z.infer<typeof smtpSchema>;

export default function EmailNotificationsSettings() {
  const {
    smtpConfigList, setSmtpConfigList,
    emailTemplates, setEmailTemplates,
    emailLogs, saveThemeSettings,
    addActivityLog, user, isDataLoaded, companyName,
  } = useAppContext();
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateConfig | null>(null);
  const [templateDraft, setTemplateDraft] = useState({ subjectTemplate: '', bodyTemplate: '' });
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  const emailLogColumnVisibility = useColumnVisibility('email-notification-log', EMAIL_LOG_COLUMNS);
  const { isVisible: isEmailLogColVisible } = emailLogColumnVisibility;

  const savedSmtp = smtpConfigList.find(s => s.id === 'default');

  const form = useForm<SmtpFormData>({
    resolver: zodResolver(smtpSchema),
    defaultValues: { ...DEFAULT_SMTP_CONFIG, replyTo: '', ccEmail: '' },
  });

  useEffect(() => {
    if (savedSmtp) {
      form.reset({ ...DEFAULT_SMTP_CONFIG, ...savedSmtp, replyTo: savedSmtp.replyTo ?? '', ccEmail: savedSmtp.ccEmail ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSmtp?.id, isDataLoaded]);

  // One-time per-tenant seed: if no templates exist yet, populate the full default catalog
  // so admins see every trigger point immediately instead of an empty registry.
  useEffect(() => {
    if (isDataLoaded && emailTemplates.length === 0) {
      setEmailTemplates(DEFAULT_EMAIL_TEMPLATES.map(t => ({ ...t })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded, emailTemplates.length]);

  // Backfill: upgrade templates that are still on an older catalog version — this covers
  // both tenants seeded before `availableVars` existed AND tenants whose bodies predate the
  // richer branded HTML (bare <p> tags → structured shell content). A template only gets
  // auto-upgraded if the admin never opened the editor and saved it — saveTemplateEdit()
  // stamps the doc with the current CATALOG_VERSION, which permanently opts it out of
  // future auto-upgrades so a customized template is never silently overwritten.
  useEffect(() => {
    if (!isDataLoaded || emailTemplates.length === 0) return;
    const stale = emailTemplates.filter(t => (t.templateVersion ?? 0) < CATALOG_VERSION);
    if (stale.length === 0) return;
    setEmailTemplates(prev => prev.map(t => {
      if ((t.templateVersion ?? 0) >= CATALOG_VERSION) return t;
      const defaults = DEFAULT_EMAIL_TEMPLATES.find(d => d.id === t.id);
      if (!defaults) return t;
      return {
        ...t,
        subjectTemplate: defaults.subjectTemplate,
        bodyTemplate: defaults.bodyTemplate,
        availableVars: defaults.availableVars,
        templateVersion: CATALOG_VERSION,
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded, emailTemplates]);

  const currentSmtp = (): SmtpConfig => ({ id: 'default', ...form.getValues() });

  const onSubmitSmtp = (data: SmtpFormData) => {
    const settings: SmtpConfig = { id: 'default', ...data, updatedAt: new Date().toISOString(), updatedBy: user?.name };
    setSmtpConfigList(prev => {
      const others = prev.filter(s => s.id !== 'default');
      return [...others, settings];
    });
    // Non-secret visibility flag: the raw SMTP config is admin-only, so
    // staff-facing Email buttons key off this themeSettings switch instead
    // (same pattern as smsGatewayEnabled / whatsappGatewayEnabled).
    void saveThemeSettings({ emailGatewayEnabled: isSmtpConfigured(settings) });
    addActivityLog('SMTP Settings Updated', `Tenant SMTP configuration updated for host ${data.host}.`);
    toast({ title: 'Settings Saved', description: 'SMTP configuration has been saved.' });
  };

  const handleVerify = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    setIsTesting(true);
    try {
      await verifySmtpConnection(currentSmtp());
      toast({ title: 'Connection Verified', description: 'Successfully connected and authenticated with the SMTP server.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Connection Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTest = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    if (!testRecipient) {
      toast({ variant: 'destructive', title: 'Recipient Required', description: 'Enter an email address to send the test to.' });
      return;
    }
    setIsSendingTest(true);
    try {
      await sendTenantEmail(currentSmtp(), {
        to: testRecipient,
        subject: `${companyName || 'CZium'} — SMTP test email`,
        html: '<p>This is a test email from your ERP system. Your SMTP configuration is working correctly. ✅</p>',
        text: 'This is a test email from your ERP system. Your SMTP configuration is working correctly.',
      });
      toast({ title: 'Test Email Sent', description: `A test email was sent to ${testRecipient}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Test Email Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleToggleTemplate = (template: EmailTemplateConfig, checked: boolean) => {
    setEmailTemplates(prev => prev.map(t => t.id === template.id ? { ...t, enabled: checked, updatedAt: new Date().toISOString(), updatedBy: user?.name } : t));
  };

  const openEditor = (template: EmailTemplateConfig) => {
    setEditingTemplate(template);
    setTemplateDraft({ subjectTemplate: template.subjectTemplate, bodyTemplate: template.bodyTemplate });
    setActiveField('body');
  };

  const insertVar = (varName: string) => {
    const token = `{{${varName}}}`;
    if (activeField === 'subject') {
      const el = subjectInputRef.current;
      const start = el?.selectionStart ?? templateDraft.subjectTemplate.length;
      const end = el?.selectionEnd ?? templateDraft.subjectTemplate.length;
      setTemplateDraft(prev => ({ ...prev, subjectTemplate: prev.subjectTemplate.slice(0, start) + token + prev.subjectTemplate.slice(end) }));
    } else {
      const el = bodyTextareaRef.current;
      const start = el?.selectionStart ?? templateDraft.bodyTemplate.length;
      const end = el?.selectionEnd ?? templateDraft.bodyTemplate.length;
      setTemplateDraft(prev => ({ ...prev, bodyTemplate: prev.bodyTemplate.slice(0, start) + token + prev.bodyTemplate.slice(end) }));
    }
  };

  const saveTemplateEdit = () => {
    if (!editingTemplate) return;
    setEmailTemplates(prev => prev.map(t => t.id === editingTemplate.id
      ? {
          ...t,
          subjectTemplate: templateDraft.subjectTemplate,
          bodyTemplate: templateDraft.bodyTemplate,
          // Stamping the current catalog version marks this template as admin-customized,
          // so future catalog content upgrades never silently overwrite this edit.
          templateVersion: CATALOG_VERSION,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.name,
        }
      : t));
    toast({ title: 'Template Updated', description: `${editingTemplate.label} has been saved.` });
    setEditingTemplate(null);
  };

  const templatesByDepartment = useMemo(() => {
    const map = new Map<string, EmailTemplateConfig[]>();
    for (const dept of EMAIL_DEPARTMENTS) map.set(dept, []);
    for (const t of emailTemplates) {
      if (!map.has(t.department)) map.set(t.department, []);
      map.get(t.department)!.push(t);
    }
    return map;
  }, [emailTemplates]);

  const sortedLogs = [...emailLogs].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 50);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <CardTitle>SMTP Server</CardTitle>
          </div>
          <CardDescription>
            One outgoing mail server for the entire organization. Used by every module below —
            configure it once here. Only tenant administrators can view or change these credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitSmtp)} className="space-y-4">
              <FormField control={form.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Enable Outgoing Email</FormLabel>
                    <FormDescription>Master switch — no notification email is sent anywhere while disabled.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="host" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>SMTP Host</FormLabel><FormControl><Input {...field} placeholder="smtp.example.com" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="port" render={({ field }) => (
                  <FormItem><FormLabel>Port</FormLabel><FormControl><Input type="number" {...field} placeholder="587" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="secure" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Use Implicit TLS (SSL)</FormLabel>
                    <FormDescription>Enable for port 465. Leave off for STARTTLS on port 587.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} autoComplete="off" placeholder="apikey / user@example.com" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} autoComplete="new-password" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="fromName" render={({ field }) => (
                  <FormItem><FormLabel>Sender Name</FormLabel><FormControl><Input {...field} placeholder="Acme Inc." /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="fromEmail" render={({ field }) => (
                  <FormItem><FormLabel>Sender Email</FormLabel><FormControl><Input type="email" {...field} placeholder="notifications@example.com" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="replyTo" render={({ field }) => (
                  <FormItem><FormLabel>Reply-To (optional)</FormLabel><FormControl><Input type="email" {...field} placeholder="support@example.com" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="ccEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>CC all notifications to (optional)</FormLabel>
                  <FormDescription>Every email sent by every department — vendors, invoices, tickets, HR, etc. — will be CC&apos;d to this address.</FormDescription>
                  <FormControl><Input type="email" {...field} placeholder="ops@example.com" className="max-w-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button type="submit">Save SMTP Settings</Button>
                <Button type="button" variant="outline" onClick={handleVerify} disabled={isTesting} className="gap-1">
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Test Connection
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium mb-2">Send a test email</p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="bg-secondary"
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
          <CardTitle>Notification Templates</CardTitle>
          <CardDescription>
            Enable or disable each automated email per department. Disabled templates never send,
            even if the SMTP server above is on. Click Edit to customize the subject and body.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {EMAIL_DEPARTMENTS.map(dept => {
              const templates = templatesByDepartment.get(dept) ?? [];
              const enabledCount = templates.filter(t => t.enabled).length;
              return (
                <AccordionItem key={dept} value={dept}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span>{dept}</span>
                      <Badge variant="secondary">{enabledCount}/{templates.length} enabled</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates in this department yet.</p>}
                      {templates.map(template => (
                        <div key={template.id} className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
                          <div className="space-y-1">
                            <Label className="text-base">{template.label}</Label>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                            {!!template.availableVars?.length && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {template.availableVars.map(v => (
                                  <code key={v} className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{`{{${v}}}`}</code>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button type="button" variant="ghost" size="icon" onClick={() => openEditor(template)} aria-label={`Edit ${template.label}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Switch checked={template.enabled} onCheckedChange={(checked) => handleToggleTemplate(template, checked)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Email Log</CardTitle>
              <CardDescription>The 50 most recent notification emails sent across all departments.</CardDescription>
            </div>
            <ColumnVisibilityMenu visibility={emailLogColumnVisibility} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                {isEmailLogColVisible('department') && <TableHead>Department</TableHead>}
                {isEmailLogColVisible('recipient') && <TableHead className="hidden md:table-cell">Recipient</TableHead>}
                {isEmailLogColVisible('subject') && <TableHead className="hidden lg:table-cell">Subject</TableHead>}
                {isEmailLogColVisible('status') && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No emails sent yet.</TableCell></TableRow>
              )}
              {sortedLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{format(parseISO(log.sentAt), 'MMM d, yyyy HH:mm')}</TableCell>
                  {isEmailLogColVisible('department') && <TableCell>{log.department}</TableCell>}
                  {isEmailLogColVisible('recipient') && <TableCell className="hidden md:table-cell">{log.to}</TableCell>}
                  {isEmailLogColVisible('subject') && <TableCell className="hidden lg:table-cell max-w-[280px] truncate">{log.subject}</TableCell>}
                  {isEmailLogColVisible('status') && (
                  <TableCell>
                    <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} title={log.error}>
                      {log.status === 'sent' ? 'Sent' : 'Failed'}
                    </Badge>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template — {editingTemplate?.label}</DialogTitle>
            <DialogDescription>
              Use <code>{'{{placeholder}}'}</code> tokens for dynamic values. The body supports basic HTML.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!!editingTemplate?.availableVars?.length && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Available variables for this email — click to insert into the field you last clicked:</p>
                <div className="flex flex-wrap gap-1.5">
                  {editingTemplate.availableVars.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVar(v)}
                      className="text-xs rounded bg-background border px-2 py-1 font-mono hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                ref={subjectInputRef}
                value={templateDraft.subjectTemplate}
                onFocus={() => setActiveField('subject')}
                onChange={(e) => setTemplateDraft(prev => ({ ...prev, subjectTemplate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Body (HTML)</Label>
              <Textarea
                ref={bodyTextareaRef}
                rows={8}
                value={templateDraft.bodyTemplate}
                onFocus={() => setActiveField('body')}
                onChange={(e) => setTemplateDraft(prev => ({ ...prev, bodyTemplate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={saveTemplateEdit}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
