
'use client'

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns/format';
import { differenceInDays } from 'date-fns/differenceInDays';
import { parseISO } from 'date-fns/parseISO';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { LeaveRequest } from '@/types';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Check, X } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildApprovalWorkflow } from '@/lib/approvals';
import { ApprovalWorkflowPanel } from '@/components/ApprovalWorkflowPanel';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const MY_LEAVE_HISTORY_COLUMNS: ColumnDef[] = [
  { id: 'dates', label: 'Dates', locked: true },
  { id: 'reason', label: 'Reason' },
  { id: 'status', label: 'Status' },
  { id: 'decidedBy', label: 'Decided By' },
];

const TEAM_REQUESTS_COLUMNS: ColumnDef[] = [
  { id: 'employee', label: 'Employee', locked: true },
  { id: 'dates', label: 'Dates' },
  { id: 'reason', label: 'Reason' },
];

const leaveRequestSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required." }),
    to: z.date({ required_error: "End date is required." }),
  }).refine(range => range.to >= range.from, {
    message: "End date cannot be before start date.",
    path: ["to"],
  }),
  reason: z.string().min(10, "Reason must be at least 10 characters long."),
});

type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

const statusVariant: { [key in LeaveRequest['status']]: 'default' | 'secondary' | 'destructive' } = {
    pending: 'secondary',
    approved: 'default',
    rejected: 'destructive',
};

export default function LeaveRequestsPage() {
    const { user, users, employees, setEmployees, leaveRequests, setLeaveRequests, addActivityLog, addNotification, isDataLoaded, themeSettings, approvalWorkflows, setApprovalWorkflows } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    // When a multi-step chain is configured for leave requests, approving/rejecting opens
    // this panel instead of acting instantly.
    const [reviewingRequest, setReviewingRequest] = useState<LeaveRequest | null>(null);
    const myHistoryColumnVisibility = useColumnVisibility('leave-requests-my-history', MY_LEAVE_HISTORY_COLUMNS);
    const { isVisible: isMyHistoryVisible } = myHistoryColumnVisibility;
    const teamRequestsColumnVisibility = useColumnVisibility('leave-requests-team', TEAM_REQUESTS_COLUMNS);
    const { isVisible: isTeamVisible } = teamRequestsColumnVisibility;

    const form = useForm<LeaveRequestFormData>({
        resolver: zodResolver(leaveRequestSchema),
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const currentEmployee = useMemo(() => employees.find(e => e.userId === user?.id), [employees, user?.id]);
    const leaveBalance = useMemo(() => {
        if (!currentEmployee) return 0;
        return (currentEmployee.annualLeaveAllowance || 0) - (currentEmployee.leaveTaken || 0);
    }, [currentEmployee]);

    const filteredMyRequests = useMemo(() => {
        const baseRequests = leaveRequests.filter(lr => lr.userId === user?.id).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        if (!searchTerm) return baseRequests;
        return baseRequests.filter(req => req.reason.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [leaveRequests, user?.id, searchTerm]);

    const filteredTeamRequests = useMemo(() => {
        const baseRequests = leaveRequests.filter(lr => lr.status === 'pending').sort((a,b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        if (!searchTerm) return baseRequests;
        return baseRequests.filter(req =>
            req.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.reason.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [leaveRequests, searchTerm]);

    const onSubmit = (data: LeaveRequestFormData) => {
        if (!user) return;
        const requestId = `lr-${Date.now()}`;
        const newRequest: LeaveRequest = {
            id: requestId,
            userId: user.id,
            userName: user.name,
            startDate: format(data.dateRange.from, 'yyyy-MM-dd'),
            endDate: format(data.dateRange.to, 'yyyy-MM-dd'),
            reason: data.reason,
            status: 'pending',
            requestedAt: new Date().toISOString(),
        };
        setLeaveRequests(prev => [newRequest, ...prev]);
        // Leave requests have no natural "amount" — pass 0 so a configured chain with no
        // threshold (or threshold 0) always builds a workflow; one with a threshold > 0
        // would never trigger for leave, which is an acceptable default until leave gets
        // its own duration-based rule shape.
        const workflow = themeSettings.approvalRules?.['leave-request']
            ? buildApprovalWorkflow('leave-request', requestId, `Leave request — ${user.name}`, 0, user, themeSettings.approvalRules, users, undefined, employees)
            : null;
        if (workflow) setApprovalWorkflows(prev => [workflow, ...prev]);
        addActivityLog('Leave Requested', `User ${user.email} requested leave.`);
        toast({ title: 'Leave Request Submitted', description: 'Your request has been sent for approval.' });
        setIsFormOpen(false);
        form.reset();
    };

    // Shared finalize step for both the legacy instant-approve/reject actions and the new
    // multi-step ApprovalWorkflowPanel completion callback.
    const finalizeLeaveDecision = (req: LeaveRequest, decision: 'approved' | 'rejected', reason?: string) => {
        if (!user) return;
        if (decision === 'approved') {
            const employeeToUpdate = employees.find(e => e.userId === req.userId);
            if (employeeToUpdate) {
                const leaveDuration = differenceInDays(parseISO(req.endDate), parseISO(req.startDate)) + 1;
                setEmployees(employees.map(emp =>
                    emp.id === employeeToUpdate.id
                    ? { ...emp, leaveTaken: (emp.leaveTaken || 0) + leaveDuration }
                    : emp
                ));
            }
        }

        setLeaveRequests(prev =>
            prev.map(r => r.id === req.id
                ? { ...r, status: decision, rejectionReason: decision === 'rejected' ? reason : r.rejectionReason, decidedBy: user.email, decidedAt: new Date().toISOString() }
                : r
            )
        );

        addActivityLog(`Leave Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`, `Request from ${req.userName} ${decision} by ${user.email}`, [
            { field: 'status', from: 'pending', to: decision }
        ]);
        addNotification({
            title: `Leave Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
            description: decision === 'approved'
                ? 'Your leave request has been approved.'
                : `Your leave request has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
            href: '/human-resources/leave-requests',
        });
        toast({ title: decision === 'approved' ? 'Request Approved' : 'Request Rejected' });
    };

    const activeWorkflowFor = (requestId: string) =>
        approvalWorkflows.find(w => w.entityType === 'leave-request' && w.entityId === requestId && w.finalStatus === 'in-progress');

    const handleApprove = (requestId: string) => {
        const req = leaveRequests.find(r => r.id === requestId);
        if (!req) return;
        const workflow = activeWorkflowFor(requestId);
        if (workflow) { setReviewingRequest(req); return; }
        finalizeLeaveDecision(req, 'approved');
    };

    const handleReject = (requestId: string, reason: string) => {
        const req = leaveRequests.find(r => r.id === requestId);
        if (!req) return;
        finalizeLeaveDecision(req, 'rejected', reason);
        setRejectingRequest(null);
        setRejectionReason('');
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Leave Requests" />
            <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources' }, { label: 'Leave Requests' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>My Leave Balance</CardTitle>
                        <CardDescription>Your available leave for the year.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{leaveBalance} days</p>
                        <p className="text-sm text-muted-foreground">Remaining out of {currentEmployee?.annualLeaveAllowance || 0} days.</p>
                    </CardContent>
                </Card>

                 <Tabs defaultValue="my-requests" className="w-full">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                        <TabsList>
                            <TabsTrigger value="my-requests">My Requests</TabsTrigger>
                            {canManage && <TabsTrigger value="team-requests">Team Requests</TabsTrigger>}
                        </TabsList>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <Input
                                placeholder="Search requests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full md:w-auto bg-secondary"
                            />
                             <Button size="sm" className="gap-1" onClick={() => setIsFormOpen(true)}>
                                <PlusCircle className="h-4 w-4" />
                                New Request
                            </Button>
                        </div>
                    </div>
                    <TabsContent value="my-requests">
                        <Card className="mt-4">
                            <CardHeader>
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                    <div>
                                        <CardTitle>My Leave History</CardTitle>
                                        <CardDescription>A log of your past and pending leave requests.</CardDescription>
                                    </div>
                                    <ColumnVisibilityMenu visibility={myHistoryColumnVisibility} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Dates</TableHead>
                                            {isMyHistoryVisible('reason') && <TableHead>Reason</TableHead>}
                                            {isMyHistoryVisible('status') && <TableHead>Status</TableHead>}
                                            {isMyHistoryVisible('decidedBy') && <TableHead>Decided By</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    {!isDataLoaded ? (
                                      <TableSkeleton rows={8} cols={4} />
                                    ) : (
                                    <TableBody>
                                        {filteredMyRequests.map(req => (
                                            <TableRow key={req.id}>
                                                <TableCell>{format(new Date(req.startDate), 'MMM d, yyyy')} - {format(new Date(req.endDate), 'MMM d, yyyy')}</TableCell>
                                                {isMyHistoryVisible('reason') && <TableCell className="truncate max-w-xs">{req.reason}</TableCell>}
                                                {isMyHistoryVisible('status') && (
                                                    <TableCell>
                                                        {req.status === 'rejected' && req.rejectionReason ? (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Badge variant="destructive" className="capitalize cursor-help">{req.status}</Badge>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p className="max-w-xs">Reason: {req.rejectionReason}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        ) : (
                                                            <Badge variant={statusVariant[req.status]} className="capitalize">{req.status}</Badge>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {isMyHistoryVisible('decidedBy') && (
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {req.decidedBy ? (
                                                            <span title={req.decidedAt ? format(new Date(req.decidedAt), 'MMM d, yyyy HH:mm') : undefined}>
                                                                {req.decidedBy}
                                                            </span>
                                                        ) : '—'}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    )}
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {canManage && (
                    <TabsContent value="team-requests">
                         <Card className="mt-4">
                            <CardHeader>
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                    <div>
                                        <CardTitle>Pending Team Requests</CardTitle>
                                        <CardDescription>Review and approve/reject leave requests from your team.</CardDescription>
                                    </div>
                                    <ColumnVisibilityMenu visibility={teamRequestsColumnVisibility} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            {isTeamVisible('dates') && <TableHead>Dates</TableHead>}
                                            {isTeamVisible('reason') && <TableHead>Reason</TableHead>}
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTeamRequests.map(req => (
                                            <TableRow key={req.id}>
                                                <TableCell>{req.userName}</TableCell>
                                                {isTeamVisible('dates') && <TableCell>{format(new Date(req.startDate), 'MMM d')} - {format(new Date(req.endDate), 'MMM d, yyyy')}</TableCell>}
                                                {isTeamVisible('reason') && <TableCell className="truncate max-w-xs">{req.reason}</TableCell>}
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleApprove(req.id)}>
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        </Button>
                                                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => { const wf = activeWorkflowFor(req.id); if (wf) { setReviewingRequest(req); } else { setRejectingRequest(req); setRejectionReason(''); } }}>
                                                            <X className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    )}
                 </Tabs>
            </main>

            {/* New leave request dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Leave Request</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="dateRange"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Leave Dates</FormLabel>
                                        <DateRangePicker date={field.value} setDate={field.onChange} />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reason</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Please provide a reason for your leave..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="submit">Submit Request</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Rejection reason dialog */}
            <Dialog open={!!rejectingRequest} onOpenChange={(open) => { if (!open) { setRejectingRequest(null); setRejectionReason(''); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">Rejecting leave request from <strong>{rejectingRequest?.userName}</strong>.</p>
                        <div className="space-y-2">
                            <Label htmlFor="rejection-reason">Reason for rejection (optional)</Label>
                            <Textarea
                                id="rejection-reason"
                                placeholder="Provide a reason so the employee understands..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectingRequest(null); setRejectionReason(''); }}>Cancel</Button>
                        <Button variant="destructive" onClick={() => rejectingRequest && handleReject(rejectingRequest.id, rejectionReason)}>Confirm Rejection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Multi-step approval panel — only reachable when approvalRules['leave-request']
                is configured; otherwise approve/reject act instantly as before. */}
            <Dialog open={!!reviewingRequest} onOpenChange={(open) => !open && setReviewingRequest(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review Leave Request</DialogTitle>
                    </DialogHeader>
                    {reviewingRequest && (
                        <ApprovalWorkflowPanel
                            entityType="leave-request"
                            entityId={reviewingRequest.id}
                            entityTitle={`Leave request — ${reviewingRequest.userName}`}
                            workflow={activeWorkflowFor(reviewingRequest.id)}
                            onWorkflowChange={(updated) => {
                                setApprovalWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
                                if (updated.finalStatus === 'approved' || updated.finalStatus === 'rejected') {
                                    finalizeLeaveDecision(reviewingRequest, updated.finalStatus);
                                    setReviewingRequest(null);
                                }
                            }}
                        />
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReviewingRequest(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


