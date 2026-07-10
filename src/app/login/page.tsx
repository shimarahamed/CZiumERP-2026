
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { Store } from '@/components/icons';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, themeSettings } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();

  // Live countdown ticker
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = !!(lockedUntil && Date.now() < lockedUntil);

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: 'Enter your email first', description: 'Type your work email above, then press "Forgot password?" again.' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch { /* do not reveal whether the account exists */ }
    toast({ title: 'Check your inbox', description: `If an account exists for ${email}, a password reset link has been sent.` });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isSubmitting) return;

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (result.user) {
      setAttempts(0);
      setLockedUntil(null);
      if (result.superAdmin) {
        router.push('/super-admin');
      } else if (result.user.role === 'cashier') {
        // Cashiers work the register — land them straight on the POS.
        router.push('/pos');
      } else {
        router.push('/');
      }
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        toast({
          variant: 'destructive',
          title: 'Account Locked',
          description: 'Too many failed attempts. Please wait 5 minutes.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: `${result.error ?? 'Invalid email or password.'} ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`,
        });
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              {themeSettings.logoUrl ? (
                <Image src={themeSettings.logoUrl} alt={themeSettings.appName} width={32} height={32} />
              ) : (
                <Store className="w-8 h-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl">{themeSettings.appName} Login</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={isLocked ? 'lockout-msg' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isLocked && (
              <div id="lockout-msg" role="alert" className="text-sm text-destructive text-center font-medium bg-destructive/10 p-2 rounded-md">
                Account locked. Try again in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLocked || isSubmitting}>
              {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>)
                : isLocked ? `Locked (${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')})` : 'Sign In'}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={handleForgotPassword} className="text-primary hover:underline">
                Forgot password?
              </button>
              <Link href="/register" className="text-primary hover:underline">
                Register organization
              </Link>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your username is your work email. Staff accounts are created by your administrator.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
