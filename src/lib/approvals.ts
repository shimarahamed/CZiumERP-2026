import type { ApprovalEntityType, ApprovalRule, ApprovalRuleStep, ApprovalRules, ApprovalStep, ApprovalWorkflow, Employee, User } from '@/types';

/**
 * Resolves an approval-step to a concrete approver, most specific first:
 * 1. A pinned userId, if set and still a valid user.
 * 2. The requester's manager (via Employee.userId -> Employee.managerId -> Employee.userId),
 *    if useRequesterManager is set — best-effort, falls through to role match when the
 *    requester or their manager has no linked Employee/User record.
 * 3. The first user holding `role`.
 */
function resolveApprover(
  step: ApprovalRuleStep,
  requestedBy: User,
  users: User[],
  employees: Employee[]
): User | undefined {
  if (step.userId) {
    const pinned = users.find(u => u.id === step.userId);
    if (pinned) return pinned;
  }
  if (step.useRequesterManager) {
    const requesterEmployee = employees.find(e => e.userId === requestedBy.id);
    const managerEmployee = requesterEmployee?.managerId
      ? employees.find(e => e.id === requesterEmployee.managerId)
      : undefined;
    const manager = managerEmployee?.userId
      ? users.find(u => u.id === managerEmployee.userId)
      : undefined;
    if (manager) return manager;
  }
  return users.find(u => u.role === step.role);
}

/**
 * Builds a new in-progress ApprovalWorkflow for an entity, or returns null when no
 * approval is required (no rule configured for this entity type, or the amount is
 * below the configured threshold) — callers should treat null as "proceed instantly,
 * exactly like before this system existed."
 */
export function buildApprovalWorkflow(
  entityType: ApprovalEntityType,
  entityId: string,
  entityTitle: string,
  amount: number,
  requestedBy: User,
  rules: ApprovalRules | undefined,
  users: User[],
  storeId?: string,
  employees: Employee[] = []
): ApprovalWorkflow | null {
  const rule: ApprovalRule | undefined = rules?.[entityType];
  if (!rule || rule.steps.length === 0) return null;

  const threshold = rule.threshold ?? 0;
  if (threshold > 0 && amount <= threshold) return null;

  const steps: ApprovalStep[] = rule.steps.map((step, index) => {
    const approver = resolveApprover(step, requestedBy, users, employees);
    return {
      stepNumber: index + 1,
      approverId: approver?.id ?? '',
      approverName: approver?.name ?? `Any ${step.role}`,
      status: 'pending',
    };
  });

  return {
    id: `wf-${entityType}-${entityId}-${Date.now()}`,
    entityType,
    entityId,
    entityTitle,
    requestedBy: requestedBy.id,
    requestedByName: requestedBy.name,
    requestedAt: new Date().toISOString(),
    currentStep: 1,
    steps,
    finalStatus: 'in-progress',
    storeId,
  };
}
