"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* One provider for the app rather than one per tooltip, so `skipDelay`
          works the way it should: the first definition waits, and sweeping
          across a row of metrics afterwards shows them immediately. */}
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        {children}
      </TooltipProvider>
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}
