'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import { can, getEffectivePermissions } from '@/lib/rbac';
import type { Role, Module, PermissionAction } from '@/types';

export function useRequireRole(allowedRoles: Role[]) {
  const { user, isHydrated } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isHydrated) return;
    if (user && !allowedRoles.includes(user.role)) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'You do not have permission to view this page.',
      });
      router.replace('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isHydrated]);

  if (!isHydrated || !user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Fine-grained alternative to useRequireRole: checks whether the current user's
 * EFFECTIVE permissions (their custom role's grants if assigned, else their base
 * role's defaults — see getEffectivePermissions) allow `action` on `module`.
 * A user with no custom role sees identical behavior to the DEFAULT_PERMISSIONS
 * table in src/lib/rbac.ts, so migrating a call site here changes nothing until
 * a tenant admin actually assigns a custom role that overrides that default.
 */
export function useRequirePermission(module: Module, action: PermissionAction, redirectOnDeny = false) {
  const { user, roles, isHydrated } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  const allowed = !!user && can(user.role, module, action, getEffectivePermissions(user, roles));

  useEffect(() => {
    if (!isHydrated || !redirectOnDeny) return;
    if (user && !allowed) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'You do not have permission to view this page.',
      });
      router.replace('/');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isHydrated, allowed, redirectOnDeny]);

  if (!isHydrated || !user) return false;
  return allowed;
}
