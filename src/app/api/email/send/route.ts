import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

type SmtpPayload = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  ccEmail?: string;
};

type SendEmailRequest = {
  smtp: SmtpPayload;
  // When true, only verifies the SMTP connection — no email is sent.
  verifyOnly?: boolean;
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
};

function buildTransport(smtp: SmtpPayload) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
  });
}

export async function POST(request: Request) {
  let body: SendEmailRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { smtp } = body;
  if (!smtp?.host || !smtp?.port || !smtp?.fromEmail) {
    return NextResponse.json(
      { ok: false, error: 'SMTP configuration is incomplete. Host, port and from-email are required.' },
      { status: 400 }
    );
  }

  const transporter = buildTransport(smtp);

  try {
    if (body.verifyOnly) {
      await transporter.verify();
      return NextResponse.json({ ok: true, message: 'SMTP connection verified successfully.' });
    }

    if (!body.to || !body.subject || (!body.html && !body.text)) {
      return NextResponse.json(
        { ok: false, error: 'Recipient, subject and body are required.' },
        { status: 400 }
      );
    }

    const info = await transporter.sendMail({
      from: `"${smtp.fromName || smtp.fromEmail}" <${smtp.fromEmail}>`,
      replyTo: smtp.replyTo || undefined,
      cc: smtp.ccEmail || undefined,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP error.';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
