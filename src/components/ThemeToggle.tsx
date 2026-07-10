'use client';

import { Moon, Sun } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useDarkMode } from '@/hooks/use-dark-mode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { isDark, toggle } = useDarkMode();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggle}
            className="rounded-full"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
