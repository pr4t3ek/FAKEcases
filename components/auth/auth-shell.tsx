import Link from "next/link";
import { Brand } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
          </Card>
          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            No pressure —{" "}
            <Link href="/library" className="underline underline-offset-4 hover:text-primary">
              try a guesstimate as a guest
            </Link>{" "}
            first.
          </p>
        </div>
      </main>
    </div>
  );
}
