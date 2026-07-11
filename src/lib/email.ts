import type { SmtpConfig, EmailDepartment, EmailTemplateConfig, EmailLog } from '@/types';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ---------------- Shared branded HTML envelope ----------------
// Every notification email (HR's onboarding/offboarding and all department templates)
// renders its content through this same shell, so all outgoing mail looks like one
// consistent, professional system rather than a mix of styled and bare-text emails.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A label/value row inside a details table. Omits itself when value is empty. */
export function emailRow(label: string, value?: string): string {
  if (!value) return '';
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Wraps 1+ rows in the standard details table used under a greeting paragraph. */
export function emailDetailsTable(rows: string): string {
  return `<table style="border-collapse:collapse;margin:16px 0;width:100%;">${rows}</table>`;
}

export function emailListItems(items: string[]): string {
  return items.map((i) => `<li style="margin:4px 0;color:#374151;font-size:14px;">${escapeHtml(i)}</li>`).join('');
}

export function emailParagraph(html: string): string {
  return `<p style="color:#374151;font-size:14px;line-height:1.6;">${html}</p>`;
}

export function emailHeading(text: string): string {
  return `<h2 style="font-size:15px;color:#111827;margin:20px 0 8px;">${escapeHtml(text)}</h2>`;
}

/** The branded card shell: dark header bar with company name, white card body, muted footer. */
export function emailShell(companyName: string, title: string, inner: string, footerNote?: string): string {
  const safeCompany = escapeHtml(companyName || 'Your Company');
  return `
  <div style="background:#f3f4f6;padding:24px;font-family:Segoe UI,Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#111827;padding:20px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;">${safeCompany}</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${escapeHtml(title)}</h1>
        ${inner}
      </div>
      <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">${escapeHtml(footerNote || `This is an automated message from ${companyName || 'your organization'}.`)}</p>
      </div>
    </div>
  </div>`;
}

// Bump this whenever DEFAULT_EMAIL_TEMPLATES content (subject/body/availableVars) changes.
// Tenants whose stored template doc has an older (or missing) templateVersion get
// auto-upgraded to the current catalog content — UNLESS an admin has manually edited
// that template via the Settings editor, which stamps it with the current version and
// permanently opts it out of future auto-upgrades. See EmailNotificationsSettings.tsx.
export const CATALOG_VERSION = 2;

// Default catalog of notification templates, seeded once per tenant the first time
// Settings → Email & Notifications loads and finds no templates yet. Ids are stable
// keys referenced directly from call-sites via sendDepartmentEmail(...).
//
// Each `bodyTemplate` is CONTENT ONLY (greeting, details table, sign-off) — it is
// rendered through `emailShell()` at send time (see renderTemplate below), which is
// what gives every template the same branded header/card/footer as the HR onboarding
// email. Templates should not include <html>/<body> wrappers of their own.
export const DEFAULT_EMAIL_TEMPLATES: Omit<EmailTemplateConfig, 'updatedAt' | 'updatedBy'>[] = [
  {
    id: 'user-invited',
    department: 'System',
    label: 'User Account Created',
    description: 'Sent to a staff member when their user account is created.',
    enabled: false,
    subjectTemplate: 'Your {{companyName}} account is ready',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{userName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">An account has been created for you on <strong>{{companyName}}</strong>. You can sign in with the email address and password provided to you separately.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Name</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{userName}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Role</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{role}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">If you weren\'t expecting this account, please contact your administrator.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Team</p>',
    availableVars: ['userName', 'role', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'invoice-created',
    department: 'Sales & Customers',
    label: 'Invoice Created',
    description: 'Sent to the customer when a new invoice is issued.',
    enabled: false,
    subjectTemplate: 'Invoice {{invoiceId}} from {{companyName}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{customerName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">A new invoice has been issued to you by <strong>{{companyName}}</strong>. Details are below.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Invoice #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{invoiceId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Amount Due</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{{amount}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">If you have any questions about this invoice, just reply to this email.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Team</p>',
    availableVars: ['invoiceId', 'customerName', 'amount', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'payment-received',
    department: 'Sales & Customers',
    label: 'Payment Received',
    description: 'Sent to the customer confirming a payment was received.',
    enabled: false,
    subjectTemplate: 'Payment received — {{companyName}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{customerName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Thank you! We\'ve received your payment for invoice <strong>{{invoiceId}}</strong>.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Invoice #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{invoiceId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Amount Paid</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{{amount}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">This invoice is now marked as paid in our records.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Team</p>',
    availableVars: ['customerName', 'invoiceId', 'amount', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'quotation-sent',
    department: 'Sales & Customers',
    label: 'Quotation Sent',
    description: 'Sent to the customer when a quotation is issued.',
    enabled: false,
    subjectTemplate: 'Your quotation from {{companyName}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{customerName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Please find the details of your quotation from <strong>{{companyName}}</strong> below.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Quotation #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{quotationId}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Reply to this email if you have any questions or would like to proceed.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Team</p>',
    availableVars: ['customerName', 'quotationId', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'vendor-onboarding',
    department: 'Supply Chain',
    label: 'Vendor Onboarding Welcome',
    description: 'Sent to a vendor when they are added as a supplier.',
    enabled: false,
    subjectTemplate: 'Welcome as a supplier to {{companyName}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{contactPerson}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;"><strong>{{vendorName}}</strong> has been onboarded as a supplier to <strong>{{companyName}}</strong>. We look forward to working with you.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Vendor</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{vendorName}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Contact</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{contactPerson}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Purchase orders and further communication will be sent to this email address going forward.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Procurement Team</p>',
    availableVars: ['vendorName', 'contactPerson', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'po-sent-to-vendor',
    department: 'Supply Chain',
    label: 'Purchase Order Sent',
    description: 'Sent to the vendor when a purchase order is created for them.',
    enabled: false,
    subjectTemplate: 'Purchase Order {{poId}} from {{companyName}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{contactPerson}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">A new purchase order has been issued to <strong>{{vendorName}}</strong> by <strong>{{companyName}}</strong>. Please confirm receipt.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">PO #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{poId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Total</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{{amount}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Please reply to this email to confirm you have received this order.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Procurement Team</p>',
    availableVars: ['poId', 'vendorName', 'contactPerson', 'amount', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'po-approved',
    department: 'Supply Chain',
    label: 'Purchase Order Approved',
    description: 'Sent to the vendor when a purchase order is approved internally.',
    enabled: false,
    subjectTemplate: 'Purchase Order {{poId}} approved',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{contactPerson}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Purchase order <strong>{{poId}}</strong> for <strong>{{vendorName}}</strong> has been approved and is ready to proceed.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">PO #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{poId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Status</td><td style="padding:6px 0;color:#111827;font-size:14px;">Approved</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Please proceed with fulfillment. Reach out if you have any questions.</p>' +
      '<p style="color:#374151;font-size:14px;">— The Procurement Team</p>',
    availableVars: ['poId', 'vendorName', 'contactPerson'],
    templateVersion: 2,
  },
  {
    id: 'shipment-dispatched',
    department: 'Shipping & Logistics',
    label: 'Shipment Dispatched',
    description: 'Sent when a shipment departs.',
    enabled: false,
    subjectTemplate: 'Your shipment {{shipmentId}} has been dispatched',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{customerName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Good news — your shipment from <strong>{{companyName}}</strong> is on its way.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Shipment #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{shipmentId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Status</td><td style="padding:6px 0;color:#111827;font-size:14px;">In Transit</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">We will let you know as soon as it is delivered.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Logistics Team</p>',
    availableVars: ['customerName', 'shipmentId', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'shipment-delivered',
    department: 'Shipping & Logistics',
    label: 'Shipment Delivered',
    description: 'Sent when a shipment is marked delivered.',
    enabled: false,
    subjectTemplate: 'Your shipment {{shipmentId}} has been delivered',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{customerName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Your shipment from <strong>{{companyName}}</strong> has been delivered. Thank you for your business!</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Shipment #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{shipmentId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Status</td><td style="padding:6px 0;color:#111827;font-size:14px;">Delivered</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">If anything arrived damaged or incorrect, please reply to this email right away.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Logistics Team</p>',
    availableVars: ['customerName', 'shipmentId', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'payment-reminder',
    department: 'Finance',
    label: 'Payment Reminder',
    description: 'Sent to remind a customer of an overdue invoice.',
    enabled: false,
    subjectTemplate: 'Payment reminder — Invoice {{invoiceId}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{customerName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">This is a friendly reminder that the invoice below from <strong>{{companyName}}</strong> is overdue.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Invoice #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{invoiceId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Amount Due</td><td style="padding:6px 0;color:#b91c1c;font-size:14px;font-weight:600;">{{amount}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Please arrange payment at your earliest convenience. If you\'ve already paid, kindly disregard this reminder.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} Finance Team</p>',
    availableVars: ['customerName', 'invoiceId', 'amount', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'vendor-bill-received',
    department: 'Finance',
    label: 'Vendor Bill Received',
    description: 'Sent to the vendor confirming their bill was recorded.',
    enabled: false,
    subjectTemplate: 'Bill recorded — {{vendorName}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi there,</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">This confirms that a bill from <strong>{{vendorName}}</strong> has been recorded in our accounts payable system.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Vendor</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{vendorName}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Amount</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{{amount}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Payment will be processed according to the agreed terms.</p>' +
      '<p style="color:#374151;font-size:14px;">— The Finance Team</p>',
    availableVars: ['vendorName', 'amount'],
    templateVersion: 2,
  },
  {
    id: 'onboarding',
    department: 'Human Resources',
    label: 'Employee Onboarding Welcome',
    description: 'Sent to a new employee with their onboarding details.',
    enabled: true,
    subjectTemplate: 'Welcome to {{companyName}}, {{firstName}}!',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{firstName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">We\'re delighted to welcome you to <strong>{{companyName}}</strong>! We\'re looking forward to working with you.</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Your manager and HR team will be in touch with the specifics of your first day, systems access, and paperwork.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} HR Team</p>',
    availableVars: ['firstName', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'offboarding',
    department: 'Human Resources',
    label: 'Employee Offboarding Summary',
    description: 'Sent to a departing employee with their exit checklist.',
    enabled: true,
    subjectTemplate: '{{companyName}} — Your offboarding details',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{firstName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">As part of your departure from <strong>{{companyName}}</strong>, HR will follow up with your exit checklist and remaining steps.</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Thank you for your contributions — we wish you all the best in your next chapter.</p>' +
      '<p style="color:#374151;font-size:14px;">— The {{companyName}} HR Team</p>',
    availableVars: ['firstName', 'companyName'],
    templateVersion: 2,
  },
  {
    id: 'ticket-created',
    department: 'Service Desk',
    label: 'Ticket Created',
    description: 'Sent to the submitter confirming a support ticket was created.',
    enabled: false,
    subjectTemplate: 'Support ticket {{ticketId}} created',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{submitterName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Your support ticket has been created. We will get back to you shortly.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Ticket #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{ticketId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Subject</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{subject}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">You can reply to this email to add more details to your ticket.</p>' +
      '<p style="color:#374151;font-size:14px;">— The Service Desk Team</p>',
    availableVars: ['submitterName', 'ticketId', 'subject'],
    templateVersion: 2,
  },
  {
    id: 'ticket-resolved',
    department: 'Service Desk',
    label: 'Ticket Resolved',
    description: 'Sent to the submitter when their ticket is resolved.',
    enabled: false,
    subjectTemplate: 'Support ticket {{ticketId}} resolved',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{submitterName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Your support ticket has been resolved and closed.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Ticket #</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{ticketId}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Status</td><td style="padding:6px 0;color:#111827;font-size:14px;">Resolved</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">If this didn\'t fully resolve your issue, just reply to this email and we\'ll reopen it.</p>' +
      '<p style="color:#374151;font-size:14px;">— The Service Desk Team</p>',
    availableVars: ['submitterName', 'ticketId'],
    templateVersion: 2,
  },
  {
    id: 'task-assigned',
    department: 'Project Management',
    label: 'Task Assigned',
    description: 'Sent to a team member when a task is assigned to them.',
    enabled: false,
    subjectTemplate: 'New task assigned: {{taskTitle}}',
    bodyTemplate:
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Hi {{assigneeName}},</p>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">You have been assigned a new task.</p>' +
      '<table style="border-collapse:collapse;margin:16px 0;width:100%;">' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Task</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{taskTitle}}</td></tr>' +
        '<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Project</td><td style="padding:6px 0;color:#111827;font-size:14px;">{{projectName}}</td></tr>' +
      '</table>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;">Log in to view the full task details and due date.</p>' +
      '<p style="color:#374151;font-size:14px;">— The Project Management Team</p>',
    availableVars: ['assigneeName', 'taskTitle', 'projectName'],
    templateVersion: 2,
  },
];

export const EMAIL_DEPARTMENTS: EmailDepartment[] = [
  'System',
  'Sales & Customers',
  'Supply Chain',
  'Shipping & Logistics',
  'Finance',
  'Human Resources',
  'Service Desk',
  'Project Management',
];

/** True when the SMTP config is complete enough to send email. */
export function isSmtpConfigured(smtp: SmtpConfig | undefined | null): smtp is SmtpConfig {
  return !!smtp && smtp.enabled && !!smtp.host && !!smtp.port && !!smtp.fromEmail;
}

/** Sends an email through the server-side SMTP relay. Throws on failure. */
export async function sendTenantEmail(
  smtpOrMessage: SmtpConfig | { to: string; subject: string; html: string; text: string; attachments?: { filename: string; base64: string }[] },
  maybeMessage?: { to: string; subject: string; html: string; text: string; attachments?: { filename: string; base64: string }[] }
): Promise<void> {
  const message = (maybeMessage ?? smtpOrMessage) as { to: string; subject: string; html: string; text: string; attachments?: { filename: string; base64: string }[] };
  const call = httpsCallable(getFunctions(app), 'sendTenantEmail');
  await call(message);
}

/** Verifies the SMTP connection without sending an email. Throws on failure. */
export async function verifySmtpConnection(smtp: SmtpConfig): Promise<void> {
  const call = httpsCallable(getFunctions(app), 'verifyTenantSmtp');
  await call({ smtp });
}

/**
 * Fills {{key}} placeholders and wraps the result in the shared branded shell —
 * the same dark-header/card/footer envelope used by the HR onboarding email —
 * so every department's notification looks like one consistent system.
 */
export function renderTemplate(
  template: Pick<EmailTemplateConfig, 'subjectTemplate' | 'bodyTemplate' | 'label'>,
  vars: Record<string, string>
): { subject: string; html: string; text: string } {
  const fill = (input: string, escape: boolean) =>
    input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
      const value = vars[key] ?? '';
      return escape ? escapeHtml(value) : value;
    });

  const subject = fill(template.subjectTemplate, false);
  const innerHtml = fill(template.bodyTemplate, true);
  const html = emailShell(vars.companyName || '', template.label, innerHtml);
  const text = innerHtml.replace(/<[^>]+>/g, '').trim();
  return { subject, html, text };
}

type DepartmentEmailContext = {
  smtpConfigList: SmtpConfig[];
  emailTemplates: EmailTemplateConfig[];
  setEmailLogs: (updater: EmailLog[] | ((prev: EmailLog[]) => EmailLog[])) => void;
  companyName?: string;
};

/**
 * The single entry point every module should call to send a notification email.
 * Silently no-ops (logging to console only) when the master SMTP switch or the
 * specific template is disabled — callers never need to check configuration state
 * themselves, and a disabled/misconfigured mailer never blocks the caller's own flow.
 */
export async function sendDepartmentEmail(
  ctx: DepartmentEmailContext,
  department: EmailDepartment,
  templateId: string,
  to: string,
  vars: Record<string, string>,
  sentBy: string
): Promise<void> {
  const template = ctx.emailTemplates.find(t => t.id === templateId && t.department === department);
  if (!template || !template.enabled) {
    console.info(`[email] Skipped "${templateId}" — template missing or disabled.`);
    return;
  }

  const varsWithCompany = vars.companyName ? vars : { ...vars, companyName: ctx.companyName || '' };
  const { subject, html, text } = renderTemplate(template, varsWithCompany);
  const logBase: Omit<EmailLog, 'status' | 'error'> = {
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    department,
    templateId,
    to,
    subject,
    sentAt: new Date().toISOString(),
    sentBy,
  };

  try {
    await sendTenantEmail({ to, subject, html, text });
    ctx.setEmailLogs(prev => [{ ...logBase, status: 'sent' }, ...prev]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    ctx.setEmailLogs(prev => [{ ...logBase, status: 'failed', error: message }, ...prev]);
    console.error(`[email] Failed to send "${templateId}" to ${to}:`, message);
  }
}
