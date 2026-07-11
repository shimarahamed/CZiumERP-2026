
'use client';
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppProvider, useAppContext } from '@/context/AppContext';
import AuthWrapper from '@/components/AuthWrapper';
import FirebaseErrorListener from '@/components/FirebaseErrorListener';
import OfflineBanner from '@/components/OfflineBanner';
import PwaRegister from '@/components/PwaRegister';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { PresenceProvider } from '@/context/PresenceContext';
import { AutomationRunner } from '@/components/AutomationRunner';

// Since the layout is now a client component to access context, we define metadata this way.
// Note: This is a simplified approach. For fully dynamic metadata, more advanced Next.js patterns would be needed.
// export const metadata: Metadata = {
//   title: 'CZium ERP',
//   description: 'A modern ERP for your business, built with Next.js and Firebase.',
//   manifest: '/manifest.json',
// };

function DynamicStyles() {
    const { themeSettings } = useAppContext();
    
    // Apply the tenant's BRAND colors (primary/accent) to both light and dark.
    // The tenant's light backgroundColor must NOT be forced onto .dark — doing
    // so was the dark-mode bug (light background bled through). Dark mode keeps
    // its own dedicated dark background from globals.css and derives a subtly
    // tinted dark background from the brand hue instead.
    const brandHue = (themeSettings.primaryColor || '231 48% 48%').split(' ')[0];
    const styles = `
      :root {
        ${themeSettings.primaryColor ? `--primary: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.backgroundColor ? `--background: ${themeSettings.backgroundColor};` : ''}
        ${themeSettings.accentColor ? `--accent: ${themeSettings.accentColor};` : ''}
        ${themeSettings.primaryColor ? `--ring: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.primaryColor ? `--sidebar-primary: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.primaryColor ? `--sidebar-ring: ${themeSettings.primaryColor};` : ''}
        /* Light sidebar: hover/selection is a soft tint of the brand hue */
        --sidebar-background: ${brandHue} 25% 99%;
        --sidebar-accent: ${brandHue} 45% 93%;
        --sidebar-accent-foreground: ${brandHue} 48% 32%;
      }
      .dark {
        ${themeSettings.primaryColor ? `--primary: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.accentColor ? `--accent: ${themeSettings.accentColor};` : ''}
        ${themeSettings.primaryColor ? `--ring: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.primaryColor ? `--sidebar-primary: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.primaryColor ? `--sidebar-accent: ${themeSettings.primaryColor};` : ''}
        ${themeSettings.primaryColor ? `--sidebar-ring: ${themeSettings.primaryColor};` : ''}
        /* Brand-tinted dark surfaces — colorful, not stale grey */
        --background: ${brandHue} 20% 8%;
        --card: ${brandHue} 18% 11%;
        --popover: ${brandHue} 18% 11%;
        --secondary: ${brandHue} 15% 16%;
        --muted: ${brandHue} 12% 16%;
        --sidebar-background: ${brandHue} 22% 9%;
      }
    `;
    return <style>{styles}</style>;
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link key="manifest" rel="manifest" href="/manifest.json" />
        <link key="preconnect-gfonts" rel="preconnect" href="https://fonts.googleapis.com" />
        <link key="preconnect-gstatic" rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link key="font-inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta key="theme-color" name="theme-color" content="#5b21b6" />
        {/* Blocking script: apply dark class before first paint to prevent FOUC */}
        <script key="dark-mode-init" dangerouslySetInnerHTML={{ __html: `(function(){try{var d=localStorage.getItem('czium-dark-mode');if(d==='true'){document.documentElement.classList.add('dark')}}catch(e){}})();` }} />
      </head>
      <body className="font-body antialiased">
        <AppProvider>
            <PresenceProvider>
              <ErrorBoundary>
                <DynamicStyles />
                {/* AutomationRunner must NOT be a sibling of {children} inside
                    AuthWrapper: that turns AuthWrapper's children into an array
                    containing the RSC page element, which can't carry a key and
                    trips React's "unique key" warning on every re-render. */}
                <AutomationRunner />
                <AuthWrapper>
                    {children}
                </AuthWrapper>
                <Toaster />
                <FirebaseErrorListener />
                <OfflineBanner />
                <PwaRegister />
                <CommandPalette />
                <KeyboardShortcutsModal />
              </ErrorBoundary>
            </PresenceProvider>
        </AppProvider>
      </body>
    </html>
  );
}
