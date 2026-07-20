import type { Customer } from '@/types';

type InvoiceBillToInput = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
};

type CustomerBillToInput = Pick<Customer, 'name' | 'phone' | 'email' | 'billingAddress'>;

export type BillToLine = {
  text: string;
  muted: boolean;
};

export function getBillToLines(invoice: InvoiceBillToInput, customer?: CustomerBillToInput | null): BillToLine[] {
  const lines: BillToLine[] = [];
  const name = invoice.customerName || customer?.name || 'Walk-in Customer';
  if (name) {
    lines.push({ text: name, muted: false });
  }

  const phone = invoice.customerPhone || customer?.phone;
  if (phone) {
    lines.push({ text: phone, muted: true });
  }

  const email = invoice.customerEmail || customer?.email;
  if (email) {
    lines.push({ text: email, muted: true });
  }

  const billingAddress = customer?.billingAddress?.trim();
  if (billingAddress) {
    lines.push({ text: billingAddress, muted: true });
  }

  return lines;
}
