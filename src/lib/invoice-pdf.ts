'use client';

/**
 * Renders a DOM node (the printable invoice card) to a single-page-per-sheet PDF,
 * client-side, so the exact rendered template/branding is what gets attached to
 * emails and WhatsApp messages. Multi-page: the node is sliced into A4-height chunks.
 */
async function nodeToPdf(node: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

export async function nodeToPdfBase64(node: HTMLElement, filename: string): Promise<{ filename: string; base64: string }> {
  const pdf = await nodeToPdf(node);
  const dataUri = pdf.output('datauristring');
  const base64 = dataUri.split(',')[1] ?? '';
  return { filename, base64 };
}

/** Renders the node to the same PDF and saves it straight to the user's device. */
export async function downloadNodeAsPdf(node: HTMLElement, filename: string): Promise<void> {
  const pdf = await nodeToPdf(node);
  pdf.save(filename);
}
