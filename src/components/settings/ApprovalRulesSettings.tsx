'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2 } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import type { ApprovalEntityType, ApprovalRuleStep, ApprovalRules, Role } from '@/types';

const ENTITY_LABELS: Record<ApprovalEntityType, string> = {
  'purchase-order': 'Purchase Orders',
  invoice: 'Invoices',
  'leave-request': 'Leave Requests',
  'expense-claim': 'Expense Claims',
  'vendor-bill': 'Vendor Bills',
  rfq: 'RFQs',
};

const ENTITIES: ApprovalEntityType[] = ['purchase-order', 'invoice', 'leave-request', 'expense-claim', 'vendor-bill', 'rfq'];
const APPROVER_ROLES: Role[] = ['manager', 'admin'];
// A step's approver source: a role match, a specific pinned user, or the requester's manager.
type ApproverSource = 'role' | 'user' | 'requester-manager';
function sourceOf(step: ApprovalRuleStep): ApproverSource {
  if (step.useRequesterManager) return 'requester-manager';
  if (step.userId) return 'user';
  return 'role';
}

interface Props {
  value: ApprovalRules | undefined;
  onChange: (rules: ApprovalRules) => void;
}

/**
 * Configures a multi-step approval chain per entity type — e.g. "PO over $5,000 needs
 * manager then admin approval". Each entity's rule is independent; leaving a rule
 * unconfigured (no steps) means that entity keeps its legacy single-approver behavior
 * (PO: canManage gate; Invoice: invoiceApprovalThreshold; Leave: instant approve).
 */
export default function ApprovalRulesSettings({ value, onChange }: Props) {
  const { users } = useAppContext();
  const rules = value ?? {};

  const updateRule = (entity: ApprovalEntityType, patch: Partial<ApprovalRules[ApprovalEntityType]>) => {
    const current = rules[entity] ?? { steps: [] };
    onChange({ ...rules, [entity]: { ...current, ...patch } });
  };

  const addStep = (entity: ApprovalEntityType) => {
    const current = rules[entity] ?? { steps: [] };
    updateRule(entity, { steps: [...current.steps, { role: 'manager' }] });
  };

  const removeStep = (entity: ApprovalEntityType, index: number) => {
    const current = rules[entity];
    if (!current) return;
    updateRule(entity, { steps: current.steps.filter((_, i) => i !== index) });
  };

  const patchStep = (entity: ApprovalEntityType, index: number, patch: Partial<ApprovalRuleStep>) => {
    const current = rules[entity];
    if (!current) return;
    updateRule(entity, { steps: current.steps.map((s, i) => i === index ? { ...s, ...patch } : s) });
  };

  const setStepSource = (entity: ApprovalEntityType, index: number, source: ApproverSource) => {
    if (source === 'requester-manager') {
      patchStep(entity, index, { useRequesterManager: true, userId: undefined });
    } else if (source === 'user') {
      patchStep(entity, index, { useRequesterManager: false, userId: users[0]?.id });
    } else {
      patchStep(entity, index, { useRequesterManager: false, userId: undefined });
    }
  };

  return (
    <div className="space-y-4">
      {ENTITIES.map(entity => {
        const rule = rules[entity];
        const steps = rule?.steps ?? [];
        return (
          <div key={entity} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">{ENTITY_LABELS[entity]}</Label>
              {steps.length === 0 && <span className="text-xs text-muted-foreground">Not configured — uses default single-approver behavior</span>}
            </div>

            {entity !== 'leave-request' && (
              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor={`threshold-${entity}`} className="text-xs text-muted-foreground">Threshold (0 = always require approval)</Label>
                <Input
                  id={`threshold-${entity}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={rule?.threshold ?? 0}
                  onChange={(e) => updateRule(entity, { threshold: Number(e.target.value) })}
                />
              </div>
            )}

            <div className="space-y-2">
              {steps.map((step, index) => {
                const source = sourceOf(step);
                return (
                  <div key={index} className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Step {index + 1}</span>
                    <Select value={source} onValueChange={(v) => setStepSource(entity, index, v as ApproverSource)}>
                      <SelectTrigger className="max-w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">Any user with role</SelectItem>
                        <SelectItem value="user">Specific person</SelectItem>
                        <SelectItem value="requester-manager">Requester&apos;s manager</SelectItem>
                      </SelectContent>
                    </Select>
                    {source === 'role' && (
                      <Select value={step.role} onValueChange={(v) => patchStep(entity, index, { role: v as Role })}>
                        <SelectTrigger className="max-w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {APPROVER_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {source === 'user' && (
                      <Select value={step.userId} onValueChange={(v) => patchStep(entity, index, { userId: v })}>
                        <SelectTrigger className="max-w-[200px]"><SelectValue placeholder="Select a person" /></SelectTrigger>
                        <SelectContent>
                          {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {source === 'requester-manager' && (
                      <span className="text-xs text-muted-foreground">Falls back to a manager if the requester has no linked employee record</span>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(entity, index)} aria-label={`Remove step ${index + 1}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addStep(entity)}>
                <PlusCircle className="h-4 w-4" /> Add approval step
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
