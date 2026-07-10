'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePresence } from '@/context/PresenceContext';
import { usePathname } from 'next/navigation';
import type { PresenceRecord } from '@/types';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PresenceAvatar({ record }: { record: PresenceRecord }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Avatar className="h-7 w-7 border-2 border-green-400 ring-1 ring-background">
              <AvatarImage src={record.userAvatar} alt={record.userName} />
              <AvatarFallback className="text-xs bg-green-100 text-green-800">
                {getInitials(record.userName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 border border-background" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{record.userName} is here</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PresenceAvatars({ recordId }: { recordId?: string }) {
  const pathname = usePathname();
  const { usersOnRoute, usersOnRecord } = usePresence();

  const users = recordId
    ? usersOnRecord(pathname, recordId)
    : usersOnRoute(pathname);

  if (users.length === 0) return null;

  const visible = users.slice(0, 4);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center gap-1" aria-label="Active users on this page">
      <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Also viewing:</span>
      <div className="flex -space-x-2">
        {visible.map(u => (
          <PresenceAvatar key={u.userId} record={u} />
        ))}
        {overflow > 0 && (
          <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
