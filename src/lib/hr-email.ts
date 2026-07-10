import type { Employee, SmtpConfig } from '@/types';
import { format, parseISO } from 'date-fns';
import {
  sendTenantEmail,
  verifySmtpConnection as verifyTenantSmtpConnection,
  isSmtpConfigured as isTenantSmtpConfigured,
  escapeHtml,
  emailRow as row,
  emailListItems as listItems,
  emailShell,
} from '@/lib/email';

export type BuiltEmail = { subject: string; html: string; text: string };

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  id: 'default',
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMMM d, yyyy');
  } catch {
    return iso;
  }
}

// HR emails use the shared shell but keep their own footer disclaimer since
// they carry personal employment details, not a generic automated-message note.
function shell(companyName: string, title: string, inner: string): string {
  return emailShell(companyName, title, inner, `This is an automated message from the ${companyName} HR system. Please do not share it externally.`);
}

export function buildOnboardingEmail(
  employee: Employee,
  companyName: string,
  managerName?: string
): BuiltEmail {
  const firstName = (employee.preferredName || employee.name).split(' ')[0];
  const subject = `Welcome to ${companyName}, ${firstName}! Your onboarding details`;

  const pendingDocs = (employee.documents ?? []).filter((d) => d.status === 'Pending');
  const accounts = (employee.itAccounts ?? []).filter((a) => a.status === 'Active');
  const assets = (employee.issuedAssets ?? []).filter((a) => !a.dateReturned);

  const inner = `
    <p style="color:#374151;font-size:14px;line-height:1.6;">Hi ${escapeHtml(firstName)},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      We're delighted to welcome you to <strong>${escapeHtml(companyName)}</strong>!
      Here is a summary of your role and everything prepared for your first day.
    </p>
    <table style="border-collapse:collapse;margin:16px 0;">
      ${row('Employee ID', employee.employeeCode)}
      ${row('Job Title', employee.jobTitle)}
      ${row('Department', employee.department)}
      ${row('Employment Type', employee.employmentType)}
      ${row('Manager', managerName)}
      ${row('Start Date', fmtDate(employee.dateOfJoining))}
      ${row('Work Location', employee.workLocation)}
      ${row('Working Hours', employee.workingHours)}
      ${row('Probation Ends', employee.probationEndDate ? fmtDate(employee.probationEndDate) : undefined)}
    </table>
    ${pendingDocs.length ? `<h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">Documents to sign</h2>
      <ul style="margin:0;padding-left:20px;">${listItems(pendingDocs.map((d) => d.title || d.type))}</ul>` : ''}
    ${accounts.length ? `<h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">Accounts being set up for you</h2>
      <ul style="margin:0;padding-left:20px;">${listItems(accounts.map((a) => a.system + (a.username ? ` (${a.username})` : '')))}</ul>` : ''}
    ${assets.length ? `<h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">Equipment issued to you</h2>
      <ul style="margin:0;padding-left:20px;">${listItems(assets.map((a) => a.asset + (a.serialNumber ? ` — S/N ${a.serialNumber}` : '')))}</ul>` : ''}
    <p style="color:#374151;font-size:14px;line-height:1.6;margin-top:20px;">
      If anything looks incorrect, or you have any questions before your start date, just reply to this email.
      We're looking forward to working with you!
    </p>
    <p style="color:#374151;font-size:14px;">— The ${escapeHtml(companyName)} HR Team</p>`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Welcome to ${companyName}! Here is a summary of your onboarding:`,
    employee.employeeCode ? `Employee ID: ${employee.employeeCode}` : '',
    employee.jobTitle ? `Job Title: ${employee.jobTitle}` : '',
    employee.department ? `Department: ${employee.department}` : '',
    employee.employmentType ? `Employment Type: ${employee.employmentType}` : '',
    managerName ? `Manager: ${managerName}` : '',
    `Start Date: ${fmtDate(employee.dateOfJoining)}`,
    employee.workLocation ? `Work Location: ${employee.workLocation}` : '',
    employee.workingHours ? `Working Hours: ${employee.workingHours}` : '',
    pendingDocs.length ? `\nDocuments to sign:\n${pendingDocs.map((d) => `- ${d.title || d.type}`).join('\n')}` : '',
    accounts.length ? `\nAccounts being set up:\n${accounts.map((a) => `- ${a.system}`).join('\n')}` : '',
    assets.length ? `\nEquipment issued:\n${assets.map((a) => `- ${a.asset}`).join('\n')}` : '',
    ``,
    `If anything looks incorrect, just reply to this email.`,
    `— The ${companyName} HR Team`,
  ].filter(Boolean).join('\n');

  return { subject, html: shell(companyName, `Welcome aboard, ${firstName}!`, inner), text };
}

export function buildOffboardingEmail(
  employee: Employee,
  companyName: string
): BuiltEmail {
  const firstName = (employee.preferredName || employee.name).split(' ')[0];
  const subject = `${companyName} — Your offboarding details and exit checklist`;
  const exit = employee.exitInfo ?? {};

  const outstandingAssets = (employee.issuedAssets ?? []).filter((a) => !a.dateReturned);
  const activeAccounts = (employee.itAccounts ?? []).filter((a) => a.status === 'Active');

  const checklist: Array<[string, boolean | undefined]> = [
    ['Exit interview', exit.exitInterviewCompleted],
    ['Company assets returned', exit.assetsReturned],
    ['Accounts disabled', exit.accountsDisabled],
    ['Final payment processed', exit.finalPaymentCompleted],
    ['Documents archived', exit.documentsArchived],
  ];

  const inner = `
    <p style="color:#374151;font-size:14px;line-height:1.6;">Hi ${escapeHtml(firstName)},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      As part of your departure from <strong>${escapeHtml(companyName)}</strong>, here is a summary of
      your offboarding and the remaining steps.
    </p>
    <table style="border-collapse:collapse;margin:16px 0;">
      ${row('Last Working Day', fmtDate(exit.lastWorkingDay))}
      ${row('Job Title', employee.jobTitle)}
      ${row('Department', employee.department)}
    </table>
    <h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">Exit checklist</h2>
    <ul style="margin:0;padding-left:20px;">
      ${checklist.map(([label, done]) => `<li style="margin:4px 0;color:#374151;font-size:14px;">${done ? '✅' : '⬜'} ${escapeHtml(label)}</li>`).join('')}
    </ul>
    ${outstandingAssets.length ? `<h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">Items to return</h2>
      <ul style="margin:0;padding-left:20px;">${listItems(outstandingAssets.map((a) => a.asset + (a.serialNumber ? ` — S/N ${a.serialNumber}` : '')))}</ul>` : ''}
    ${activeAccounts.length ? `<h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">Accounts scheduled for deactivation</h2>
      <ul style="margin:0;padding-left:20px;">${listItems(activeAccounts.map((a) => a.system))}</ul>` : ''}
    <p style="color:#374151;font-size:14px;line-height:1.6;margin-top:20px;">
      Please coordinate with HR to complete any outstanding items before your last working day.
      Thank you for your contributions — we wish you all the best in your next chapter.
    </p>
    <p style="color:#374151;font-size:14px;">— The ${escapeHtml(companyName)} HR Team</p>`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Here is a summary of your offboarding from ${companyName}:`,
    `Last Working Day: ${fmtDate(exit.lastWorkingDay)}`,
    ``,
    `Exit checklist:`,
    ...checklist.map(([label, done]) => `- [${done ? 'x' : ' '}] ${label}`),
    outstandingAssets.length ? `\nItems to return:\n${outstandingAssets.map((a) => `- ${a.asset}`).join('\n')}` : '',
    activeAccounts.length ? `\nAccounts scheduled for deactivation:\n${activeAccounts.map((a) => `- ${a.system}`).join('\n')}` : '',
    ``,
    `Please coordinate with HR to complete any outstanding items.`,
    `— The ${companyName} HR Team`,
  ].filter(Boolean).join('\n');

  return { subject, html: shell(companyName, 'Your offboarding summary', inner), text };
}

/** Sends an email through the tenant's shared SMTP relay. Throws on failure. */
export async function sendHrEmail(
  smtp: SmtpConfig,
  message: { to: string; subject: string; html: string; text: string }
): Promise<void> {
  return sendTenantEmail(smtp, message);
}

export const verifySmtpConnection = verifyTenantSmtpConnection;
export const isSmtpConfigured = isTenantSmtpConfigured;
