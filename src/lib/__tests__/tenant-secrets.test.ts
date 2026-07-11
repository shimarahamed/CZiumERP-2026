import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emailClient = readFileSync(path.join(root, 'src/lib/email.ts'), 'utf8');
const messagingClient = readFileSync(path.join(root, 'src/lib/messaging.ts'), 'utf8');

function ruleBlock(collection: string) {
  const match = rules.match(new RegExp(`match /${collection}/\\{id\\} \\{([\\s\\S]*?)\\n      \\}`));
  expect(match, `${collection} rule block should exist`).toBeTruthy();
  return match?.[1] ?? '';
}

describe('tenant messaging secrets', () => {
  it('keeps raw SMTP, SMS, and WhatsApp config admin-only in Firestore rules', () => {
    for (const collection of ['smtpConfig', 'smsConfig', 'whatsappConfig']) {
      const block = ruleBlock(collection);
      expect(block).toContain('allow read: if isTenantAdmin(tenantId) && tenantActive(tenantId);');
      expect(block).not.toContain('allow read: if isStaff(tenantId)');
    }
  });

  it('routes browser send helpers through callable Functions instead of legacy API routes', () => {
    expect(emailClient).toContain("httpsCallable(getFunctions(app), 'sendTenantEmail')");
    expect(messagingClient).toContain("httpsCallable(getFunctions(app), 'sendTenantSms')");
    expect(messagingClient).toContain("httpsCallable(getFunctions(app), 'sendTenantWhatsapp')");

    const combinedClient = `${emailClient}\n${messagingClient}`;
    expect(combinedClient).not.toContain('/api/email/send');
    expect(combinedClient).not.toContain('/api/sms/send');
    expect(combinedClient).not.toContain('/api/whatsapp/send');
  });
});
