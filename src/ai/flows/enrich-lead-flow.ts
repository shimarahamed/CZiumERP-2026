'use server';
/**
 * @fileOverview An AI agent to enrich lead and customer data.
 *
 * - enrichLead - A function that takes a name and company and returns enriched business data.
 * - EnrichLeadInput - The input type for the enrichLead function.
 * - EnrichLeadOutput - The return type for the enrichLead function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EnrichLeadInputSchema = z.object({
  name: z.string().describe('The name of the contact person.'),
  company: z.string().describe('The name of the company.'),
});
export type EnrichLeadInput = z.infer<typeof EnrichLeadInputSchema>;

const EnrichLeadOutputSchema = z.object({
  summary: z.string().describe("A brief summary of the company and what it does."),
  industry: z.string().describe("The primary industry the company operates in."),
  companySize: z.number().optional().describe("An estimated number of employees."),
});
export type EnrichLeadOutput = z.infer<typeof EnrichLeadOutputSchema>;

export async function enrichLead(input: EnrichLeadInput): Promise<EnrichLeadOutput> {
  return enrichLeadFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enrichLeadPrompt',
  input: { schema: EnrichLeadInputSchema },
  output: { schema: EnrichLeadOutputSchema },
  prompt: `You are a business intelligence analyst. Your task is to provide a brief enrichment profile for a given contact based on your training knowledge.

Note: Only use information you are confident about from your training data. If you are uncertain about specific details, provide general industry-level information and clearly indicate it is an estimate.

Contact Name: {{{name}}}
Company: {{{company}}}

Provide:
1. A brief summary of what the company does (or the industry if company is unknown)
2. The primary industry sector
3. An estimated company size (number of employees) — label as "Estimated" if not certain

Be accurate and honest. Do not fabricate specific facts.
`,
});

const enrichLeadFlow = ai.defineFlow(
  {
    name: 'enrichLeadFlow',
    inputSchema: EnrichLeadInputSchema,
    outputSchema: EnrichLeadOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI returned no output for lead enrichment.');
    return output;
  }
);
