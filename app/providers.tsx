"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <>
      {/* One provider for the app rather than one per tooltip, so `skipDelay`
          works the way it should: the first definition waits, and sweeping
          across a row of metrics afterwards shows them immediately. */}
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        {children}
      </TooltipProvider>
      {/* `theme` has to be said out loud, and now it has to FOLLOW: sonner
          defaults to `light` and does not read the document, which is how
          toasts rendered as light cards on a dark app for as long as dark mode
          existed. Hardcoding "dark" fixed that in one direction and would break
          it in the other the moment a reader chose light, so it tracks the
          class on <html> instead — see `useTheme`. */}
      <Toaster richColors position="top-center" theme={theme} />
    </>
  );
}
