
'use client'

import { useState, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireRole } from '@/hooks/use-require-role';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type {
  Employee, EmploymentStatus, EmploymentType, IdentityDocument, IssuedAsset, ITAccount,
  AccessGrant, EmployeeDocument, EmployeePerformanceRecord, PerformanceRecordType, EmailLog,
} from '@/types';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Mail, MoreHorizontal, Pencil, PlusCircle, Send, Trash2, UserCheck, UserX } from '@/components/icons';
import { buildOnboardingEmail, buildOffboardingEmail, isSmtpConfigured, sendHrEmail } from '@/lib/hr-email';
import { EMPLOYMENT_TYPES, EMPLOYMENT_STATUSES, statusBadgeVariant, stripUndefinedDeep } from '@/lib/hr';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const IDENTITY_DOCS_COLUMNS: ColumnDef[] = [
  { id: 'type', label: 'Type', locked: true },
  { id: 'number', label: 'Number' },
  { id: 'issued', label: 'Issued' },
  { id: 'expires', label: 'Expires' },
];

const ASSETS_COLUMNS: ColumnDef[] = [
  { id: 'asset', label: 'Asset', locked: true },
  { id: 'serialNumber', label: 'Serial Number' },
  { id: 'dateIssued', label: 'Date Issued' },
  { id: 'dateReturned', label: 'Date Returned' },
];

const IT_ACCOUNTS_COLUMNS: ColumnDef[] = [
  { id: 'system', label: 'System', locked: true },
  { id: 'username', label: 'Username' },
  { id: 'mfa', label: 'MFA' },
  { id: 'status', label: 'Status' },
];

const PERFORMANCE_COLUMNS: ColumnDef[] = [
  { id: 'date', label: 'Date' },
  { id: 'type', label: 'Type' },
  { id: 'title', label: 'Title', locked: true },
  { id: 'rating', label: 'Rating' },
];

const LIFECYCLE_EMAILS_COLUMNS: ColumnDef[] = [
  { id: 'sent', label: 'Sent', locked: true },
  { id: 'type', label: 'Type' },
  { id: 'recipient', label: 'Recipient' },
  { id: 'status', label: 'Status' },
];

const IDENTITY_TYPES: IdentityDocument['type'][] = ['Government ID', 'Passport', 'Visa/Work Permit', "Driver's License", 'Other'];
const DOCUMENT_TYPES: EmployeeDocument['type'][] = ['Employment Contract', 'NDA', 'Confidentiality Agreement', 'Handbook Acknowledgment', 'Code of Conduct Acknowledgment', 'Equipment Handover Form', 'Other'];
const PERFORMANCE_TYPES: PerformanceRecordType[] = ['Probation Review', 'Performance Review', 'Promotion', 'Salary Change', 'Training', 'Award/Recognition', 'Disciplinary Action'];
const COMMON_ASSETS = ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'ID Card', 'SIM Card', 'Security Key', 'Phone', 'Other'];
const COMMON_SYSTEMS = ['Company Email', 'Slack', 'Notion', 'ClickUp', 'Bitwarden', 'GitHub', 'VPN', 'Cloudflare', 'CRM', 'Other'];

function fmt(iso?: string): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'MMM d, yyyy'); } catch { return iso; }
}

function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-1.5">
      <span className="text-sm text-muted-foreground sm:w-44 shrink-0">{label}</span>
      <span className="text-sm">{value || '—'}</span>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EmployeeDetailPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { employees, setEmployees, addActivityLog, user: currentUser, currencySymbol, companyName, isDataLoaded, smtpConfigList, emailTemplates, emailLogs, setEmailLogs } = useAppContext();
  const { toast } = useToast();

  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftBool, setDraftBool] = useState<Record<string, boolean>>({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const identityDocsColumnVisibility = useColumnVisibility('employee-identity-docs', IDENTITY_DOCS_COLUMNS);
  const assetsColumnVisibility = useColumnVisibility('employee-assets', ASSETS_COLUMNS);
  const itAccountsColumnVisibility = useColumnVisibility('employee-it-accounts', IT_ACCOUNTS_COLUMNS);
  const performanceColumnVisibility = useColumnVisibility('employee-performance', PERFORMANCE_COLUMNS);
  const lifecycleEmailsColumnVisibility = useColumnVisibility('employee-lifecycle-emails', LIFECYCLE_EMAILS_COLUMNS);

  const employee = employees.find(e => e.id === params.id);
  const smtpSettings = smtpConfigList.find(s => s.id === 'default');
  const smtpReady = isSmtpConfigured(smtpSettings);
  const offboardingAutoSend = emailTemplates.find(t => t.id === 'offboarding')?.enabled ?? false;

  if (!isDataLoaded) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Employee Profile" />
        <main className="flex-1 p-6 text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Employee Profile" />
        <main className="flex-1 p-6">
          <Card>
            <CardHeader><CardTitle>Employee not found</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">This employee record does not exist or was deleted.</p>
              <Button variant="outline" asChild><Link href="/human-resources/employees"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Employees</Link></Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const manager = employees.find(e => e.id === employee.managerId);
  const status: EmploymentStatus = employee.employmentStatus ?? 'Active';
  const isOffboarded = status === 'Resigned' || status === 'Terminated';
  const employeeEmail = employee.personalEmail || employee.email;
  const employeeLogs = emailLogs
    .filter(l => l.department === 'Human Resources' && l.to === employeeEmail)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const updateEmployee = (patch: Partial<Employee>, logAction?: string, logDetails?: string) => {
    setEmployees(prev => prev.map(e => e.id === employee.id ? stripUndefinedDeep({ ...e, ...patch }) : e));
    if (logAction) addActivityLog(logAction, logDetails ?? `${logAction} for ${employee.name}`);
  };

  const openDialog = (name: string, initial: Record<string, string> = {}, initialBool: Record<string, boolean> = {}) => {
    setDraft(initial);
    setDraftBool(initialBool);
    setActiveDialog(name);
  };
  const closeDialog = () => setActiveDialog(null);
  const d = (key: string) => draft[key] ?? '';
  const setD = (key: string) => (v: string) => setDraft(prev => ({ ...prev, [key]: v }));

  // ---------- Lifecycle emails ----------

  const sendLifecycleEmail = async (type: 'onboarding' | 'offboarding', record: Employee = employee) => {
    if (!smtpReady || !smtpSettings) {
      toast({ variant: 'destructive', title: 'SMTP Not Configured', description: 'Configure and enable SMTP in HR Settings first.' });
      return;
    }
    const to = record.personalEmail || record.email;
    const built = type === 'onboarding'
      ? buildOnboardingEmail(record, companyName, manager?.name)
      : buildOffboardingEmail(record, companyName);
    const logBase: Omit<EmailLog, 'status' | 'error'> = {
      id: `mail-${Date.now()}`,
      department: 'Human Resources',
      templateId: type,
      to,
      subject: built.subject,
      sentAt: new Date().toISOString(),
      sentBy: currentUser?.name ?? 'Unknown',
    };
    setIsSendingEmail(true);
    try {
      await sendHrEmail(smtpSettings, { to, ...built });
      setEmailLogs(prev => [{ ...logBase, status: 'sent' }, ...prev]);
      updateEmployee(
        type === 'onboarding' ? { onboardingEmailSentAt: new Date().toISOString() } : { offboardingEmailSentAt: new Date().toISOString() },
        type === 'onboarding' ? 'Onboarding Email Sent' : 'Offboarding Email Sent',
        `${type === 'onboarding' ? 'Onboarding' : 'Offboarding'} email sent to ${employee.name} (${to}).`
      );
      toast({ title: 'Email Sent', description: `${type === 'onboarding' ? 'Onboarding' : 'Offboarding'} email sent to ${to}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      setEmailLogs(prev => [{ ...logBase, status: 'failed', error: message }, ...prev]);
      toast({ variant: 'destructive', title: 'Email Failed', description: message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ---------- Section save handlers ----------

  const savePersonal = () => {
    updateEmployee({
      preferredName: d('preferredName') || undefined,
      personalEmail: d('personalEmail') || undefined,
      personalPhone: d('personalPhone') || undefined,
      dateOfBirth: d('dateOfBirth') || undefined,
      nationality: d('nationality') || undefined,
      residentialAddress: d('residentialAddress') || undefined,
      emergencyContact: (d('ecName') || d('ecRelationship') || d('ecPhone'))
        ? { name: d('ecName'), relationship: d('ecRelationship'), phone: d('ecPhone') }
        : undefined,
    }, 'Employee Updated', `Updated personal information for ${employee.name}.`);
    toast({ title: 'Personal Information Saved' });
    closeDialog();
  };

  const saveEmployment = () => {
    updateEmployee({
      employeeCode: d('employeeCode') || undefined,
      jobTitle: d('jobTitle') || undefined,
      department: d('department') || undefined,
      employmentType: (d('employmentType') || undefined) as EmploymentType | undefined,
      employmentStatus: (d('employmentStatus') || undefined) as EmploymentStatus | undefined,
      managerId: d('managerId') && d('managerId') !== 'none' ? d('managerId') : undefined,
      dateOfJoining: d('dateOfJoining') || employee.dateOfJoining,
      endDate: d('endDate') || undefined,
      workLocation: d('workLocation') || undefined,
      workingHours: d('workingHours') || undefined,
      probationEndDate: d('probationEndDate') || undefined,
      salary: d('salary') ? Number(d('salary')) : employee.salary,
    }, 'Employee Updated', `Updated employment information for ${employee.name}.`);
    toast({ title: 'Employment Information Saved' });
    closeDialog();
  };

  const saveBanking = () => {
    updateEmployee({
      banking: {
        bankName: d('bankName'),
        accountHolder: d('accountHolder'),
        accountNumber: d('accountNumber'),
        ibanSwift: d('ibanSwift'),
        taxId: d('taxId'),
      },
    }, 'Employee Updated', `Updated banking details for ${employee.name}.`);
    toast({ title: 'Banking Details Saved' });
    closeDialog();
  };

  const saveBackground = () => {
    updateEmployee({
      background: {
        university: d('university'),
        graduationYear: d('graduationYear'),
        previousExperience: d('previousExperience'),
        certifications: d('certifications'),
        languages: d('languages'),
        technicalSkills: d('technicalSkills'),
        portfolio: d('portfolio'),
        linkedin: d('linkedin'),
        github: d('github'),
      },
    }, 'Employee Updated', `Updated skills & background for ${employee.name}.`);
    toast({ title: 'Skills & Background Saved' });
    closeDialog();
  };

  const addIdentityDoc = () => {
    if (!d('documentNumber')) { toast({ variant: 'destructive', title: 'Document number is required.' }); return; }
    const doc: IdentityDocument = stripUndefinedDeep({
      id: `iddoc-${Date.now()}`,
      type: (d('type') || 'Government ID') as IdentityDocument['type'],
      documentNumber: d('documentNumber'),
      issueDate: d('issueDate') || undefined,
      expiryDate: d('expiryDate') || undefined,
      notes: d('notes') || undefined,
    });
    updateEmployee({ identityDocuments: [...(employee.identityDocuments ?? []), doc] }, 'Employee Updated', `Added identity document for ${employee.name}.`);
    closeDialog();
  };

  const addAsset = () => {
    const assetName = d('asset') === 'Other' ? d('assetOther') : d('asset');
    if (!assetName) { toast({ variant: 'destructive', title: 'Asset name is required.' }); return; }
    const asset: IssuedAsset = stripUndefinedDeep({
      id: `asset-${Date.now()}`,
      asset: assetName,
      serialNumber: d('serialNumber') || undefined,
      dateIssued: d('dateIssued') || format(new Date(), 'yyyy-MM-dd'),
      notes: d('notes') || undefined,
    });
    updateEmployee({ issuedAssets: [...(employee.issuedAssets ?? []), asset] }, 'Asset Issued', `Issued ${asset.asset} to ${employee.name}.`);
    closeDialog();
  };

  const addItAccount = () => {
    const systemName = d('system') === 'Other' ? d('systemOther') : d('system');
    if (!systemName) { toast({ variant: 'destructive', title: 'System name is required.' }); return; }
    const account: ITAccount = stripUndefinedDeep({
      id: `itacct-${Date.now()}`,
      system: systemName,
      username: d('username') || undefined,
      mfaEnabled: draftBool.mfaEnabled ?? false,
      status: 'Active' as const,
    });
    updateEmployee({ itAccounts: [...(employee.itAccounts ?? []), account] }, 'IT Account Added', `Added ${account.system} account for ${employee.name}.`);
    closeDialog();
  };

  const addAccessGrant = () => {
    if (!d('resource')) { toast({ variant: 'destructive', title: 'Resource name is required.' }); return; }
    const grant: AccessGrant = stripUndefinedDeep({
      id: `access-${Date.now()}`,
      resource: d('resource'),
      grantedDate: d('grantedDate') || format(new Date(), 'yyyy-MM-dd'),
      notes: d('notes') || undefined,
    });
    updateEmployee({ accessGrants: [...(employee.accessGrants ?? []), grant] }, 'Access Granted', `Granted ${employee.name} access to ${grant.resource}.`);
    closeDialog();
  };

  const addDocument = () => {
    const doc: EmployeeDocument = stripUndefinedDeep({
      id: `empdoc-${Date.now()}`,
      type: (d('type') || 'Employment Contract') as EmployeeDocument['type'],
      title: d('title') || undefined,
      status: (d('status') || 'Pending') as EmployeeDocument['status'],
      signedDate: d('signedDate') || undefined,
      notes: d('notes') || undefined,
    });
    updateEmployee({ documents: [...(employee.documents ?? []), doc] }, 'Employee Document Added', `Added ${doc.type} for ${employee.name}.`);
    closeDialog();
  };

  const addPerformanceRecord = () => {
    if (!d('title')) { toast({ variant: 'destructive', title: 'Title is required.' }); return; }
    const record: EmployeePerformanceRecord = stripUndefinedDeep({
      id: `perf-${Date.now()}`,
      type: (d('type') || 'Performance Review') as PerformanceRecordType,
      date: d('date') || format(new Date(), 'yyyy-MM-dd'),
      title: d('title'),
      notes: d('notes') || undefined,
      rating: d('rating') ? Number(d('rating')) : undefined,
    });
    updateEmployee({ performanceRecords: [...(employee.performanceRecords ?? []), record] }, 'Performance Record Added', `${record.type} recorded for ${employee.name}.`);
    closeDialog();
  };

  const saveExitInfo = () => {
    updateEmployee({
      exitInfo: {
        ...(employee.exitInfo ?? {}),
        lastWorkingDay: d('lastWorkingDay') || undefined,
        reasonForLeaving: d('reasonForLeaving') || undefined,
        notes: d('exitNotes') || undefined,
        exitInterviewCompleted: draftBool.exitInterviewCompleted ?? false,
        assetsReturned: draftBool.assetsReturned ?? false,
        accountsDisabled: draftBool.accountsDisabled ?? false,
        finalPaymentCompleted: draftBool.finalPaymentCompleted ?? false,
        documentsArchived: draftBool.documentsArchived ?? false,
      },
    }, 'Exit Information Updated', `Updated exit information for ${employee.name}.`);
    toast({ title: 'Exit Information Saved' });
    closeDialog();
  };

  const beginOffboarding = async () => {
    const newStatus = (d('exitStatus') || 'Resigned') as EmploymentStatus;
    const patch: Partial<Employee> = {
      employmentStatus: newStatus,
      endDate: d('lastWorkingDay') || undefined,
      exitInfo: {
        ...(employee.exitInfo ?? {}),
        lastWorkingDay: d('lastWorkingDay') || undefined,
        reasonForLeaving: d('reasonForLeaving') || undefined,
      },
    };
    updateEmployee(patch, 'Offboarding Started', `Offboarding started for ${employee.name} (${newStatus}).`);
    toast({ title: 'Offboarding Started', description: `${employee.name} is now marked as ${newStatus}.` });
    closeDialog();
    if (smtpReady && offboardingAutoSend) {
      // Pass the merged record — the `employee` closure is stale until re-render
      await sendLifecycleEmail('offboarding', stripUndefinedDeep({ ...employee, ...patch }));
    }
  };

  // ---------- List item mutations ----------

  const markAssetReturned = (assetId: string) => {
    updateEmployee({
      issuedAssets: (employee.issuedAssets ?? []).map(a => a.id === assetId ? { ...a, dateReturned: format(new Date(), 'yyyy-MM-dd') } : a),
    }, 'Asset Returned', `Asset returned by ${employee.name}.`);
  };

  const toggleAccountStatus = (accountId: string) => {
    updateEmployee({
      itAccounts: (employee.itAccounts ?? []).map(a => a.id === accountId ? { ...a, status: a.status === 'Active' ? 'Disabled' : 'Active' } : a),
    }, 'IT Account Updated', `IT account status changed for ${employee.name}.`);
  };

  const toggleAccountMfa = (accountId: string) => {
    updateEmployee({
      itAccounts: (employee.itAccounts ?? []).map(a => a.id === accountId ? { ...a, mfaEnabled: !a.mfaEnabled } : a),
    });
  };

  const revokeAccess = (grantId: string) => {
    updateEmployee({
      accessGrants: (employee.accessGrants ?? []).map(g => g.id === grantId ? { ...g, revokedDate: format(new Date(), 'yyyy-MM-dd') } : g),
    }, 'Access Revoked', `Access revoked for ${employee.name}.`);
  };

  const setDocumentStatus = (docId: string, docStatus: EmployeeDocument['status']) => {
    updateEmployee({
      documents: (employee.documents ?? []).map(doc => doc.id === docId
        ? stripUndefinedDeep({ ...doc, status: docStatus, signedDate: docStatus === 'Signed' ? format(new Date(), 'yyyy-MM-dd') : doc.signedDate })
        : doc),
    });
  };

  const removeListItem = (field: 'identityDocuments' | 'issuedAssets' | 'itAccounts' | 'accessGrants' | 'documents' | 'performanceRecords', itemId: string) => {
    updateEmployee({ [field]: (employee[field] ?? []).filter((item: { id: string }) => item.id !== itemId) } as Partial<Employee>);
  };

  const returnAllAssets = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    updateEmployee({
      issuedAssets: (employee.issuedAssets ?? []).map(a => a.dateReturned ? a : { ...a, dateReturned: today }),
      exitInfo: { ...(employee.exitInfo ?? {}), assetsReturned: true },
    }, 'Assets Returned', `All assets marked returned for ${employee.name}.`);
    toast({ title: 'All assets marked as returned.' });
  };

  const disableAllAccess = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    updateEmployee({
      itAccounts: (employee.itAccounts ?? []).map(a => ({ ...a, status: 'Disabled' as const })),
      accessGrants: (employee.accessGrants ?? []).map(g => g.revokedDate ? g : { ...g, revokedDate: today }),
      exitInfo: { ...(employee.exitInfo ?? {}), accountsDisabled: true },
    }, 'Accounts Disabled', `All IT accounts disabled and access revoked for ${employee.name}.`);
    toast({ title: 'All accounts disabled and access revoked.' });
  };

  const exit = employee.exitInfo ?? {};
  const outstandingAssets = (employee.issuedAssets ?? []).filter(a => !a.dateReturned).length;
  const activeAccounts = (employee.itAccounts ?? []).filter(a => a.status === 'Active').length;
  const activeGrants = (employee.accessGrants ?? []).filter(g => !g.revokedDate).length;

  return (
    <div className="flex flex-col h-full">
      <Header title={employee.name} />
      <Breadcrumb items={[
        { label: 'Human Resources', href: '/human-resources/dashboard' },
        { label: 'Employees', href: '/human-resources/employees' },
        { label: employee.name },
      ]} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

        {/* ---- Summary header ---- */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={employee.avatar} alt={employee.name} />
                  <AvatarFallback className="text-lg">{employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">{employee.name}</h2>
                    <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {[employee.employeeCode, employee.jobTitle, employee.department].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-muted-foreground text-sm">{employee.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1" disabled={isSendingEmail || !smtpReady} onClick={() => sendLifecycleEmail('onboarding')} title={!smtpReady ? 'Configure SMTP in HR Settings first' : undefined}>
                  <Mail className="h-4 w-4" /> Send Onboarding Email
                </Button>
                {status === 'Onboarding' && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => updateEmployee({ employmentStatus: 'Active' }, 'Employee Activated', `${employee.name} marked Active.`)}>
                    <UserCheck className="h-4 w-4" /> Mark Active
                  </Button>
                )}
                {!isOffboarded ? (
                  <Button variant="destructive" size="sm" className="gap-1" onClick={() => openDialog('offboard', {
                    exitStatus: 'Resigned',
                    lastWorkingDay: exit.lastWorkingDay ?? '',
                    reasonForLeaving: exit.reasonForLeaving ?? '',
                  })}>
                    <UserX className="h-4 w-4" /> Begin Offboarding
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1" disabled={isSendingEmail || !smtpReady} onClick={() => sendLifecycleEmail('offboarding')} title={!smtpReady ? 'Configure SMTP in HR Settings first' : undefined}>
                    <Send className="h-4 w-4" /> Send Offboarding Email
                  </Button>
                )}
              </div>
            </div>
            {!smtpReady && (
              <p className="text-xs text-muted-foreground mt-3">
                Lifecycle emails are disabled — <Link href="/human-resources/settings" className="underline">configure SMTP in HR Settings</Link>.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ---- Tabs ---- */}
        <Tabs defaultValue="personal">
          <TabsList className="flex flex-wrap h-auto justify-start">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="identity">Identity & Banking</TabsTrigger>
            <TabsTrigger value="assets">Assets & IT</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="skills">Skills & Performance</TabsTrigger>
            <TabsTrigger value="exit">Exit & Emails</TabsTrigger>
          </TabsList>

          {/* ---- 1. Personal ---- */}
          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Identification and contact details.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('personal', {
                  preferredName: employee.preferredName ?? '',
                  personalEmail: employee.personalEmail ?? '',
                  personalPhone: employee.personalPhone ?? '',
                  dateOfBirth: employee.dateOfBirth ?? '',
                  nationality: employee.nationality ?? '',
                  residentialAddress: employee.residentialAddress ?? '',
                  ecName: employee.emergencyContact?.name ?? '',
                  ecRelationship: employee.emergencyContact?.relationship ?? '',
                  ecPhone: employee.emergencyContact?.phone ?? '',
                })}><Pencil className="h-4 w-4" /> Edit</Button>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow label="Full Legal Name" value={employee.name} />
                <InfoRow label="Preferred Name" value={employee.preferredName} />
                <InfoRow label="Personal Email" value={employee.personalEmail} />
                <InfoRow label="Personal Phone" value={employee.personalPhone} />
                <InfoRow label="Date of Birth" value={employee.dateOfBirth ? fmt(employee.dateOfBirth) : undefined} />
                <InfoRow label="Nationality" value={employee.nationality} />
                <InfoRow label="Residential Address" value={employee.residentialAddress} />
                <InfoRow label="Emergency Contact" value={employee.emergencyContact
                  ? `${employee.emergencyContact.name} (${employee.emergencyContact.relationship}) — ${employee.emergencyContact.phone}`
                  : undefined} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- 2. Employment ---- */}
          <TabsContent value="employment" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Employment Information</CardTitle>
                  <CardDescription>Role, reporting line and terms of employment.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('employment', {
                  employeeCode: employee.employeeCode ?? '',
                  jobTitle: employee.jobTitle ?? '',
                  department: employee.department ?? '',
                  employmentType: employee.employmentType ?? 'Full-time',
                  employmentStatus: status,
                  managerId: employee.managerId ?? 'none',
                  dateOfJoining: employee.dateOfJoining,
                  endDate: employee.endDate ?? '',
                  workLocation: employee.workLocation ?? '',
                  workingHours: employee.workingHours ?? '',
                  probationEndDate: employee.probationEndDate ?? '',
                  salary: String(employee.salary ?? 0),
                })}><Pencil className="h-4 w-4" /> Edit</Button>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow label="Employee ID" value={employee.employeeCode} />
                <InfoRow label="Job Title" value={employee.jobTitle} />
                <InfoRow label="Department" value={employee.department} />
                <InfoRow label="Employment Type" value={employee.employmentType} />
                <InfoRow label="Manager / Supervisor" value={manager?.name} />
                <InfoRow label="Start Date" value={fmt(employee.dateOfJoining)} />
                <InfoRow label="End Date" value={employee.endDate ? fmt(employee.endDate) : undefined} />
                <InfoRow label="Work Location" value={employee.workLocation} />
                <InfoRow label="Working Hours" value={employee.workingHours} />
                <InfoRow label="Salary / Stipend" value={`${currencySymbol} ${employee.salary.toLocaleString()}`} />
                <InfoRow label="Probation Ends" value={employee.probationEndDate ? fmt(employee.probationEndDate) : undefined} />
                <InfoRow label="Employment Status" value={<Badge variant={statusBadgeVariant(status)}>{status}</Badge>} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- 3 & 4. Identity & Banking ---- */}
          <TabsContent value="identity" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Identity Verification</CardTitle>
                  <CardDescription>Store only what you genuinely need, and protect it carefully.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ColumnVisibilityMenu visibility={identityDocsColumnVisibility} />
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('identityDoc', { type: 'Government ID' })}><PlusCircle className="h-4 w-4" /> Add Document</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Type</TableHead>
                    {identityDocsColumnVisibility.isVisible('number') && <TableHead>Number</TableHead>}
                    {identityDocsColumnVisibility.isVisible('issued') && <TableHead className="hidden md:table-cell">Issued</TableHead>}
                    {identityDocsColumnVisibility.isVisible('expires') && <TableHead className="hidden md:table-cell">Expires</TableHead>}
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(employee.identityDocuments ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No identity documents recorded.</TableCell></TableRow>}
                    {(employee.identityDocuments ?? []).map(idoc => (
                      <TableRow key={idoc.id}>
                        <TableCell>{idoc.type}</TableCell>
                        {identityDocsColumnVisibility.isVisible('number') && <TableCell className="font-mono text-sm">{idoc.documentNumber}</TableCell>}
                        {identityDocsColumnVisibility.isVisible('issued') && <TableCell className="hidden md:table-cell">{fmt(idoc.issueDate)}</TableCell>}
                        {identityDocsColumnVisibility.isVisible('expires') && <TableCell className="hidden md:table-cell">{fmt(idoc.expiryDate)}</TableCell>}
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeListItem('identityDocuments', idoc.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Banking & Payroll</CardTitle>
                  <CardDescription>Payment details for payroll processing.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('banking', {
                  bankName: employee.banking?.bankName ?? '',
                  accountHolder: employee.banking?.accountHolder ?? '',
                  accountNumber: employee.banking?.accountNumber ?? '',
                  ibanSwift: employee.banking?.ibanSwift ?? '',
                  taxId: employee.banking?.taxId ?? '',
                })}><Pencil className="h-4 w-4" /> Edit</Button>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow label="Bank Name" value={employee.banking?.bankName} />
                <InfoRow label="Account Holder" value={employee.banking?.accountHolder} />
                <InfoRow label="Account Number" value={employee.banking?.accountNumber} />
                <InfoRow label="IBAN / SWIFT" value={employee.banking?.ibanSwift} />
                <InfoRow label="Tax ID" value={employee.banking?.taxId} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- 5, 6 & 7. Assets, IT accounts, Access ---- */}
          <TabsContent value="assets" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Company Assets</CardTitle>
                  <CardDescription>Everything issued to this employee.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ColumnVisibilityMenu visibility={assetsColumnVisibility} />
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('asset', { asset: 'Laptop', dateIssued: format(new Date(), 'yyyy-MM-dd') })}><PlusCircle className="h-4 w-4" /> Issue Asset</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Asset</TableHead>
                    {assetsColumnVisibility.isVisible('serialNumber') && <TableHead className="hidden md:table-cell">Serial Number</TableHead>}
                    {assetsColumnVisibility.isVisible('dateIssued') && <TableHead>Date Issued</TableHead>}
                    {assetsColumnVisibility.isVisible('dateReturned') && <TableHead>Date Returned</TableHead>}
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(employee.issuedAssets ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No assets issued.</TableCell></TableRow>}
                    {(employee.issuedAssets ?? []).map(asset => (
                      <TableRow key={asset.id}>
                        <TableCell>{asset.asset}</TableCell>
                        {assetsColumnVisibility.isVisible('serialNumber') && <TableCell className="hidden md:table-cell font-mono text-sm">{asset.serialNumber || '—'}</TableCell>}
                        {assetsColumnVisibility.isVisible('dateIssued') && <TableCell>{fmt(asset.dateIssued)}</TableCell>}
                        {assetsColumnVisibility.isVisible('dateReturned') && <TableCell>{asset.dateReturned ? fmt(asset.dateReturned) : <Badge variant="outline">Outstanding</Badge>}</TableCell>}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!asset.dateReturned && <DropdownMenuItem onClick={() => markAssetReturned(asset.id)}>Mark Returned</DropdownMenuItem>}
                              <DropdownMenuItem className="text-destructive" onClick={() => removeListItem('issuedAssets', asset.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>IT Accounts</CardTitle>
                  <CardDescription>Provisioning checklist — never store passwords here.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ColumnVisibilityMenu visibility={itAccountsColumnVisibility} />
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('itAccount', { system: 'Company Email' }, { mfaEnabled: true })}><PlusCircle className="h-4 w-4" /> Add Account</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>System</TableHead>
                    {itAccountsColumnVisibility.isVisible('username') && <TableHead className="hidden md:table-cell">Username</TableHead>}
                    {itAccountsColumnVisibility.isVisible('mfa') && <TableHead>MFA</TableHead>}
                    {itAccountsColumnVisibility.isVisible('status') && <TableHead>Status</TableHead>}
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(employee.itAccounts ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No IT accounts recorded.</TableCell></TableRow>}
                    {(employee.itAccounts ?? []).map(account => (
                      <TableRow key={account.id}>
                        <TableCell>{account.system}</TableCell>
                        {itAccountsColumnVisibility.isVisible('username') && <TableCell className="hidden md:table-cell">{account.username || '—'}</TableCell>}
                        {itAccountsColumnVisibility.isVisible('mfa') && <TableCell><Switch checked={account.mfaEnabled} onCheckedChange={() => toggleAccountMfa(account.id)} aria-label="MFA enabled" /></TableCell>}
                        {itAccountsColumnVisibility.isVisible('status') && <TableCell><Badge variant={account.status === 'Active' ? 'default' : 'destructive'}>{account.status}</Badge></TableCell>}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toggleAccountStatus(account.id)}>{account.status === 'Active' ? 'Disable' : 'Re-enable'}</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => removeListItem('itAccounts', account.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Access & Permissions</CardTitle>
                  <CardDescription>Folders, servers and tools this employee can access — makes offboarding much easier.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('accessGrant', { grantedDate: format(new Date(), 'yyyy-MM-dd') })}><PlusCircle className="h-4 w-4" /> Grant Access</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>Revoked</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(employee.accessGrants ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No access grants recorded.</TableCell></TableRow>}
                    {(employee.accessGrants ?? []).map(grant => (
                      <TableRow key={grant.id}>
                        <TableCell>{grant.resource}</TableCell>
                        <TableCell>{fmt(grant.grantedDate)}</TableCell>
                        <TableCell>{grant.revokedDate ? fmt(grant.revokedDate) : <Badge variant="outline">Active</Badge>}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!grant.revokedDate && <DropdownMenuItem onClick={() => revokeAccess(grant.id)}>Revoke</DropdownMenuItem>}
                              <DropdownMenuItem className="text-destructive" onClick={() => removeListItem('accessGrants', grant.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- 8. Documents ---- */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>Signed copies of contracts and acknowledgments.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('document', { type: 'Employment Contract', status: 'Pending' })}><PlusCircle className="h-4 w-4" /> Add Document</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="hidden md:table-cell">Signed Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(employee.documents ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No documents recorded.</TableCell></TableRow>}
                    {(employee.documents ?? []).map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>{doc.title || doc.type}</TableCell>
                        <TableCell className="hidden md:table-cell">{fmt(doc.signedDate)}</TableCell>
                        <TableCell><Badge variant={doc.status === 'Signed' ? 'default' : doc.status === 'Archived' ? 'secondary' : 'outline'}>{doc.status}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {doc.status !== 'Signed' && <DropdownMenuItem onClick={() => setDocumentStatus(doc.id, 'Signed')}>Mark Signed</DropdownMenuItem>}
                              {doc.status !== 'Archived' && <DropdownMenuItem onClick={() => setDocumentStatus(doc.id, 'Archived')}>Archive</DropdownMenuItem>}
                              <DropdownMenuItem className="text-destructive" onClick={() => removeListItem('documents', doc.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- 9 & 10. Skills & Performance ---- */}
          <TabsContent value="skills" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Skills & Background</CardTitle>
                  <CardDescription>Education, experience and links — useful for staffing and growth.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('background', {
                  university: employee.background?.university ?? '',
                  graduationYear: employee.background?.graduationYear ?? '',
                  previousExperience: employee.background?.previousExperience ?? '',
                  certifications: employee.background?.certifications ?? '',
                  languages: employee.background?.languages ?? '',
                  technicalSkills: employee.background?.technicalSkills ?? '',
                  portfolio: employee.background?.portfolio ?? '',
                  linkedin: employee.background?.linkedin ?? '',
                  github: employee.background?.github ?? '',
                })}><Pencil className="h-4 w-4" /> Edit</Button>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow label="University" value={employee.background?.university} />
                <InfoRow label="Graduation Year" value={employee.background?.graduationYear} />
                <InfoRow label="Previous Experience" value={employee.background?.previousExperience} />
                <InfoRow label="Certifications" value={employee.background?.certifications} />
                <InfoRow label="Languages" value={employee.background?.languages} />
                <InfoRow label="Technical Skills" value={employee.background?.technicalSkills} />
                <InfoRow label="Portfolio" value={employee.background?.portfolio} />
                <InfoRow label="LinkedIn" value={employee.background?.linkedin} />
                <InfoRow label="GitHub" value={employee.background?.github} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Performance History</CardTitle>
                  <CardDescription>Reviews, promotions, salary changes, training and recognition over time.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ColumnVisibilityMenu visibility={performanceColumnVisibility} />
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('performance', { type: 'Performance Review', date: format(new Date(), 'yyyy-MM-dd') })}><PlusCircle className="h-4 w-4" /> Add Record</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    {performanceColumnVisibility.isVisible('date') && <TableHead>Date</TableHead>}
                    {performanceColumnVisibility.isVisible('type') && <TableHead>Type</TableHead>}
                    <TableHead>Title</TableHead>
                    {performanceColumnVisibility.isVisible('rating') && <TableHead className="hidden md:table-cell">Rating</TableHead>}
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(employee.performanceRecords ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No performance records yet.</TableCell></TableRow>}
                    {[...(employee.performanceRecords ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
                      <TableRow key={record.id}>
                        {performanceColumnVisibility.isVisible('date') && <TableCell>{fmt(record.date)}</TableCell>}
                        {performanceColumnVisibility.isVisible('type') && <TableCell><Badge variant={record.type === 'Disciplinary Action' ? 'destructive' : 'secondary'}>{record.type}</Badge></TableCell>}
                        <TableCell>{record.title}</TableCell>
                        {performanceColumnVisibility.isVisible('rating') && <TableCell className="hidden md:table-cell">{record.rating ? `${record.rating}/5` : '—'}</TableCell>}
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeListItem('performanceRecords', record.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- 11. Exit & Emails ---- */}
          <TabsContent value="exit" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Exit Information</CardTitle>
                  <CardDescription>Offboarding checklist and departure details.</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('exitInfo', {
                  lastWorkingDay: exit.lastWorkingDay ?? '',
                  reasonForLeaving: exit.reasonForLeaving ?? '',
                  exitNotes: exit.notes ?? '',
                }, {
                  exitInterviewCompleted: !!exit.exitInterviewCompleted,
                  assetsReturned: !!exit.assetsReturned,
                  accountsDisabled: !!exit.accountsDisabled,
                  finalPaymentCompleted: !!exit.finalPaymentCompleted,
                  documentsArchived: !!exit.documentsArchived,
                })}><Pencil className="h-4 w-4" /> Edit</Button>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  <InfoRow label="Last Working Day" value={exit.lastWorkingDay ? fmt(exit.lastWorkingDay) : undefined} />
                  <InfoRow label="Reason for Leaving" value={exit.reasonForLeaving} />
                  <InfoRow label="Exit Interview" value={exit.exitInterviewCompleted ? '✅ Completed' : '⬜ Not completed'} />
                  <InfoRow label="Assets Returned" value={exit.assetsReturned ? '✅ Yes' : `⬜ No (${outstandingAssets} outstanding)`} />
                  <InfoRow label="Accounts Disabled" value={exit.accountsDisabled ? '✅ Yes' : `⬜ No (${activeAccounts} active accounts, ${activeGrants} active grants)`} />
                  <InfoRow label="Final Payment" value={exit.finalPaymentCompleted ? '✅ Completed' : '⬜ Pending'} />
                  <InfoRow label="Documents Archived" value={exit.documentsArchived ? '✅ Yes' : '⬜ No'} />
                  <InfoRow label="Notes" value={exit.notes} />
                </div>
                {isOffboarded && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {outstandingAssets > 0 && <Button variant="outline" size="sm" onClick={returnAllAssets}>Mark All Assets Returned</Button>}
                    {(activeAccounts > 0 || activeGrants > 0) && <Button variant="outline" size="sm" onClick={disableAllAccess}>Disable All Accounts & Revoke Access</Button>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle>Lifecycle Emails</CardTitle>
                    <CardDescription>
                      Onboarding email {employee.onboardingEmailSentAt ? `last sent ${format(parseISO(employee.onboardingEmailSentAt), 'MMM d, yyyy HH:mm')}` : 'not sent yet'} ·
                      Offboarding email {employee.offboardingEmailSentAt ? `last sent ${format(parseISO(employee.offboardingEmailSentAt), 'MMM d, yyyy HH:mm')}` : 'not sent yet'}
                    </CardDescription>
                  </div>
                  <ColumnVisibilityMenu visibility={lifecycleEmailsColumnVisibility} />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Sent</TableHead>
                    {lifecycleEmailsColumnVisibility.isVisible('type') && <TableHead>Type</TableHead>}
                    {lifecycleEmailsColumnVisibility.isVisible('recipient') && <TableHead className="hidden md:table-cell">Recipient</TableHead>}
                    {lifecycleEmailsColumnVisibility.isVisible('status') && <TableHead>Status</TableHead>}
                  </TableRow></TableHeader>
                  <TableBody>
                    {employeeLogs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No emails sent to this employee yet.</TableCell></TableRow>}
                    {employeeLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{format(parseISO(log.sentAt), 'MMM d, yyyy HH:mm')}</TableCell>
                        {lifecycleEmailsColumnVisibility.isVisible('type') && <TableCell className="capitalize">{log.templateId}</TableCell>}
                        {lifecycleEmailsColumnVisibility.isVisible('recipient') && <TableCell className="hidden md:table-cell">{log.to}</TableCell>}
                        {lifecycleEmailsColumnVisibility.isVisible('status') && <TableCell><Badge variant={log.status === 'sent' ? 'default' : 'destructive'} title={log.error}>{log.status === 'sent' ? 'Sent' : 'Failed'}</Badge></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ================= Dialogs ================= */}

      {/* Personal */}
      <Dialog open={activeDialog === 'personal'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Edit Personal Information</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="Preferred Name" value={d('preferredName')} onChange={setD('preferredName')} />
              <TextField label="Date of Birth" type="date" value={d('dateOfBirth')} onChange={setD('dateOfBirth')} />
              <TextField label="Personal Email" type="email" value={d('personalEmail')} onChange={setD('personalEmail')} />
              <TextField label="Personal Phone" value={d('personalPhone')} onChange={setD('personalPhone')} />
              <TextField label="Nationality" value={d('nationality')} onChange={setD('nationality')} />
            </div>
            <div className="space-y-1.5">
              <Label>Residential Address</Label>
              <Textarea value={d('residentialAddress')} onChange={(e) => setD('residentialAddress')(e.target.value)} rows={2} />
            </div>
            <p className="text-sm font-medium pt-2">Emergency Contact</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Name" value={d('ecName')} onChange={setD('ecName')} />
              <TextField label="Relationship" value={d('ecRelationship')} onChange={setD('ecRelationship')} />
              <TextField label="Phone" value={d('ecPhone')} onChange={setD('ecPhone')} />
            </div>
          </div>
          <DialogFooter><Button onClick={savePersonal}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employment */}
      <Dialog open={activeDialog === 'employment'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Edit Employment Information</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="Employee ID" value={d('employeeCode')} onChange={setD('employeeCode')} placeholder="EMP-0001" />
              <TextField label="Job Title" value={d('jobTitle')} onChange={setD('jobTitle')} />
              <TextField label="Department" value={d('department')} onChange={setD('department')} />
              <div className="space-y-1.5">
                <Label>Employment Type</Label>
                <Select value={d('employmentType')} onValueChange={setD('employmentType')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Employment Status</Label>
                <Select value={d('employmentStatus')} onValueChange={setD('employmentStatus')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Manager / Supervisor</Label>
                <Select value={d('managerId')} onValueChange={setD('managerId')}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No manager</SelectItem>
                    {employees.filter(e => e.id !== employee.id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <TextField label="Start Date" type="date" value={d('dateOfJoining')} onChange={setD('dateOfJoining')} />
              <TextField label="End Date (if applicable)" type="date" value={d('endDate')} onChange={setD('endDate')} />
              <TextField label="Work Location" value={d('workLocation')} onChange={setD('workLocation')} placeholder="e.g. HQ / Remote" />
              <TextField label="Working Hours" value={d('workingHours')} onChange={setD('workingHours')} placeholder="e.g. Mon–Fri, 9:00–18:00" />
              <TextField label="Probation End Date" type="date" value={d('probationEndDate')} onChange={setD('probationEndDate')} />
              <TextField label={`Salary / Stipend (${currencySymbol})`} type="number" value={d('salary')} onChange={setD('salary')} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveEmployment}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Banking */}
      <Dialog open={activeDialog === 'banking'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Banking & Payroll</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <TextField label="Bank Name" value={d('bankName')} onChange={setD('bankName')} />
            <TextField label="Account Holder" value={d('accountHolder')} onChange={setD('accountHolder')} />
            <TextField label="Account Number" value={d('accountNumber')} onChange={setD('accountNumber')} />
            <TextField label="IBAN / SWIFT" value={d('ibanSwift')} onChange={setD('ibanSwift')} />
            <TextField label="Tax ID" value={d('taxId')} onChange={setD('taxId')} />
          </div>
          <DialogFooter><Button onClick={saveBanking}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Background */}
      <Dialog open={activeDialog === 'background'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Edit Skills & Background</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField label="University" value={d('university')} onChange={setD('university')} />
              <TextField label="Graduation Year" value={d('graduationYear')} onChange={setD('graduationYear')} />
            </div>
            <div className="space-y-1.5">
              <Label>Previous Experience</Label>
              <Textarea value={d('previousExperience')} onChange={(e) => setD('previousExperience')(e.target.value)} rows={3} />
            </div>
            <TextField label="Certifications (comma-separated)" value={d('certifications')} onChange={setD('certifications')} />
            <TextField label="Languages (comma-separated)" value={d('languages')} onChange={setD('languages')} />
            <TextField label="Technical Skills (comma-separated)" value={d('technicalSkills')} onChange={setD('technicalSkills')} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField label="Portfolio URL" value={d('portfolio')} onChange={setD('portfolio')} />
              <TextField label="LinkedIn" value={d('linkedin')} onChange={setD('linkedin')} />
              <TextField label="GitHub" value={d('github')} onChange={setD('github')} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveBackground}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identity document */}
      <Dialog open={activeDialog === 'identityDoc'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Identity Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={d('type')} onValueChange={setD('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{IDENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <TextField label="Document Number" value={d('documentNumber')} onChange={setD('documentNumber')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Issue Date" type="date" value={d('issueDate')} onChange={setD('issueDate')} />
              <TextField label="Expiry Date" type="date" value={d('expiryDate')} onChange={setD('expiryDate')} />
            </div>
            <TextField label="Notes" value={d('notes')} onChange={setD('notes')} />
          </div>
          <DialogFooter><Button onClick={addIdentityDoc}>Add Document</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset */}
      <Dialog open={activeDialog === 'asset'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue Company Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Asset</Label>
              <Select value={d('asset')} onValueChange={setD('asset')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMON_ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {d('asset') === 'Other' && <TextField label="Asset Name" value={d('assetOther')} onChange={setD('assetOther')} />}
            <TextField label="Serial Number" value={d('serialNumber')} onChange={setD('serialNumber')} />
            <TextField label="Date Issued" type="date" value={d('dateIssued')} onChange={setD('dateIssued')} />
            <TextField label="Notes" value={d('notes')} onChange={setD('notes')} />
          </div>
          <DialogFooter><Button onClick={addAsset}>Issue Asset</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IT account */}
      <Dialog open={activeDialog === 'itAccount'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add IT Account</DialogTitle>
            <DialogDescription>Track provisioning as a checklist — never store passwords.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>System</Label>
              <Select value={d('system')} onValueChange={setD('system')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMON_SYSTEMS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {d('system') === 'Other' && <TextField label="System Name" value={d('systemOther')} onChange={setD('systemOther')} />}
            <TextField label="Username" value={d('username')} onChange={setD('username')} />
            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label>MFA Enabled</Label>
              <Switch checked={draftBool.mfaEnabled ?? false} onCheckedChange={(v) => setDraftBool(prev => ({ ...prev, mfaEnabled: v }))} />
            </div>
          </div>
          <DialogFooter><Button onClick={addItAccount}>Add Account</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access grant */}
      <Dialog open={activeDialog === 'accessGrant'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Access</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <TextField label="Resource" value={d('resource')} onChange={setD('resource')} placeholder="e.g. Finance Folder, Production Server, CRM" />
            <TextField label="Granted Date" type="date" value={d('grantedDate')} onChange={setD('grantedDate')} />
            <TextField label="Notes" value={d('notes')} onChange={setD('notes')} />
          </div>
          <DialogFooter><Button onClick={addAccessGrant}>Grant Access</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document */}
      <Dialog open={activeDialog === 'document'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={d('type')} onValueChange={setD('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOCUMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <TextField label="Title (optional)" value={d('title')} onChange={setD('title')} />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={d('status')} onValueChange={setD('status')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Signed">Signed</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {d('status') === 'Signed' && <TextField label="Signed Date" type="date" value={d('signedDate')} onChange={setD('signedDate')} />}
            <TextField label="Notes" value={d('notes')} onChange={setD('notes')} />
          </div>
          <DialogFooter><Button onClick={addDocument}>Add Document</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance record */}
      <Dialog open={activeDialog === 'performance'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Performance Record</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={d('type')} onValueChange={setD('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERFORMANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <TextField label="Title" value={d('title')} onChange={setD('title')} placeholder="e.g. Q2 review, Promotion to Senior" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Date" type="date" value={d('date')} onChange={setD('date')} />
              <TextField label="Rating (1–5, optional)" type="number" value={d('rating')} onChange={setD('rating')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={d('notes')} onChange={(e) => setD('notes')(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter><Button onClick={addPerformanceRecord}>Add Record</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit info */}
      <Dialog open={activeDialog === 'exitInfo'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Edit Exit Information</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1 py-2">
            <TextField label="Last Working Day" type="date" value={d('lastWorkingDay')} onChange={setD('lastWorkingDay')} />
            <TextField label="Reason for Leaving" value={d('reasonForLeaving')} onChange={setD('reasonForLeaving')} />
            <div className="space-y-2 rounded-lg border p-4">
              {([
                ['exitInterviewCompleted', 'Exit interview completed'],
                ['assetsReturned', 'All company assets returned'],
                ['accountsDisabled', 'All accounts disabled'],
                ['finalPaymentCompleted', 'Final payment completed'],
                ['documentsArchived', 'Documents archived'],
              ] as const).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox id={key} checked={draftBool[key] ?? false} onCheckedChange={(v) => setDraftBool(prev => ({ ...prev, [key]: v === true }))} />
                  <Label htmlFor={key} className="font-normal">{label}</Label>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={d('exitNotes')} onChange={(e) => setD('exitNotes')(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveExitInfo}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Begin offboarding */}
      <Dialog open={activeDialog === 'offboard'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Begin Offboarding</DialogTitle>
            <DialogDescription>
              This marks {employee.name} as leaving and opens the exit checklist.
              {smtpReady && offboardingAutoSend ? ' An offboarding email will be sent automatically.' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Departure Type</Label>
              <Select value={d('exitStatus')} onValueChange={setD('exitStatus')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Resigned">Resigned</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TextField label="Last Working Day" type="date" value={d('lastWorkingDay')} onChange={setD('lastWorkingDay')} />
            <TextField label="Reason for Leaving" value={d('reasonForLeaving')} onChange={setD('reasonForLeaving')} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={beginOffboarding}>Begin Offboarding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Permission guard lives in a wrapper so all hooks inside the inner component
// run unconditionally (React rules-of-hooks).
export default function EmployeeDetailPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <EmployeeDetailPageInner />;
}
