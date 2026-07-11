import type { SmsConfig, WhatsappConfig, MessageChannel, MessageLog, EmailDepartment } from '@/types';
import { app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

/** True when the SMS gateway config is complete enough to send. */
export function isSmsConfigured(sms: SmsConfig | undefined | null): sms is SmsConfig {
  if (!sms || !sms.enabled) return false;
  if (sms.provider === 'textbee') return !!sms.apiKey && !!sms.deviceId;
  return !!sms.gatewayUrl && !!sms.apiKey;
}

/** True when the WhatsApp Cloud API config is complete enough to send. */
export function isWhatsappConfigured(wa: WhatsappConfig | undefined | null): wa is WhatsappConfig {
  return !!wa && wa.enabled && !!wa.phoneNumberId && !!wa.accessToken;
}

export type PdfAttachment = {
  filename: string;
  /** Base64-encoded PDF bytes, no data-URI prefix. */
  base64: string;
};

/** Sends a plain-text SMS through the tenant's configured HTTP gateway. Throws on failure. */
export async function sendTenantSms(
  smsOrMessage: SmsConfig | { to: string; text: string },
  maybeMessage?: { to: string; text: string }
): Promise<void> {
  const message = (maybeMessage ?? smsOrMessage) as { to: string; text: string };
  const call = httpsCallable(getFunctions(app), 'sendTenantSms');
  await call(message);
}

/** Verifies the SMS gateway is reachable without sending a real message. Throws on failure. */
export async function verifySmsGateway(sms: SmsConfig): Promise<void> {
  const call = httpsCallable(getFunctions(app), 'verifyTenantSms');
  await call({ sms });
}

/**
 * Sends a WhatsApp message through the tenant's Meta WhatsApp Business Cloud API config.
 * When `pdf` is provided, the PDF is uploaded as WhatsApp media and sent as a document
 * message (with `text` as the caption); otherwise a plain text message is sent. Throws on failure.
 */
export async function sendTenantWhatsapp(
  waOrMessage: WhatsappConfig | { to: string; text: string; pdf?: PdfAttachment },
  maybeMessage?: { to: string; text: string; pdf?: PdfAttachment }
): Promise<void> {
  const message = (maybeMessage ?? waOrMessage) as { to: string; text: string; pdf?: PdfAttachment };
  const call = httpsCallable(getFunctions(app), 'sendTenantWhatsapp');
  await call(message);
}

/** Verifies the WhatsApp Cloud API credentials without sending a real message. Throws on failure. */
export async function verifyWhatsappCredentials(wa: WhatsappConfig): Promise<void> {
  const call = httpsCallable(getFunctions(app), 'verifyTenantWhatsapp');
  await call({ whatsapp: wa });
}

type MessageContext = {
  setMessageLogs: (updater: MessageLog[] | ((prev: MessageLog[]) => MessageLog[])) => void;
};

/** Builds a short preview string for the log table from a message body. */
function preview(text: string): string {
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/**
 * Logs a manual (ad-hoc, non-template) SMS or WhatsApp send — the same "manual send"
 * pattern used by FullInvoice/InvoiceDetail's Email Invoice button, just for SMS/WhatsApp.
 * Callers should already have confirmed the relevant gateway `isConfigured` before calling.
 */
export async function sendAndLogMessage(
  ctx: MessageContext,
  channel: MessageChannel,
  department: EmailDepartment,
  templateId: string,
  to: string,
  text: string,
  sentBy: string,
  send: () => Promise<void>
): Promise<void> {
  const logBase: Omit<MessageLog, 'status' | 'error'> = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel,
    department,
    templateId,
    to,
    preview: preview(text),
    sentAt: new Date().toISOString(),
    sentBy,
  };
  try {
    await send();
    ctx.setMessageLogs(prev => [{ ...logBase, status: 'sent' }, ...prev]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    ctx.setMessageLogs(prev => [{ ...logBase, status: 'failed', error: message }, ...prev]);
    throw error;
  }
}
