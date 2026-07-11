'use client';

import type { Invoice, ThemeSettings } from '@/types';
import { addMoney, formatNumber, lineTotal, mulMoney, percentOf } from '@/lib/money';
import { formatDateUK, formatTimeUK } from '@/lib/date-format';

type DocumentBranding = {
  companyName: string;
  companyAddress?: string;
  currencySymbol: string;
  themeSettings: ThemeSettings;
};

type RGB = [number, number, number];

function hslToRgb(value?: string): RGB {
  const match = value?.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return [63, 72, 155];
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map(v => Math.round(v * 255)) as RGB;
}

function totals(invoice: Invoice) {
  const gross = addMoney(...invoice.items.map(item => mulMoney(item.price, item.quantity)), 0);
  const net = addMoney(...invoice.items.map(item => lineTotal(item.price, item.quantity, item.discount, item.discountType)), 0);
  const itemDiscount = addMoney(gross, -net);
  const invoiceDiscount = percentOf(net, invoice.discount || 0);
  const discount = addMoney(itemDiscount, invoiceDiscount);
  const tax = percentOf(addMoney(net, -invoiceDiscount), invoice.taxRate || 0);
  return { gross, discount, tax };
}

function money(symbol: string, value: number) {
  return `${symbol} ${formatNumber(value)}`;
}

function savePdf(pdf: { save: (filename: string) => void }, filename: string) {
  pdf.save(filename.replace(/[\\/:*?"<>|]/g, '-'));
}

export async function downloadInvoiceDocumentPdf(invoice: Invoice, branding: DocumentBranding): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', putOnlyUsedFonts: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 42.5;
  const right = width - margin;
  const contentWidth = width - margin * 2;
  const brand = hslToRgb(branding.themeSettings.primaryColor);
  const summary = totals(invoice);
  let y = margin;
  let pageNumber = 1;

  const header = () => {
    pdf.setFillColor(...brand);
    pdf.rect(0, 0, width, 10, 'F');
    pdf.setTextColor(...brand);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(21);
    pdf.text(branding.companyName || 'Company', margin, y + 17);
    pdf.setTextColor(50, 50, 50);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const companyLines = [
      branding.companyAddress,
      branding.themeSettings.companyPhone,
      branding.themeSettings.companyEmail,
      branding.themeSettings.companyWebsite,
      branding.themeSettings.companyRegNumber ? `Reg No: ${branding.themeSettings.companyRegNumber}` : undefined,
    ].filter(Boolean) as string[];
    companyLines.slice(0, 4).forEach((line, index) => pdf.text(line, margin, y + 34 + index * 11));

    pdf.setTextColor(...brand);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text('INVOICE', right, y + 17, { align: 'right' });
    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(10);
    pdf.text(invoice.id, right, y + 34, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date: ${formatDateUK(invoice.date)}`, right, y + 49, { align: 'right' });
    if (invoice.dueDate) pdf.text(`Due: ${formatDateUK(invoice.dueDate)}`, right, y + 64, { align: 'right' });
    y += 93;
  };

  const tableHeader = () => {
    pdf.setFillColor(...brand);
    pdf.roundedRect(margin, y, contentWidth, 23, 3, 3, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('ITEM', margin + 8, y + 15);
    pdf.text('QTY', margin + 300, y + 15, { align: 'right' });
    pdf.text('UNIT PRICE', margin + 390, y + 15, { align: 'right' });
    pdf.text('AMOUNT', right - 8, y + 15, { align: 'right' });
    y += 28;
  };

  const addPage = () => {
    pdf.addPage();
    pageNumber += 1;
    y = margin;
    header();
    tableHeader();
  };

  header();
  pdf.setFillColor(247, 248, 250);
  pdf.roundedRect(margin, y, contentWidth, 59, 4, 4, 'F');
  pdf.setTextColor(95, 99, 110);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('BILL TO', margin + 10, y + 15);
  pdf.setTextColor(30, 30, 35);
  pdf.setFontSize(11);
  pdf.text(invoice.customerName || 'Walk-in Customer', margin + 10, y + 31);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  if (invoice.customerPhone) pdf.text(invoice.customerPhone, margin + 10, y + 45);
  if (invoice.customerEmail) pdf.text(invoice.customerEmail, margin + 190, y + 45);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Status: ${invoice.status.replaceAll('-', ' ')}`, right - 10, y + 22, { align: 'right' });
  if (invoice.paymentMethod) pdf.text(`Payment: ${invoice.paymentMethod}`, right - 10, y + 38, { align: 'right' });
  y += 74;
  tableHeader();

  invoice.items.forEach((item, index) => {
    const nameLines = pdf.splitTextToSize(item.productName || 'Item', 230) as string[];
    const discountLine = (item.discount ?? 0) > 0
      ? `${item.discountType === 'amount' ? money(branding.currencySymbol, item.discount || 0) : `${item.discount}%`} discount`
      : undefined;
    const rowHeight = Math.max(29, nameLines.length * 11 + (discountLine ? 12 : 0) + 8);
    if (y + rowHeight > height - 125) addPage();
    if (index % 2 === 1) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, y - 3, contentWidth, rowHeight, 'F');
    }
    pdf.setTextColor(35, 35, 40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.text(nameLines, margin + 8, y + 10);
    if (discountLine) {
      pdf.setTextColor(105, 105, 115);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(discountLine, margin + 8, y + 10 + nameLines.length * 11);
    }
    pdf.setTextColor(35, 35, 40);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`${formatNumber(item.quantity)} ${item.unit || 'Pcs'}`, margin + 300, y + 10, { align: 'right' });
    pdf.text(money(branding.currencySymbol, item.price), margin + 390, y + 10, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.text(money(branding.currencySymbol, lineTotal(item.price, item.quantity, item.discount, item.discountType)), right - 8, y + 10, { align: 'right' });
    pdf.setDrawColor(225, 227, 232);
    pdf.line(margin, y + rowHeight - 4, right, y + rowHeight - 4);
    y += rowHeight;
  });

  if (y + 128 > height - margin) addPage();
  y += 10;
  const labelX = right - 190;
  const valueX = right;
  pdf.setTextColor(70, 70, 75);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('Subtotal', labelX, y);
  pdf.text(money(branding.currencySymbol, summary.gross), valueX, y, { align: 'right' });
  y += 17;
  if (summary.discount > 0) {
    pdf.text('Discount', labelX, y);
    pdf.text(`-${money(branding.currencySymbol, summary.discount)}`, valueX, y, { align: 'right' });
    y += 17;
  }
  pdf.text(`Tax (${invoice.taxRate || 0}%)`, labelX, y);
  pdf.text(money(branding.currencySymbol, summary.tax), valueX, y, { align: 'right' });
  y += 13;
  pdf.setFillColor(...brand);
  pdf.roundedRect(labelX - 10, y, valueX - labelX + 10, 34, 4, 4, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('TOTAL', labelX, y + 22);
  pdf.text(money(branding.currencySymbol, invoice.amount), valueX - 8, y + 22, { align: 'right' });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setTextColor(130, 130, 135);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('Thank you for your business.', margin, height - 24);
    pdf.text(`Page ${page} of ${pages}`, right, height - 24, { align: 'right' });
  }
  void pageNumber;
  savePdf(pdf, `Invoice-${invoice.id}.pdf`);
}

export async function downloadReceiptDocumentPdf(invoice: Invoice, branding: DocumentBranding): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pageWidth = 226.77; // 80 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const measure = new jsPDF({ unit: 'pt', format: [pageWidth, 1000] });
  measure.setFont('courier', 'normal');
  measure.setFontSize(8.5);
  const itemLines = invoice.items.map(item => measure.splitTextToSize(item.productName || 'Item', 112) as string[]);
  const customLines = Object.entries(invoice.customData ?? {}).filter(([, value]) => value !== '' && value != null).length;
  const calculatedHeight = 235 + itemLines.reduce((sum, lines, index) => sum + Math.max(22, lines.length * 10 + ((invoice.items[index].discount ?? 0) > 0 ? 10 : 0)), 0) + customLines * 11;
  const pageHeight = Math.max(340, calculatedHeight);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [pageWidth, pageHeight], putOnlyUsedFonts: true });
  const right = pageWidth - margin;
  const summary = totals(invoice);
  let y = 18;

  const center = (text: string, size = 8.5, bold = false) => {
    pdf.setFont('courier', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, contentWidth) as string[];
    pdf.text(lines, pageWidth / 2, y, { align: 'center' });
    y += lines.length * (size + 2);
  };
  const rule = (heavy = false) => {
    y += 3;
    pdf.setDrawColor(heavy ? 30 : 130);
    pdf.setLineWidth(heavy ? 1 : 0.4);
    pdf.setLineDashPattern(heavy ? [] : [2, 2], 0);
    pdf.line(margin, y, right, y);
    pdf.setLineDashPattern([], 0);
    y += 8;
  };
  const pair = (label: string, value: string, bold = false) => {
    pdf.setFont('courier', bold ? 'bold' : 'normal');
    pdf.setFontSize(bold ? 10 : 8.5);
    pdf.text(label, margin, y);
    pdf.text(value, right, y, { align: 'right' });
    y += bold ? 15 : 11;
  };

  center(branding.companyName || 'Company', 13, true);
  if (branding.companyAddress) center(branding.companyAddress);
  if (branding.themeSettings.companyPhone) center(branding.themeSettings.companyPhone);
  if (branding.themeSettings.companyWebsite) center(branding.themeSettings.companyWebsite);
  if (branding.themeSettings.companyRegNumber) center(`Reg No: ${branding.themeSettings.companyRegNumber}`);
  rule(true);
  pair('Invoice:', invoice.id);
  pair('Date:', formatDateUK(invoice.date));
  pair('Time:', formatTimeUK(invoice.createdAt ?? invoice.date));
  pair('Status:', invoice.status.replaceAll('-', ' '));
  if (invoice.paymentMethod) pair('Payment:', invoice.paymentMethod);
  pair('Customer:', (invoice.customerName || 'Walk-in').slice(0, 20));
  rule();
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.text('ITEM', margin, y);
  pdf.text('QTY', margin + 128, y, { align: 'right' });
  pdf.text('TOTAL', right, y, { align: 'right' });
  y += 10;
  rule();

  invoice.items.forEach((item, index) => {
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8);
    pdf.text(itemLines[index], margin, y);
    pdf.text(formatNumber(item.quantity), margin + 128, y, { align: 'right' });
    pdf.text(money(branding.currencySymbol, lineTotal(item.price, item.quantity, item.discount, item.discountType)), right, y, { align: 'right' });
    y += Math.max(20, itemLines[index].length * 10);
    if ((item.discount ?? 0) > 0) {
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${item.discountType === 'amount' ? money(branding.currencySymbol, item.discount || 0) : `${item.discount}%`} discount`, margin + 4, y - 8);
      pdf.setTextColor(0, 0, 0);
      y += 5;
    }
  });
  rule();
  pair('Subtotal', money(branding.currencySymbol, summary.gross));
  if (summary.discount > 0) pair('Discount', `-${money(branding.currencySymbol, summary.discount)}`);
  pair(`Tax (${invoice.taxRate || 0}%)`, money(branding.currencySymbol, summary.tax));
  rule(true);
  pair('GRAND TOTAL', money(branding.currencySymbol, invoice.amount), true);
  y += 6;
  center('Thank you for your business!', 8.5, true);
  savePdf(pdf, `Receipt-${invoice.id}.pdf`);
}
