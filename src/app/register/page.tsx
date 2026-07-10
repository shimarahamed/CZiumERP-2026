'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { VerticalBlueprint } from '@/types';

export default function RegisterPage() {
  const { toast } = useToast();
  const [org, setOrg] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [blueprintId, setBlueprintId] = useState('');
  const [blueprints, setBlueprints] = useState<VerticalBlueprint[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'verticalBlueprints'))
      .then(snap => setBlueprints(
        snap.docs
          .map(d => ({ ...(d.data() as VerticalBlueprint), id: d.id }))
          .filter(b => b.isActive !== false)
      ))
      .catch(() => { /* list stays empty; user can still submit with none */ });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'registrationRequests'), {
        organizationName: org.trim(),
        contactName: contactName.trim(),
        contactEmail: email.trim().toLowerCase(),
        blueprintId: blueprintId || 'general',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setDone(true);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Could not submit request',
        description: 'Please try again, or contact support directly.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        {done ? (
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2"><CheckCircle2 className="h-10 w-10 text-primary" /></div>
            <CardTitle className="text-2xl">Request received</CardTitle>
            <CardDescription>
              Our team will review your registration and email {email} once your workspace is ready with your sign-in details.
            </CardDescription>
            <div className="pt-4">
              <Link href="/login" className="text-primary text-sm hover:underline">Back to sign in</Link>
            </div>
          </CardHeader>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Register your organization</CardTitle>
              <CardDescription>
                Request a new workspace. Individual staff accounts are created by your workspace administrator after approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org">Organization name</Label>
                  <Input id="org" required value={org} onChange={e => setOrg(e.target.value)} placeholder="Acme Trading LLC" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Your name</Label>
                  <Input id="contact" required value={contactName} onChange={e => setContactName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Work email</Label>
                  <Input id="reg-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Business type</Label>
                  <Select value={blueprintId} onValueChange={setBlueprintId}>
                    <SelectTrigger><SelectValue placeholder="Select your business type" /></SelectTrigger>
                    <SelectContent>
                      {blueprints.length === 0 ? (
                        <SelectItem value="general">Other / general</SelectItem>
                      ) : blueprints.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>) : 'Request workspace'}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
