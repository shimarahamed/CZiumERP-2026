'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, X, Clock } from '@/components/icons';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import type { ApprovalWorkflow, ApprovalEntityType } from '@/types';

function getInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

interface Props {
  entityType: ApprovalEntityType;
  entityId: string;
  entityTitle: string;
  workflow?: ApprovalWorkflow;
  onWorkflowChange?: (wf: ApprovalWorkflow) => void;
}

const STATUS_COLORS = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  'in-progress': 'secondary',
} as const;

export function ApprovalWorkflowPanel({ entityType, entityId, entityTitle, workflow, onWorkflowChange }: Props) {
  const { user, users, addActivityLog, addNotification, tenantId } = useAppContext();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const myStep = workflow?.steps.find(s => s.approverId === user?.id && s.status === 'pending');
  const isCurrentApprover = !!myStep && workflow?.currentStep === myStep.stepNumber;

  const saveWorkflow = useCallback(async (updated: ApprovalWorkflow) => {
    if (!tenantId) return;
    const ref = doc(db, 'tenants', tenantId, 'approvalWorkflows', updated.id);
    await setDoc(ref, updated);
    onWorkflowChange?.(updated);
  }, [onWorkflowChange, tenantId]);

  const decide = useCallback(async (decision: 'approved' | 'rejected') => {
    if (!workflow || !user || !myStep) return;
    setIsSaving(true);
    try {
      const updatedSteps = workflow.steps.map(s =>
        s.stepNumber === myStep.stepNumber
          ? { ...s, status: decision, decidedAt: new Date().toISOString(), comment }
          : s
      );
      const allApproved = updatedSteps.every(s => s.status === 'approved');
      const anyRejected = updatedSteps.some(s => s.status === 'rejected');
      const nextPending = updatedSteps.find(s => s.status === 'pending');

      const updated: ApprovalWorkflow = {
        ...workflow,
        steps: updatedSteps,
        currentStep: nextPending?.stepNumber ?? myStep.stepNumber,
        finalStatus: anyRejected ? 'rejected' : allApproved ? 'approved' : 'in-progress',
      };

      await saveWorkflow(updated);
      addActivityLog(
        `Approval ${decision}`,
        `${entityType} "${entityTitle}" was ${decision} by ${user.name}.`
      );
      addNotification({
        title: `${entityTitle} ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `${user.name} ${decision} "${entityTitle}".${comment ? ` Note: ${comment}` : ''}`,
        href: `/${entityType === 'purchase-order' ? 'purchase-orders' : entityType === 'invoice' ? 'invoices' : 'human-resources/leave-requests'}`,
      });
      toast({ title: `${decision === 'approved' ? 'Approved' : 'Rejected'} successfully` });
      setComment('');
    } finally {
      setIsSaving(false);
    }
  }, [workflow, user, myStep, comment, saveWorkflow, addActivityLog, addNotification, entityType, entityTitle, toast]);

  if (!workflow) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No approval workflow configured for this record.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Approval Workflow</CardTitle>
          <Badge variant={STATUS_COLORS[workflow.finalStatus] ?? 'secondary'} className="capitalize">
            {workflow.finalStatus.replace('-', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Steps */}
        <div className="space-y-2">
          {workflow.steps.map(step => {
            const approver = users.find(u => u.id === step.approverId);
            return (
              <div key={step.stepNumber} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    step.status === 'approved' ? 'bg-green-100 text-green-700' :
                    step.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {step.status === 'approved' ? <CheckCircle className="h-4 w-4" /> :
                     step.status === 'rejected' ? <X className="h-4 w-4" /> :
                     <Clock className="h-4 w-4" />}
                  </div>
                  {step.stepNumber < workflow.steps.length && (
                    <div className="w-px h-4 bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={approver?.avatar} />
                      <AvatarFallback className="text-xs">{getInitials(step.approverName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{step.approverName}</span>
                    <Badge variant="outline" className="text-xs capitalize ml-auto">{step.status}</Badge>
                  </div>
                  {step.comment && (
                    <p className="text-xs text-muted-foreground mt-0.5 pl-7">&quot;{step.comment}&quot;</p>
                  )}
                  {step.decidedAt && (
                    <p className="text-xs text-muted-foreground pl-7">
                      {formatDistanceToNow(new Date(step.decidedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Decision panel for current approver */}
        {isCurrentApprover && workflow.finalStatus === 'in-progress' && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Your decision</p>
            <Textarea
              placeholder="Add a comment (optional)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1" onClick={() => decide('approved')} disabled={isSaving}>
                <CheckCircle className="h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => decide('rejected')} disabled={isSaving}>
                <X className="h-4 w-4" /> Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
