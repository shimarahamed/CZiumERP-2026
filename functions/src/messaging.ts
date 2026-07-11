/* eslint-disable require-jsdoc, max-len, quote-props */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";
import nodemailer from "nodemailer";

const TEXTBEE_BASE_URL = "https://api.textbee.dev/api/v1";
const GRAPH_VERSION = "v21.0";

type SmtpConfig = {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  ccEmail?: string;
};

type SmsConfig = {
  enabled?: boolean;
  provider?: "generic" | "textbee";
  gatewayUrl?: string;
  apiKey?: string;
  senderId?: string;
  deviceId?: string;
};

type WhatsappConfig = {
  enabled?: boolean;
  phoneNumberId?: string;
  accessToken?: string;
};

type EmailAttachment = {
  filename: string;
  base64: string;
};

type PdfAttachment = {
  filename: string;
  base64: string;
};

function callerTenant(request: {auth?: {token: Record<string, unknown>}}) {
  const tenantId = request.auth?.token.tenantId as string | undefined;
  const role = request.auth?.token.role as string | undefined;
  if (!tenantId || !role) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  return {tenantId, role};
}

function assertAdmin(role: string) {
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Only tenant admins can manage messaging settings.");
  }
}

async function readConfig<T>(tenantId: string, collectionName: string): Promise<T> {
  const snap = await getFirestore()
    .collection("tenants").doc(tenantId)
    .collection(collectionName).doc("default")
    .get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", `${collectionName} is not configured.`);
  }
  return snap.data() as T;
}

function smtpTransport(smtp: SmtpConfig) {
  if (!smtp.enabled || !smtp.host || !smtp.port || !smtp.fromEmail) {
    throw new HttpsError("failed-precondition", "SMTP is not configured or enabled.");
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure ?? false,
    auth: smtp.username ? {user: smtp.username, pass: smtp.password ?? ""} : undefined,
  });
}

function providerError(provider: string, detail: string) {
  return new HttpsError("unavailable", `${provider}: ${detail}`);
}

export const sendTenantEmail = onCall({timeoutSeconds: 60, memory: "512MiB"}, async (request) => {
  const {tenantId} = callerTenant(request);
  const data = request.data ?? {};
  const to = typeof data.to === "string" ? data.to : "";
  const subject = typeof data.subject === "string" ? data.subject : "";
  const html = typeof data.html === "string" ? data.html : undefined;
  const text = typeof data.text === "string" ? data.text : undefined;
  const attachments = Array.isArray(data.attachments) ?
    data.attachments as EmailAttachment[] :
    undefined;
  if (!to || !subject || (!html && !text)) {
    throw new HttpsError("invalid-argument", "Recipient, subject, and body are required.");
  }

  const smtp = await readConfig<SmtpConfig>(tenantId, "smtpConfig");
  const transporter = smtpTransport(smtp);
  const info = await transporter.sendMail({
    from: `"${smtp.fromName || smtp.fromEmail}" <${smtp.fromEmail}>`,
    replyTo: smtp.replyTo || undefined,
    cc: smtp.ccEmail || undefined,
    to,
    subject,
    html,
    text,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.base64,
      encoding: "base64" as const,
    })),
  });
  return {ok: true, messageId: info.messageId};
});

export const verifyTenantSmtp = onCall({timeoutSeconds: 30}, async (request) => {
  const {tenantId, role} = callerTenant(request);
  assertAdmin(role);
  const smtp = (request.data?.smtp as SmtpConfig | undefined) ??
    await readConfig<SmtpConfig>(tenantId, "smtpConfig");
  await smtpTransport({...smtp, enabled: true}).verify();
  return {ok: true};
});

export const sendTenantSms = onCall({timeoutSeconds: 30}, async (request) => {
  const {tenantId} = callerTenant(request);
  const sms = await readConfig<SmsConfig>(tenantId, "smsConfig");
  const to = typeof request.data?.to === "string" ? request.data.to : "";
  const text = typeof request.data?.text === "string" ? request.data.text : "";
  if (!sms.enabled) {
    throw new HttpsError("failed-precondition", "SMS is not enabled.");
  }
  if (!to || !text) {
    throw new HttpsError("invalid-argument", "Recipient and text are required.");
  }

  if (sms.provider === "textbee") {
    if (!sms.apiKey || !sms.deviceId) {
      throw new HttpsError("failed-precondition", "TextBee is not configured.");
    }
    const res = await fetch(`${TEXTBEE_BASE_URL}/gateway/devices/${sms.deviceId}/send-sms`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-api-key": sms.apiKey},
      body: JSON.stringify({recipients: [to], message: text}),
    });
    if (!res.ok) {
      throw providerError(
        "TextBee send failed",
        await res.text().catch(() => `HTTP ${res.status}`)
      );
    }
    return {ok: true};
  }

  if (!sms.gatewayUrl || !sms.apiKey) {
    throw new HttpsError("failed-precondition", "SMS gateway is not configured.");
  }
  const res = await fetch(sms.gatewayUrl, {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${sms.apiKey}`},
    body: JSON.stringify({to, message: text, sender: sms.senderId || undefined}),
  });
  if (!res.ok) {
    throw providerError(
      "SMS gateway send failed",
      await res.text().catch(() => `HTTP ${res.status}`)
    );
  }
  return {ok: true};
});

export const verifyTenantSms = onCall({timeoutSeconds: 30}, async (request) => {
  const {tenantId, role} = callerTenant(request);
  assertAdmin(role);
  const sms = (request.data?.sms as SmsConfig | undefined) ??
    await readConfig<SmsConfig>(tenantId, "smsConfig");
  if (sms.provider === "textbee") {
    if (!sms.apiKey || !sms.deviceId) {
      throw new HttpsError("failed-precondition", "TextBee is not configured.");
    }
    const res = await fetch(`${TEXTBEE_BASE_URL}/gateway/devices/${sms.deviceId}`, {
      headers: {"x-api-key": sms.apiKey},
    });
    if (!res.ok) {
      throw providerError(
        "TextBee verify failed",
        await res.text().catch(() => `HTTP ${res.status}`)
      );
    }
    return {ok: true};
  }
  if (!sms.gatewayUrl || !sms.apiKey) {
    throw new HttpsError("failed-precondition", "SMS gateway is not configured.");
  }
  const res = await fetch(sms.gatewayUrl, {headers: {Authorization: `Bearer ${sms.apiKey}`}});
  if (!res.ok) {
    throw providerError("SMS gateway verify failed", `HTTP ${res.status}`);
  }
  return {ok: true};
});

async function uploadWhatsappMedia(wa: WhatsappConfig, pdf: PdfAttachment): Promise<string> {
  if (!wa.phoneNumberId || !wa.accessToken) {
    throw new HttpsError("failed-precondition", "WhatsApp is not configured.");
  }
  const bytes = Buffer.from(pdf.base64, "base64");
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([bytes], {type: "application/pdf"}), pdf.filename);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wa.phoneNumberId}/media`, {
    method: "POST",
    headers: {Authorization: `Bearer ${wa.accessToken}`},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw providerError(
      "WhatsApp media upload failed",
      data?.error?.message || `HTTP ${res.status}`
    );
  }
  return data.id as string;
}

export const sendTenantWhatsapp = onCall({timeoutSeconds: 60, memory: "512MiB"}, async (request) => {
  const {tenantId} = callerTenant(request);
  const wa = await readConfig<WhatsappConfig>(tenantId, "whatsappConfig");
  if (!wa.enabled || !wa.phoneNumberId || !wa.accessToken) {
    throw new HttpsError("failed-precondition", "WhatsApp is not configured or enabled.");
  }
  const to = typeof request.data?.to === "string" ? request.data.to : "";
  const text = typeof request.data?.text === "string" ? request.data.text : "";
  const pdf = request.data?.pdf as PdfAttachment | undefined;
  if (!to || !text) {
    throw new HttpsError("invalid-argument", "Recipient and text are required.");
  }

  const messagePayload: Record<string, unknown> = pdf ? {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {id: await uploadWhatsappMedia(wa, pdf), filename: pdf.filename, caption: text},
  } : {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {body: text},
  };

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wa.phoneNumberId}/messages`, {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${wa.accessToken}`},
    body: JSON.stringify(messagePayload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw providerError(
      "WhatsApp send failed",
      data?.error?.message || `HTTP ${res.status}`
    );
  }
  return {ok: true, messageId: data?.messages?.[0]?.id};
});

export const verifyTenantWhatsapp = onCall({timeoutSeconds: 30}, async (request) => {
  const {tenantId, role} = callerTenant(request);
  assertAdmin(role);
  const wa = (request.data?.whatsapp as WhatsappConfig | undefined) ??
    await readConfig<WhatsappConfig>(tenantId, "whatsappConfig");
  if (!wa.phoneNumberId || !wa.accessToken) {
    throw new HttpsError("failed-precondition", "WhatsApp is not configured.");
  }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wa.phoneNumberId}`, {
    headers: {Authorization: `Bearer ${wa.accessToken}`},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw providerError(
      "WhatsApp verify failed",
      data?.error?.message || `HTTP ${res.status}`
    );
  }
  return {ok: true};
});
