'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/upsell-recommendations.ts';
import '@/ai/flows/sales-forecast.ts';
import '@/ai/flows/ticket-analysis.ts';
import '@/ai/flows/route-optimization.ts';
import '@/ai/flows/enrich-lead-flow.ts';
