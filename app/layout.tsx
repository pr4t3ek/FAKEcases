import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "EstimateIQ — Master consulting guesstimates",
  description:
    "Practice guesstimates interactively with an AI interviewer that guides you like a McKinsey/BCG/Bain interviewer — Socratic hints, structured frameworks, and detailed evaluation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
