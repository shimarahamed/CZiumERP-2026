'use server';
/**
 * @fileOverview An AI agent to analyze and categorize support tickets.
 *
 * - analyzeTicket - A function that suggests a priority and category for a support ticket.
 * - TicketAnalysisInput - The input type for the analyzeTicket function.
 * - TicketAnalysisOutput - The return type for the analyzeTicket function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TicketAnalysisInputSchema = z.object({
  title: z.string().describe('The title of the support ticket.'),
  description: z.string().describe('The full description of the support ticket issue.'),
});
export type TicketAnalysisInput = z.infer<typeof TicketAnalysisInputSchema>;

const TicketAnalysisOutputSchema = z.object({
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .describe('The suggested priority for the ticket.'),
  category: z
    .string()
    .describe(
      'A suggested category for the ticket. Examples: Hardware, Software, Billing, Account, General Inquiry, Bug Report, Feature Request.'
    ),
});
export type TicketAnalysisOutput = z.infer<typeof TicketAnalysisOutputSchema>;

export async function analyzeTicket(input: TicketAnalysisInput): Promise<TicketAnalysisOutput> {
  return ticketAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'ticketAnalysisPrompt',
  input: {schema: TicketAnalysisInputSchema},
  output: {schema: TicketAnalysisOutputSchema},
  prompt: `You are an expert support desk manager. Your task is to analyze the following support ticket and determine its priority and category.

Analyze the title and description to understand the user's issue.

- Base the **priority** on the urgency and impact described. If the user mentions words like "urgent," "down," "cannot work," or "critical," the priority should be high or urgent.
- Base the **category** on the subject matter. Use one of the following categories: Hardware, Software, Billing, Account, General Inquiry, Bug Report, Feature Request.

Ticket Title: {{{title}}}
Ticket Description: {{{description}}}

Provide only the suggested priority and category in the specified output format.`,
});

const ticketAnalysisFlow = ai.defineFlow(
  {
    name: 'ticketAnalysisFlow',
    inputSchema: TicketAnalysisInputSchema,
    outputSchema: TicketAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) throw new Error('AI returned no output for ticket analysis.');
    return output;
  }
);
