'use server';
/**
 * @fileOverview Natural-language business assistant. Translates a question like
 * "show unpaid invoices" or "which products are low in stock" into a structured
 * intent the client executes against already-loaded Firestore data (no data is
 * sent to the model beyond the question, preserving tenant privacy).
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const NlQueryInputSchema = z.object({
  question: z.string().describe("The user's natural-language question."),
});
export type NlQueryInput = z.infer<typeof NlQueryInputSchema>;

const NlQueryOutputSchema = z.object({
  entity: z.enum(['invoices', 'products', 'customers', 'vendors', 'purchaseOrders', 'unknown'])
    .describe('Which dataset the question is about.'),
  filter: z.enum(['unpaid', 'paid', 'overdue', 'low-stock', 'out-of-stock', 'top', 'recent', 'all', 'none'])
    .describe('The filter to apply.'),
  answerTemplate: z.string().describe('A short human sentence framing the result, with {count} placeholder.'),
});
export type NlQueryOutput = z.infer<typeof NlQueryOutputSchema>;

export async function interpretQuery(input: NlQueryInput): Promise<NlQueryOutput> {
  return nlQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'nlQueryPrompt',
  input: { schema: NlQueryInputSchema },
  output: { schema: NlQueryOutputSchema },
  prompt: `Map this ERP question to a structured query. Question: "{{question}}"

Examples:
- "show unpaid invoices" -> entity: invoices, filter: unpaid
- "which products are low in stock" -> entity: products, filter: low-stock
- "top customers" -> entity: customers, filter: top
- "recent purchase orders" -> entity: purchaseOrders, filter: recent`,
});

const nlQueryFlow = ai.defineFlow(
  { name: 'nlQueryFlow', inputSchema: NlQueryInputSchema, outputSchema: NlQueryOutputSchema },
  async input => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI returned no output for NL query.');
    return output;
  }
);
