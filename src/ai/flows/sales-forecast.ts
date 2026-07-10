'use server';

/**
 * @fileOverview An AI agent to provide sales forecasting and trend analysis.
 *
 * - getSalesForecast - A function that takes historical sales data and provides a forecast.
 * - SalesForecastInput - The input type for the getSalesForecast function.
 * - SalesForecastOutput - The return type for the getSalesForecast function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SalesForecastInputSchema = z.object({
  salesData: z.array(z.object({
      month: z.string().describe("The month of sales, formatted as 'YYYY-MM'"),
      revenue: z.number().describe("The total revenue for that month."),
  })).describe('An array of monthly sales data.'),
});

export type SalesForecastInput = z.infer<typeof SalesForecastInputSchema>;

const SalesForecastOutputSchema = z.object({
  forecast: z
    .string()
    .describe('A paragraph summarizing the sales forecast for the next quarter. Be optimistic but realistic.'),
  trendAnalysis: z
    .string()
    .describe('A paragraph analyzing the key trends, seasonality, and potential opportunities based on the provided sales data.'),
});

export type SalesForecastOutput = z.infer<typeof SalesForecastOutputSchema>;

export async function getSalesForecast(
  input: SalesForecastInput
): Promise<SalesForecastOutput> {
  return salesForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'salesForecastPrompt',
  input: {schema: SalesForecastInputSchema},
  output: {schema: SalesForecastOutputSchema},
  prompt: `You are an expert business analyst for a retail company.
  Your task is to analyze the provided monthly sales data and generate a sales forecast for the next business quarter.

  Analyze the data for trends, seasonality, and growth patterns.
  Based on your analysis, create a concise forecast and a brief summary of the key trends.
  Keep your analysis brief and to the point.

  Historical Sales Data:
  {{#each salesData}}
  - {{this.month}}: \${{this.revenue}}
  {{/each}}
`,
});

const salesForecastFlow = ai.defineFlow(
  {
    name: 'salesForecastFlow',
    inputSchema: SalesForecastInputSchema,
    outputSchema: SalesForecastOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) throw new Error('AI returned no output for sales forecast.');
    return output;
  }
);
