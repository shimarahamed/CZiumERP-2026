'use client';

import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Trash2, PlusCircle, Copy } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { uuid, copyToClipboard } from '@/lib/utils';
import { useAppContext } from '@/context/AppContext';
import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import type { ApiKey, WebhookEndpoint, WebhookEventType } from '@/types';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const WEBHOOK_EVENTS: WebhookEventType[] = ['invoice.created', 'stock.low', 'purchase-order.approved'];

const API_KEYS_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Name', locked: true },
  { id: 'prefix', label: 'Prefix' },
  { id: 'scopes', label: 'Scopes' },
  { id: 'status', label: 'Status' },
];

const WEBHOOKS_COLUMNS: ColumnDef[] = [
  { id: 'url', label: 'URL', locked: true },
  { id: 'events', label: 'Events' },
  { id: 'status', label: 'Status' },
];

export default function ApiWebhooksSettings() {
  const { tenantId, user } = useAppContext();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useFirestoreCollection<ApiKey>('apiKeys', [], tenantId);
  const [webhooks, setWebhooks] = useFirestoreCollection<WebhookEndpoint>('webhooks', [], tenantId);

  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<('read' | 'write')[]>(['read']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<WebhookEventType[]>([]);

  const apiKeysColumnVisibility = useColumnVisibility('api-keys', API_KEYS_COLUMNS);
  const { isVisible: isApiKeyColVisible } = apiKeysColumnVisibility;
  const webhooksColumnVisibility = useColumnVisibility('webhooks', WEBHOOKS_COLUMNS);
  const { isVisible: isWebhookColVisible } = webhooksColumnVisibility;

  const generateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }
    setIsGenerating(true);
    try {
      const call = httpsCallable(getFunctions(app), 'generateApiKey');
      const result = await call({ name: newKeyName.trim(), scopes: newKeyScopes });
      const data = result.data as { rawKey: string };
      setGeneratedKey(data.rawKey);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to generate key', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsGenerating(false);
    }
  };

  const closeKeyDialog = () => {
    setIsKeyDialogOpen(false);
    setNewKeyName('');
    setNewKeyScopes(['read']);
    setGeneratedKey(null);
  };

  const revokeKey = async (keyId: string) => {
    try {
      const call = httpsCallable(getFunctions(app), 'revokeApiKey');
      await call({ keyId });
      toast({ title: 'Key revoked' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to revoke key', description: err instanceof Error ? err.message : undefined });
    }
  };

  const addWebhook = () => {
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0 || !tenantId) {
      toast({ variant: 'destructive', title: 'URL and at least one event are required' });
      return;
    }
    const secret = uuid().replace(/-/g, '');
    const id = `wh-${Date.now()}`;
    const endpoint: WebhookEndpoint = {
      id,
      url: newWebhookUrl.trim(),
      events: newWebhookEvents,
      secret,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: user?.id ?? 'unknown',
    };
    setDoc(doc(db, 'tenants', tenantId, 'webhooks', id), endpoint);
    setWebhooks(prev => [endpoint, ...prev]);
    setIsWebhookDialogOpen(false);
    setNewWebhookUrl('');
    setNewWebhookEvents([]);
    toast({ title: 'Webhook added', description: 'Save the signing secret shown below — it will not be shown again.' });
  };

  const removeWebhook = (id: string) => {
    if (!tenantId) return;
    deleteDoc(doc(db, 'tenants', tenantId, 'webhooks', id));
    setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  const toggleWebhookActive = (webhook: WebhookEndpoint) => {
    if (!tenantId) return;
    const updated = { ...webhook, isActive: !webhook.isActive };
    setDoc(doc(db, 'tenants', tenantId, 'webhooks', webhook.id), updated);
    setWebhooks(prev => prev.map(w => w.id === webhook.id ? updated : w));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">API Keys</Label>
            <p className="text-xs text-muted-foreground">Authenticate external scripts/integrations against the read-only /v1 REST API. The raw key is shown once — save it securely.</p>
          </div>
          <div className="flex items-center gap-2">
            <ColumnVisibilityMenu visibility={apiKeysColumnVisibility} />
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsKeyDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" /> New key
            </Button>
          </div>
        </div>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No API keys yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead>
              {isApiKeyColVisible('prefix') && <TableHead>Prefix</TableHead>}
              {isApiKeyColVisible('scopes') && <TableHead>Scopes</TableHead>}
              {isApiKeyColVisible('status') && <TableHead>Status</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {apiKeys.map(key => (
                <TableRow key={key.id}>
                  <TableCell>{key.name}</TableCell>
                  {isApiKeyColVisible('prefix') && <TableCell className="font-mono text-xs">{key.keyPrefix}…</TableCell>}
                  {isApiKeyColVisible('scopes') && <TableCell>{key.scopes.join(', ')}</TableCell>}
                  {isApiKeyColVisible('status') && <TableCell>{key.revokedAt ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="default">Active</Badge>}</TableCell>}
                  <TableCell className="text-right">
                    {!key.revokedAt && <Button size="sm" variant="ghost" onClick={() => revokeKey(key.id)}>Revoke</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Webhooks</Label>
            <p className="text-xs text-muted-foreground">Get an HMAC-signed POST when key events happen — invoice created, stock low, PO approved.</p>
          </div>
          <div className="flex items-center gap-2">
            <ColumnVisibilityMenu visibility={webhooksColumnVisibility} />
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsWebhookDialogOpen(true)}>
              <PlusCircle className="h-4 w-4" /> New webhook
            </Button>
          </div>
        </div>
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No webhooks configured.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>URL</TableHead>
              {isWebhookColVisible('events') && <TableHead>Events</TableHead>}
              {isWebhookColVisible('status') && <TableHead>Status</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {webhooks.map(wh => (
                <TableRow key={wh.id}>
                  <TableCell className="max-w-xs truncate">{wh.url}</TableCell>
                  {isWebhookColVisible('events') && <TableCell className="text-xs">{wh.events.join(', ')}</TableCell>}
                  {isWebhookColVisible('status') && (
                    <TableCell>
                      <Badge variant={wh.isActive ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleWebhookActive(wh)}>
                        {wh.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeWebhook(wh.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isKeyDialogOpen} onOpenChange={(open) => !open && closeKeyDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate API key</DialogTitle></DialogHeader>
          {generatedKey ? (
            <div className="space-y-3">
              <DialogDescription>Save this key now — it will not be shown again.</DialogDescription>
              <div className="flex items-center gap-2">
                <Input readOnly value={generatedKey} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={async () => {
                  const ok = await copyToClipboard(generatedKey);
                  toast(ok ? { title: 'Copied' } : { variant: 'destructive', title: 'Copy failed', description: 'Select and copy the key manually.' });
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter><Button onClick={closeKeyDialog}>Done</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input id="key-name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., Zapier integration" />
              </div>
              <div className="space-y-1.5">
                <Label>Scopes</Label>
                <div className="flex gap-4">
                  {(['read', 'write'] as const).map(scope => (
                    <label key={scope} className="flex items-center gap-2 text-sm capitalize">
                      <Checkbox
                        checked={newKeyScopes.includes(scope)}
                        onCheckedChange={(checked) => setNewKeyScopes(prev => checked ? [...prev, scope] : prev.filter(s => s !== scope))}
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeKeyDialog}>Cancel</Button>
                <Button onClick={generateKey} disabled={isGenerating}>{isGenerating ? 'Generating…' : 'Generate'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isWebhookDialogOpen} onOpenChange={setIsWebhookDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add webhook</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input id="webhook-url" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://example.com/webhooks/czium" />
            </div>
            <div className="space-y-1.5">
              <Label>Events</Label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map(event => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newWebhookEvents.includes(event)}
                      onCheckedChange={(checked) => setNewWebhookEvents(prev => checked ? [...prev, event] : prev.filter(e => e !== event))}
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWebhookDialogOpen(false)}>Cancel</Button>
              <Button onClick={addWebhook}>Add webhook</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
