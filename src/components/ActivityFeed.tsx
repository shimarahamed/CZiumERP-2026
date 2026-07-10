'use client';

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { History } from '@/components/icons';

interface ActivityFeedProps {
  entityId: string;
  maxItems?: number;
  className?: string;
}

export function ActivityFeed({ entityId, maxItems = 20, className }: ActivityFeedProps) {
  const { activityLogs } = useAppContext();

  const related = useMemo(() => {
    return activityLogs
      .filter(log => log.details.includes(entityId) || log.action.includes(entityId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxItems);
  }, [activityLogs, entityId, maxItems]);

  if (related.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2', className)}>
        <History className="h-6 w-6 opacity-40" />
        <p>No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('max-h-[400px]', className)}>
      <div className="relative pl-6 space-y-4">
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
        {related.map((log, i) => (
          <div key={log.id} className="relative">
            <div className="absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
            <div className="text-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="font-medium">{log.action}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
              <p className="text-xs text-primary/70 mt-0.5">by {log.user}</p>
              {log.changes && log.changes.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {log.changes.map((c, ci) => (
                    <Badge key={`change-${ci}`} variant="outline" className="text-xs font-normal">
                      {c.field}: <span className="line-through text-destructive mx-1">{c.from}</span>
                      → <span className="text-green-600 ml-1">{c.to}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
