"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* One provider for the app rather than one per tooltip, so `skipDelay`
          works the way it should: the first definition waits, and sweeping
          across a row of metrics afterwards shows them immediately. */}
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        {children}
      </TooltipProvider>
      {/* `theme` has to be said out loud: sonner defaults to `light` and does
          not read the document, so toasts were rendering as light cards on a
          dark app long before the theme became the only one. There is no
          `ThemeProvider` above this any more — the palette is a constant, set on
          <html> in layout.tsx. */}
      <Toaster richColors position="top-center" theme="dark" />
    </>
  );
}
