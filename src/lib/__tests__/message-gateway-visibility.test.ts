import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const types = readFileSync(path.join(root, 'src/types/index.ts'), 'utf8');
const settings = readFileSync(
  path.join(root, 'src/components/settings/SmsWhatsappSettings.tsx'),
  'utf8'
);
const invoiceDetail = readFileSync(
  path.join(root, 'src/components/InvoiceDetail.tsx'),
  'utf8'
);
const fullInvoice = readFileSync(
  path.join(root, 'src/components/FullInvoice.tsx'),
  'utf8'
);

describe('message gateway visibility settings', () => {
  it('stores non-secret SMS and WhatsApp invoice visibility flags', () => {
    expect(types).toContain('smsGatewayEnabled?: boolean');
    expect(types).toContain('whatsappGatewayEnabled?: boolean');
    expect(settings).toContain('saveThemeSettings({ smsGatewayEnabled: data.enabled })');
    expect(settings).toContain('saveThemeSettings({ whatsappGatewayEnabled: data.enabled })');
  });

  it('hides invoice send buttons unless each gateway is enabled', () => {
    for (const source of [invoiceDetail, fullInvoice]) {
      expect(source).toContain('themeSettings.smsGatewayEnabled === true');
      expect(source).toContain('themeSettings.whatsappGatewayEnabled === true');
      expect(source).not.toContain('const smsEnabled = true');
      expect(source).not.toContain('const whatsappEnabled = true');
    }
  });
});
