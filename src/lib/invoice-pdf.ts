'use client';

type PdfDocumentKind = 'invoice' | 'receipt';

type PdfOptions = {
  kind?: PdfDocumentKind;
};

/** Capture the complete document, including content hidden by an on-screen scroll area. */
async function captureDocument(node: HTMLElement, kind: PdfDocumentKind) {
  const { default: html2canvas } = await import('html2canvas');
  const marker = `pdf-capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const previousMarker = node.getAttribute('data-pdf-capture');
  node.setAttribute('data-pdf-capture', marker);

  try {
    return await html2canvas(node, {
      // A higher capture density keeps text and fine table rules sharp in the PDF.
      scale: 4,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
      onclone: clonedDocument => {
        const clonedNode = clonedDocument.querySelector<HTMLElement>(`[data-pdf-capture="${marker}"]`);
        if (!clonedNode) return;
        // Match the dimensions and document rules used by the print stylesheet,
        // rather than inheriting the narrower on-screen dialog/card dimensions.
        clonedNode.style.boxSizing = 'border-box';
        clonedNode.style.width = kind === 'receipt' ? '280px' : '680px';
        clonedNode.style.height = 'auto';
        clonedNode.style.maxHeight = 'none';
        clonedNode.style.minHeight = '0';
        clonedNode.style.overflow = 'visible';
        clonedNode.style.background = '#ffffff';
        if (kind === 'receipt') {
          clonedNode.style.fontFamily = 'monospace';
          clonedNode.style.fontSize = '12px';
          clonedNode.style.lineHeight = '1.3';
        }
      },
    });
  } finally {
    if (previousMarker === null) node.removeAttribute('data-pdf-capture');
    else node.setAttribute('data-pdf-capture', previousMarker);
  }
}

async function nodeToPdf(node: HTMLElement, { kind = 'invoice' }: PdfOptions = {}) {
  const [{ jsPDF }, canvas] = await Promise.all([
    import('jspdf'),
    captureDocument(node, kind),
  ]);

  if (kind === 'receipt') {
    // 80 mm thermal-paper width. Its height follows the receipt so it remains one page.
    const pageWidth = 80 * 2.834645669;
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    const pageHeight = Math.max(160, contentHeight + margin * 2);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [pageWidth, pageHeight] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, contentHeight);
    return pdf;
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  // Match the 15 mm margins from the browser print stylesheet.
  const margin = 42.52;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const pixelsPerPoint = canvas.width / contentWidth;
  const sliceHeight = Math.max(1, Math.floor(contentHeight * pixelsPerPoint));

  for (let sourceY = 0, page = 0; sourceY < canvas.height; sourceY += sliceHeight, page += 1) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - sourceY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = currentSliceHeight;
    const context = slice.getContext('2d');
    if (!context) throw new Error('Could not prepare the PDF page.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(canvas, 0, sourceY, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

    if (page > 0) pdf.addPage();
    const renderedHeight = currentSliceHeight / pixelsPerPoint;
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, renderedHeight);
  }

  return pdf;
}

export async function nodeToPdfBase64(node: HTMLElement, filename: string, options?: PdfOptions): Promise<{ filename: string; base64: string }> {
  const pdf = await nodeToPdf(node, options);
  const dataUri = pdf.output('datauristring');
  return { filename, base64: dataUri.split(',')[1] ?? '' };
}

export async function downloadNodeAsPdf(node: HTMLElement, filename: string, options?: PdfOptions): Promise<void> {
  const pdf = await nodeToPdf(node, options);
  pdf.save(filename);
}
