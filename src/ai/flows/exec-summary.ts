'use server';
/**
 * @fileOverview AI executive summary: turns period financials into a concise
 * narrative for leadership. Only aggregate numbers are sent — no row-level data.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExecSummaryInputSchema = z.object({
  period: z.string(),
  totalIncome: z.number(),
  totalExpenses: z.number(),
  netProfit: z.number(),
  topProducts: z.array(z.object({ name: z.string(), profit: z.number() })),
  churnCount: z.number(),
  currency: z.string(),
});
export type ExecSummaryInput = z.infer<typeof ExecSummaryInputSchema>;

const ExecSummaryOutputSchema = z.object({
  headline: z.string().describe('One-sentence headline of the period.'),
  narrative: z.string().describe('A 3-5 sentence executive narrative.'),
  actions: z.array(z.string()).describe('2-4 concrete recommended actions.'),
});
export type ExecSummaryOutput = z.infer<typeof ExecSummaryOutputSchema>;

export async function generateExecSummary(input: ExecSummaryInput): Promise<ExecSummaryOutput> {
  return execSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'execSummaryPrompt',
  input: { schema: ExecSummaryInputSchema },
  output: { schema: ExecSummaryOutputSchema },
  prompt: `You are a CFO's analyst. Write a crisp executive summary for {{period}}.
Income: {{currency}}{{totalIncome}}, Expenses: {{currency}}{{totalExpenses}}, Net: {{currency}}{{netProfit}}.
Top products by profit: {{#each topProducts}}{{this.name}} ({{currency}}{{this.profit}}); {{/each}}
Customers at churn risk: {{churnCount}}.
Be factual, specific, and action-oriented.`,
});

const execSummaryFlow = ai.defineFlow(
  { name: 'execSummaryFlow', inputSchema: ExecSummaryInputSchema, outputSchema: ExecSummaryOutputSchema },
  async input => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI returned no output for exec summary.');
    return output;
  }
);
