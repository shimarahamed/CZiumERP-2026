'use server';
/**
 * @fileOverview OCR flow: extract structured invoice/bill data from a photo or scan.
 * - extractInvoiceData - takes a base64 data URL image, returns structured fields.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InvoiceOcrInputSchema = z.object({
  imageDataUri: z.string().describe("A photo of an invoice/receipt as a data URI (data:image/...;base64,...)."),
});
export type InvoiceOcrInput = z.infer<typeof InvoiceOcrInputSchema>;

const InvoiceOcrOutputSchema = z.object({
  vendorName: z.string().optional().describe('The supplier/vendor name.'),
  invoiceNumber: z.string().optional().describe('The invoice or receipt number.'),
  date: z.string().optional().describe('Invoice date in YYYY-MM-DD if determinable.'),
  currency: z.string().optional().describe('Currency code or symbol.'),
  total: z.number().optional().describe('Grand total as a number.'),
  taxAmount: z.number().optional().describe('Tax/VAT amount if shown.'),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    amount: z.number().optional(),
  })).describe('Line items found on the document.'),
});
export type InvoiceOcrOutput = z.infer<typeof InvoiceOcrOutputSchema>;

export async function extractInvoiceData(input: InvoiceOcrInput): Promise<InvoiceOcrOutput> {
  return invoiceOcrFlow(input);
}

const prompt = ai.definePrompt({
  name: 'invoiceOcrPrompt',
  input: { schema: InvoiceOcrInputSchema },
  output: { schema: InvoiceOcrOutputSchema },
  prompt: `You are an expert bookkeeping assistant. Extract the invoice data from this document image accurately. Only report values you can actually see; leave fields empty if unclear.

{{media url=imageDataUri}}`,
});

const invoiceOcrFlow = ai.defineFlow(
  { name: 'invoiceOcrFlow', inputSchema: InvoiceOcrInputSchema, outputSchema: InvoiceOcrOutputSchema },
  async input => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI returned no output for invoice OCR.');
    return output;
  }
);
