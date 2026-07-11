'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import type { SmsConfig, WhatsappConfig } from '@/types';
import { verifySmsGateway, verifyWhatsappCredentials, sendTenantSms, sendTenantWhatsapp } from '@/lib/messaging';
import { format, parseISO } from 'date-fns';
import { Loader2, MessageSquare, Send, ShieldCheck } from '@/components/icons';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const MESSAGE_LOG_COLUMNS: ColumnDef[] = [
  { id: 'sentAt', label: 'Sent', locked: true },
  { id: 'channel', label: 'Channel' },
  { id: 'recipient', label: 'Recipient' },
  { id: 'message', label: 'Message' },
  { id: 'status', label: 'Status' },
];

const DEFAULT_SMS_CONFIG: SmsConfig = { id: 'default', enabled: false, provider: 'generic', gatewayUrl: '', apiKey: '', senderId: '', deviceId: '' };
const DEFAULT_WHATSAPP_CONFIG: WhatsappConfig = { id: 'default', enabled: false, phoneNumberId: '', accessToken: '', businessAccountId: '' };

const smsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['generic', 'textbee']),
  gatewayUrl: z.string(),
  apiKey: z.string(),
  senderId: z.string(),
  deviceId: z.string(),
}).superRefine((data, ctx) => {
  if (!data.enabled) return;
  if (!data.apiKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'API key is required.', path: ['apiKey'] });
  }
  if (data.provider === 'textbee') {
    if (!data.deviceId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Device ID is required.', path: ['deviceId'] });
  } else if (!data.gatewayUrl || !/^https?:\/\/.+/.test(data.gatewayUrl)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid gateway URL.', path: ['gatewayUrl'] });
  }
});
type SmsFormData = z.infer<typeof smsSchema>;

const whatsappSchema = z.object({
  enabled: z.boolean(),
  phoneNumberId: z.string(),
  accessToken: z.string(),
  businessAccountId: z.string(),
}).superRefine((data, ctx) => {
  if (!data.enabled) return;
  if (!data.phoneNumberId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phone number ID is required.', path: ['phoneNumberId'] });
  }
  if (!data.accessToken) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Access token is required.', path: ['accessToken'] });
  }
});
type WhatsappFormData = z.infer<typeof whatsappSchema>;

export default function SmsWhatsappSettings() {
  const {
    smsConfigList, setSmsConfigList,
    whatsappConfigList, setWhatsappConfigList,
    messageLogs,
    addActivityLog, user, isDataLoaded, themeSettings, saveThemeSettings,
  } = useAppContext();
  const { toast } = useToast();

  const [isTestingSms, setIsTestingSms] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [testSmsRecipient, setTestSmsRecipient] = useState('');

  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);
  const [isSendingTestWhatsapp, setIsSendingTestWhatsapp] = useState(false);
  const [testWhatsappRecipient, setTestWhatsappRecipient] = useState('');
  const columnVisibility = useColumnVisibility('message-log', MESSAGE_LOG_COLUMNS);
  const { isVisible } = columnVisibility;

  const savedSms = smsConfigList.find(s => s.id === 'default');
  const savedWhatsapp = whatsappConfigList.find(w => w.id === 'default');

  const smsForm = useForm<SmsFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: DEFAULT_SMS_CONFIG,
  });
  const whatsappForm = useForm<WhatsappFormData>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: { ...DEFAULT_WHATSAPP_CONFIG, businessAccountId: '' },
  });
  const smsProvider = useWatch({ control: smsForm.control, name: 'provider' });

  useEffect(() => {
    smsForm.reset({
      ...DEFAULT_SMS_CONFIG,
      ...savedSms,
      enabled: themeSettings.smsGatewayEnabled ?? savedSms?.enabled ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSms?.id, isDataLoaded, themeSettings.smsGatewayEnabled]);

  useEffect(() => {
    whatsappForm.reset({
      ...DEFAULT_WHATSAPP_CONFIG,
      ...savedWhatsapp,
      enabled: themeSettings.whatsappGatewayEnabled ?? savedWhatsapp?.enabled ?? false,
      businessAccountId: savedWhatsapp?.businessAccountId ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedWhatsapp?.id, isDataLoaded, themeSettings.whatsappGatewayEnabled]);

  const currentSms = (): SmsConfig => ({ id: 'default', ...smsForm.getValues() });
  const currentWhatsapp = (): WhatsappConfig => ({ id: 'default', ...whatsappForm.getValues() });

  const onSubmitSms = async (data: SmsFormData) => {
    const settings: SmsConfig = { id: 'default', ...data, updatedAt: new Date().toISOString(), updatedBy: user?.name };
    setSmsConfigList(prev => [...prev.filter(s => s.id !== 'default'), settings]);
    await saveThemeSettings({ smsGatewayEnabled: data.enabled });
    addActivityLog('SMS Settings Updated', `Tenant SMS gateway configuration updated (${data.gatewayUrl}).`);
    toast({ title: 'Settings Saved', description: 'SMS gateway configuration has been saved.' });
  };

  const onSubmitWhatsapp = async (data: WhatsappFormData) => {
    const settings: WhatsappConfig = { id: 'default', ...data, updatedAt: new Date().toISOString(), updatedBy: user?.name };
    setWhatsappConfigList(prev => [...prev.filter(w => w.id !== 'default'), settings]);
    await saveThemeSettings({ whatsappGatewayEnabled: data.enabled });
    addActivityLog('WhatsApp Settings Updated', `Tenant WhatsApp Cloud API configuration updated.`);
    toast({ title: 'Settings Saved', description: 'WhatsApp configuration has been saved.' });
  };

  const handleVerifySms = async () => {
    const valid = await smsForm.trigger();
    if (!valid) return;
    setIsTestingSms(true);
    try {
      await verifySmsGateway(currentSms());
      toast({ title: 'Gateway Reachable', description: 'Successfully connected to the SMS gateway.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Connection Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsTestingSms(false);
    }
  };

  const handleSendTestSms = async () => {
    const valid = await smsForm.trigger();
    if (!valid) return;
    if (!testSmsRecipient) {
      toast({ variant: 'destructive', title: 'Recipient Required', description: 'Enter a phone number to send the test to.' });
      return;
    }
    setIsSendingTestSms(true);
    try {
      await sendTenantSms(currentSms(), { to: testSmsRecipient, text: 'This is a test SMS from your ERP system. Your SMS gateway is working correctly.' });
      toast({ title: 'Test SMS Sent', description: `A test SMS was sent to ${testSmsRecipient}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Test SMS Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleVerifyWhatsapp = async () => {
    const valid = await whatsappForm.trigger();
    if (!valid) return;
    setIsTestingWhatsapp(true);
    try {
      await verifyWhatsappCredentials(currentWhatsapp());
      toast({ title: 'Credentials Verified', description: 'Successfully verified WhatsApp Cloud API credentials.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Verification Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsTestingWhatsapp(false);
    }
  };

  const handleSendTestWhatsapp = async () => {
    const valid = await whatsappForm.trigger();
    if (!valid) return;
    if (!testWhatsappRecipient) {
      toast({ variant: 'destructive', title: 'Recipient Required', description: 'Enter a phone number (with country code) to send the test to.' });
      return;
    }
    setIsSendingTestWhatsapp(true);
    try {
      await sendTenantWhatsapp(currentWhatsapp(), { to: testWhatsappRecipient, text: 'This is a test WhatsApp message from your ERP system. Your WhatsApp configuration is working correctly.' });
      toast({ title: 'Test Message Sent', description: `A test WhatsApp message was sent to ${testWhatsappRecipient}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Test Message Failed', description: error instanceof Error ? error.message : 'Unknown error.' });
    } finally {
      setIsSendingTestWhatsapp(false);
    }
  };

  const sortedLogs = [...messageLogs].sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 50);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>SMS Gateway</CardTitle>
          </div>
          <CardDescription>
            A generic HTTP SMS gateway (works with most aggregators). Used whenever a user sends an SMS from an
            invoice or reminder. Only tenant administrators can view or change these credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit(onSubmitSms)} className="space-y-4">
              <FormField control={smsForm.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Enable Outgoing SMS</FormLabel>
                    <FormDescription>Master switch — no SMS is sent anywhere while disabled.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={smsForm.control} name="provider" render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="generic">Generic HTTP gateway</SelectItem>
                      <SelectItem value="textbee">TextBee (Android SMS gateway)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === 'textbee'
                      ? 'Sends via api.textbee.dev using your API key and device ID.'
                      : 'Posts to any custom HTTP endpoint with a Bearer token.'}
                  </FormDescription>
                </FormItem>
              )} />

              {smsProvider === 'textbee' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={smsForm.control} name="apiKey" render={({ field }) => (
                    <FormItem><FormLabel>API Key</FormLabel><FormControl><Input type="password" {...field} autoComplete="off" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={smsForm.control} name="deviceId" render={({ field }) => (
                    <FormItem><FormLabel>Device ID</FormLabel><FormControl><Input {...field} placeholder="e.g. 66f1a2b3c4d5e6f7a8b9c0d1" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              ) : (
                <>
                  <FormField control={smsForm.control} name="gatewayUrl" render={({ field }) => (
                    <FormItem><FormLabel>Gateway URL</FormLabel><FormControl><Input {...field} placeholder="https://api.your-sms-gateway.com/send" /></FormControl><FormMessage /></FormItem>
                  )} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={smsForm.control} name="apiKey" render={({ field }) => (
                      <FormItem><FormLabel>API Key</FormLabel><FormControl><Input type="password" {...field} autoComplete="off" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={smsForm.control} name="senderId" render={({ field }) => (
                      <FormItem><FormLabel>Sender ID (optional)</FormLabel><FormControl><Input {...field} placeholder="Acme" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button type="submit">Save SMS Settings</Button>
                <Button type="button" variant="outline" onClick={handleVerifySms} disabled={isTestingSms} className="gap-1">
                  {isTestingSms ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Test Connection
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium mb-2">Send a test SMS</p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <Input
                type="tel"
                placeholder="+15551234567"
                value={testSmsRecipient}
                onChange={(e) => setTestSmsRecipient(e.target.value)}
                className="bg-secondary"
              />
              <Button type="button" variant="secondary" onClick={handleSendTestSms} disabled={isSendingTestSms} className="gap-1 shrink-0">
                {isSendingTestSms ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>WhatsApp Business (Meta Cloud API)</CardTitle>
          </div>
          <CardDescription>
            Sends invoices and messages via the official Meta WhatsApp Business Cloud API. Requires a Phone Number ID
            and a permanent access token from your Meta developer app. Only tenant administrators can view or change these credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...whatsappForm}>
            <form onSubmit={whatsappForm.handleSubmit(onSubmitWhatsapp)} className="space-y-4">
              <FormField control={whatsappForm.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Enable Outgoing WhatsApp</FormLabel>
                    <FormDescription>Master switch — no WhatsApp message is sent anywhere while disabled.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={whatsappForm.control} name="phoneNumberId" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number ID</FormLabel><FormControl><Input {...field} placeholder="1234567890123456" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={whatsappForm.control} name="businessAccountId" render={({ field }) => (
                  <FormItem><FormLabel>Business Account ID (optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={whatsappForm.control} name="accessToken" render={({ field }) => (
                <FormItem><FormLabel>Access Token</FormLabel><FormControl><Input type="password" {...field} autoComplete="off" /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button type="submit">Save WhatsApp Settings</Button>
                <Button type="button" variant="outline" onClick={handleVerifyWhatsapp} disabled={isTestingWhatsapp} className="gap-1">
                  {isTestingWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Test Connection
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium mb-2">Send a test WhatsApp message</p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <Input
                type="tel"
                placeholder="15551234567 (with country code, no +)"
                value={testWhatsappRecipient}
                onChange={(e) => setTestWhatsappRecipient(e.target.value)}
                className="bg-secondary"
              />
              <Button type="button" variant="secondary" onClick={handleSendTestWhatsapp} disabled={isSendingTestWhatsapp} className="gap-1 shrink-0">
                {isSendingTestWhatsapp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>SMS & WhatsApp Log</CardTitle>
              <CardDescription>The 50 most recent SMS and WhatsApp messages sent across the system.</CardDescription>
            </div>
            <ColumnVisibilityMenu visibility={columnVisibility} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                {isVisible('channel') && <TableHead>Channel</TableHead>}
                {isVisible('recipient') && <TableHead className="hidden md:table-cell">Recipient</TableHead>}
                {isVisible('message') && <TableHead className="hidden lg:table-cell">Message</TableHead>}
                {isVisible('status') && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No messages sent yet.</TableCell></TableRow>
              )}
              {sortedLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{format(parseISO(log.sentAt), 'MMM d, yyyy HH:mm')}</TableCell>
                  {isVisible('channel') && <TableCell className="capitalize">{log.channel}</TableCell>}
                  {isVisible('recipient') && <TableCell className="hidden md:table-cell">{log.to}</TableCell>}
                  {isVisible('message') && <TableCell className="hidden lg:table-cell max-w-[280px] truncate">{log.preview}</TableCell>}
                  {isVisible('status') && (
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
    </div>
  );
}
