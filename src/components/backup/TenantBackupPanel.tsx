'use client';

import { useEffect, useRef, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2 } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';

type BackupType = 'scheduled' | 'manual' | 'uploaded' | 'pre-restore-snapshot';
type BackupStatus = 'in_progress' | 'complete' | 'failed';

type BackupRecord = {
  id: string;
  status: BackupStatus;
  createdAt: string;
  createdBy: string;
  type: BackupType;
  sizeBytes?: number;
  collectionCounts?: Record<string, number>;
  error?: string;
};

const TYPE_LABEL: Record<BackupType, string> = {
  scheduled: 'Scheduled',
  manual: 'Manual',
  uploaded: 'Uploaded',
  'pre-restore-snapshot': 'Pre-restore snapshot',
};

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RestoreButton({ tenantId, backup }: { tenantId: string; backup: BackupRecord }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (confirmText !== tenantId) return;
    setRestoring(true);
    try {
      const call = httpsCallable(getFunctions(app), 'restoreTenantBackup');
      await call({ tenantId, backupId: backup.id, confirm: confirmText });
      toast({ title: 'Restore complete', description: 'Tenant data has been restored from this backup. A snapshot of the prior state was saved first.' });
      setOpen(false);
      setConfirmText('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Restore failed', description: err?.message ?? 'Cloud Functions may not be deployed yet.' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirmText(''); }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">Restore</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore from this backup?</DialogTitle>
          <DialogDescription>
            This overwrites the current data for tenant <span className="font-mono">{tenantId}</span> with the contents of this{' '}
            {TYPE_LABEL[backup.type].toLowerCase()} backup from {new Date(backup.createdAt).toLocaleString()}. A safety snapshot of the
            current state is taken automatically before anything is overwritten, so this can be undone by restoring that snapshot afterward.
            Type the tenant ID to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={tenantId}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={restoring}>Cancel</Button>
          <Button variant="destructive" onClick={handleRestore} disabled={restoring || confirmText !== tenantId}>
            {restoring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {restoring ? 'Restoring…' : 'Restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TenantBackupPanel({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(collection(db, 'tenants', tenantId, 'backups'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setBackups(snap.docs.map((d) => d.data() as BackupRecord));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId]);

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      const call = httpsCallable(getFunctions(app), 'triggerTenantBackup');
      await call({ tenantId });
      toast({ title: 'Backup started', description: 'The backup will appear in the list once it completes.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Backup failed', description: err?.message ?? 'Cloud Functions may not be deployed yet.' });
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownload = async (backupId: string) => {
    setDownloadingId(backupId);
    try {
      const call = httpsCallable(getFunctions(app), 'downloadTenantBackup');
      const result = await call({ tenantId, backupId });
      const json = (result.data as { json: string }).json;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tenantId}-backup-${backupId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: err?.message ?? 'Could not download this backup.' });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const call = httpsCallable(getFunctions(app), 'uploadTenantBackup');
      await call({ tenantId, json: text });
      toast({ title: 'Backup uploaded', description: file.name });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err?.message ?? 'File may not be a valid backup.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Backups</CardTitle>
          <CardDescription>
            Daily automatic backups plus any manual or uploaded backups for this tenant. Restoring overwrites current data
            but always saves a safety snapshot first.
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {uploading ? 'Uploading…' : 'Upload Backup'}
          </Button>
          <Button size="sm" onClick={handleBackupNow} disabled={backingUp}>
            {backingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {backingUp ? 'Backing up…' : 'Backup Now'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading backups…
          </div>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No backups yet. Trigger one with "Backup Now", or wait for tonight's scheduled run.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Collections</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{new Date(b.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{TYPE_LABEL[b.type] ?? b.type}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === 'complete' ? 'default' : b.status === 'failed' ? 'destructive' : 'secondary'}>
                      {b.status === 'in_progress' ? 'In progress' : b.status === 'failed' ? 'Failed' : 'Complete'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatSize(b.sizeBytes)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.collectionCounts ? Object.values(b.collectionCounts).reduce((a, c) => a + c, 0) : 0} records
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {b.status === 'complete' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(b.id)} disabled={downloadingId === b.id}>
                          {downloadingId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Download'}
                        </Button>
                        <RestoreButton tenantId={tenantId} backup={b} />
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
