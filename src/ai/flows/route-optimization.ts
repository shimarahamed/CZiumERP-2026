'use server';
/**
 * @fileOverview An AI agent to provide route optimization for shipments.
 *
 * - getOptimizedRoute - A function that takes a list of shipments and returns an optimized route.
 * - RouteOptimizationInput - The input type for the getOptimizedRoute function.
 * - RouteOptimizationOutput - The return type for the getOptimizedRoute function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Shipment } from '@/types';

// Define the schema for a single shipment, extracting necessary fields from the main Shipment type.
const ShipmentSchemaForRoute = z.object({
  id: z.string(),
  customerName: z.string(),
  shippingAddress: z.string(),
});

const RouteOptimizationInputSchema = z.object({
  shipments: z.array(ShipmentSchemaForRoute).describe("An array of shipments that need to be routed."),
  startAddress: z.string().describe("The starting address for the route, typically the warehouse location."),
});
export type RouteOptimizationInput = z.infer<typeof RouteOptimizationInputSchema>;

// The output will be the same shipments, but sorted in the optimized order.
const RouteOptimizationOutputSchema = z.object({
    optimizedRoute: z.array(ShipmentSchemaForRoute).describe("The array of shipments, sorted in the optimized delivery order."),
    summary: z.string().describe("A brief summary of the route, mentioning the number of stops and any notable geographic clustering."),
});
export type RouteOptimizationOutput = z.infer<typeof RouteOptimizationOutputSchema>;


export async function getOptimizedRoute(
  input: RouteOptimizationInput
): Promise<RouteOptimizationOutput> {
  return routeOptimizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'routeOptimizationPrompt',
  input: { schema: RouteOptimizationInputSchema },
  output: { schema: RouteOptimizationOutputSchema },
  prompt: `You are a logistics and route planning expert. Your task is to create the most efficient delivery route for the given list of shipments.

The route must start at the provided startAddress.

Analyze the list of shipment addresses and arrange them in a logical and efficient order to minimize travel time and distance. Group nearby locations together.

Return the full list of shipments, sorted in the optimized order. Also provide a short summary of the planned route.

Start Address: {{{startAddress}}}

Shipments to route:
{{#each shipments}}
- ID: {{this.id}}, Customer: {{this.customerName}}, Address: {{this.shippingAddress}}
{{/each}}
`,
});

const routeOptimizationFlow = ai.defineFlow(
  {
    name: 'routeOptimizationFlow',
    inputSchema: RouteOptimizationInputSchema,
    outputSchema: RouteOptimizationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI returned no output for route optimization.');
    return output;
  }
);
