'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppContext';
import { LogOut } from '@/components/icons';
import { useRouter } from 'next/navigation';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function UserNav() {
  const { user, logout } = useAppContext();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
      <Avatar className="h-10 w-10 border-2 border-primary/50">
        <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="person user" />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col group-data-[collapsible=icon]:hidden min-w-0">
        <span className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</span>
        <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        title="Sign out"
        className="ml-auto text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 group-data-[collapsible=icon]:hidden shrink-0"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
