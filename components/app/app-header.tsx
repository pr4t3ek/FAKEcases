import Link from "next/link";
import { Flame, LogOut, Zap } from "lucide-react";
import type { User } from "@prisma/client";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "@/components/app/nav-links";
import { RankBadge } from "@/components/rank-badge";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";

export function AppHeader({ user }: { user: User | null }) {
  const isMember = !!user && !user.isGuest;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Brand href={isMember ? "/dashboard" : "/library"} />
          {isMember && <NavLinks isAdmin={user!.role === "admin"} />}
        </div>

        <div className="flex items-center gap-2">
          {isMember && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                <Flame className="h-3.5 w-3.5" /> {user!.streak}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <Zap className="h-3.5 w-3.5" /> {user!.xp} XP
              </span>
              <RankBadge rank={user!.rank} />
            </div>
          )}
          <ThemeToggle />
          {isMember ? (
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
