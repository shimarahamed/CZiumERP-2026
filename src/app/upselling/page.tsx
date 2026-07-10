
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { getUpsellRecommendations } from '@/ai/flows/upsell-recommendations';
import type { UpsellRecommendationsOutput } from '@/ai/flows/upsell-recommendations';
import { Lightbulb, Loader2, Sparkles } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';

const formSchema = z.object({
  customerId: z.string().min(1, { message: "Please select a customer." }),
  purchaseHistory: z.string().min(1, { message: "Purchase history cannot be empty." }),
  currentCartItems: z.string().min(1, { message: "Current cart items cannot be empty." }),
});

export default function UpsellingPage() {
  const { customers } = useAppContext();
  const [recommendations, setRecommendations] = useState<UpsellRecommendationsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: '',
      purchaseHistory: '',
      currentCartItems: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setRecommendations(null);

    try {
      const result = await getUpsellRecommendations({
        customerId: values.customerId,
        purchaseHistory: values.purchaseHistory.split(',').map(item => item.trim()),
        currentCartItems: values.currentCartItems.split(',').map(item => item.trim()),
      });
      setRecommendations(result);
    } catch (error) {
      console.error("Failed to get upsell recommendations:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get recommendations. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Upselling Tool" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Get Recommendations</CardTitle>
              <CardDescription>Enter customer data to get AI-powered upsell suggestions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchaseHistory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Past Purchases (comma-separated)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., Coffee, Croissant, Muffin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currentCartItems"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Cart Items (comma-separated)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., Espresso, Sandwich" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Suggestions
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>Suggestions will appear here after analysis.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              {isLoading ? (
                <div className="text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Our AI is thinking...</p>
                </div>
              ) : recommendations ? (
                <div className="space-y-4 w-full">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />Recommended Items</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {recommendations.recommendedItems.map((item, index) => (
                        <li key={`recommended-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Reasoning</h3>
                    <p className="text-sm text-muted-foreground bg-accent/10 p-3 rounded-md">{recommendations.reasoning}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>Your recommendations are waiting.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
