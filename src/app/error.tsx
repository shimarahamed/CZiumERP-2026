'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

// Route-segment error boundary: a crash in any page shows this instead of a
// white screen, and Retry re-renders the segment without a full reload.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-2"><AlertTriangle className="h-10 w-10 text-destructive" /></div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            This page hit an unexpected error. Your data is safe — you can retry, or go back to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>Go to dashboard</Button>
        </CardContent>
      </Card>
    </div>
  );
}
