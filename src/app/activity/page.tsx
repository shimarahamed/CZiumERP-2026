
'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Header from "@/components/Header";
import { useAppContext } from "@/context/AppContext";
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Download, ChevronDown } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useRequireRole } from '@/hooks/use-require-role';
import { cn } from '@/lib/utils';

type SortKey = 'timestamp' | 'user' | 'action';
const PAGE_SIZE = 25;

function ActivityLogPageInner() {
  usePageTitle('Activity Logs');
    const { activityLogs, isDataLoaded } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('timestamp');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const filteredLogs = useMemo(() => {
        let logs = [...activityLogs];
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            logs = logs.filter(log =>
                log.user.toLowerCase().includes(lower) ||
                log.action.toLowerCase().includes(lower) ||
                log.details.toLowerCase().includes(lower)
            );
        }
        logs.sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return logs;
    }, [activityLogs, searchTerm, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleExportCSV = () => {
        const header = ['Timestamp', 'User', 'Action', 'Details', 'Changes'];
        const rows = filteredLogs.map(log => [
            format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            log.user,
            log.action,
            log.details,
            log.changes ? JSON.stringify(log.changes) : '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Activity Logs" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <Input
                        placeholder="Search by user, action, or details…"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full sm:max-w-sm bg-secondary"
                    />
                    <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={handleExportCSV}>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="hidden md:table-cell">
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('timestamp')}>
                                            Timestamp <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('user')}>
                                            User <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('action')}>
                                            Action <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="w-8"></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                                <TableSkeleton rows={8} cols={5} />
                            ) : (
                            <TableBody>
                                {paginatedLogs.length > 0 ? (
                                    paginatedLogs.flatMap(log => {
                                        const isExpanded = expandedLogId === log.id;
                                        const hasChanges = !!(log.changes && log.changes.length > 0);
                                        return [
                                            <TableRow
                                                key={log.id}
                                                className={cn(hasChanges && "cursor-pointer hover:bg-muted/50")}
                                                onClick={() => hasChanges && setExpandedLogId(isExpanded ? null : log.id)}
                                            >
                                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{log.user}</div>
                                                    <div className="text-muted-foreground md:hidden text-xs">
                                                        {format(new Date(log.timestamp), 'MMM d, HH:mm')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">{log.action}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
                                                <TableCell className="w-8">
                                                    {hasChanges && (
                                                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-180")} />
                                                    )}
                                                </TableCell>
                                            </TableRow>,
                                            ...(isExpanded && hasChanges ? [
                                                <TableRow key={`${log.id}-changes`} className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell colSpan={5} className="py-2 px-4">
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-semibold text-muted-foreground mb-1">Field Changes</p>
                                                            {log.changes!.map((change, i) => (
                                                                <div key={`change-${i}`} className="flex items-center gap-3 text-xs">
                                                                    <span className="font-medium text-muted-foreground w-28 shrink-0 capitalize">{change.field}</span>
                                                                    <span className="text-destructive line-through">{change.from}</span>
                                                                    <span className="text-muted-foreground">→</span>
                                                                    <span className="text-green-600 dark:text-green-400 font-medium">{change.to}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ] : []),
                                        ];
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            {searchTerm ? 'No logs match your search.' : 'No activity logs yet.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            )}
                        </Table>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t">
                                <p className="text-sm text-muted-foreground">
                                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} entries
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                        Previous
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

// Permission guard lives in a wrapper so all hooks inside ActivityLogPageInner
// run unconditionally (React rules-of-hooks).
export default function ActivityLogPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <ActivityLogPageInner />;
}
