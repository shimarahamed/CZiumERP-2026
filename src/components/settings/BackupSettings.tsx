'use client';

import { useAppContext } from '@/context/AppContext';
import { TenantBackupPanel } from '@/components/backup/TenantBackupPanel';

export default function BackupSettings() {
    const { tenantId } = useAppContext();
    if (!tenantId) return null;
    return <TenantBackupPanel tenantId={tenantId} />;
}
