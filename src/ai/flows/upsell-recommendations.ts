'use server';

/**
 * @fileOverview An AI agent to provide upsell recommendations based on
 * customer purchase history and current cart items.
 *
 * - getUpsellRecommendations - A function that takes customer purchase history and current cart items and returns upsell recommendations.
 * - UpsellRecommendationsInput - The input type for the getUpsellRecommendations function.
 * - UpsellRecommendationsOutput - The return type for the getUpsellRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpsellRecommendationsInputSchema = z.object({
  customerId: z.string().describe('The ID of the customer.'),
  purchaseHistory: z
    .array(z.string())
    .describe('List of the customer past purchases.'),
  currentCartItems: z
    .array(z.string())
    .describe('List of items currently in the cart.'),
});

export type UpsellRecommendationsInput = z.infer<
  typeof UpsellRecommendationsInputSchema
>;

const UpsellRecommendationsOutputSchema = z.object({
  recommendedItems: z
    .array(z.string())
    .describe('List of recommended items for upselling.'),
  reasoning: z
    .string()
    .describe('Explanation of why these items are recommended.'),
});

export type UpsellRecommendationsOutput = z.infer<
  typeof UpsellRecommendationsOutputSchema
>;

export async function getUpsellRecommendations(
  input: UpsellRecommendationsInput
): Promise<UpsellRecommendationsOutput> {
  return upsellRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'upsellRecommendationsPrompt',
  input: {schema: UpsellRecommendationsInputSchema},
  output: {schema: UpsellRecommendationsOutputSchema},
  prompt: `You are an expert sales assistant providing upsell recommendations.

  Based on the customer's past purchases and current cart items, recommend additional items for upselling.
  Explain your reasoning for each recommendation.

  Customer ID: {{{customerId}}}
  Past Purchases: {{#each purchaseHistory}}{{{this}}}, {{/each}}
  Current Cart Items: {{#each currentCartItems}}{{{this}}}, {{/each}}

  Format your output as a list of recommended items and a brief explanation of why each item is recommended.
`,
});

const upsellRecommendationsFlow = ai.defineFlow(
  {
    name: 'upsellRecommendationsFlow',
    inputSchema: UpsellRecommendationsInputSchema,
    outputSchema: UpsellRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) throw new Error('AI returned no output for upsell recommendations.');
    return output;
  }
);
