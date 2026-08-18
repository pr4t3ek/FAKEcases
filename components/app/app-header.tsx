import Link from "next/link";
import { Flame, Zap } from "lucide-react";
import type { User } from "@prisma/client";
import { initialsFor } from "@/lib/avatar";
import { canHostRooms } from "@/lib/types";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "@/components/app/nav-links";
import { AccountMenu } from "@/components/app/account-menu";
import { JoinRoomDialog } from "@/components/rooms/join-room-dialog";
import { RankBadge } from "@/components/rank-badge";
import { Button } from "@/components/ui/button";

export function AppHeader({ user }: { user: User | null }) {
  const isMember = !!user && !user.isGuest;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Brand href={isMember ? "/dashboard" : "/library"} />
          {isMember && (
            <NavLinks isAdmin={user!.role === "admin"} canHost={canHostRooms(user!.role)} />
          )}
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
            <AccountMenu
              name={user!.name}
              email={user!.email}
              image={user!.image}
              initials={initialsFor(user!.name, user!.email)}
              isAdmin={user!.role === "admin"}
            />
          ) : (
            <>
              {/* Guests never see `NavLinks` at all, and a class joins as guests
                  by design — so without this the students the feature is for
                  would be the only people with no way in. */}
              <JoinRoomDialog variant="button" className="hidden sm:inline-flex" />
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
