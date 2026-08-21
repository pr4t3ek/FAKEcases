"use client";

import Link from "next/link";
import { LogOut, Shield, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The account control the header used to lack entirely.
 *
 * It replaced a bare sign-out icon, which was the only account affordance in
 * the app and sat one unguarded click from ending the session. Putting sign-out
 * behind a menu costs a click and stops it being the thing you hit by accident
 * while reaching for the theme toggle.
 *
 * Sign-out stays a form post rather than becoming a link, so it remains a POST
 * that clears the cookie server-side.
 */
export function AccountMenu({
  name,
  email,
  image,
  initials,
  isAdmin,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  initials: string;
  isAdmin: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Avatar src={image} initials={initials} size="sm" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="pb-1">
          <div className="truncate font-medium">{name || "Your account"}</div>
          {email && (
            <div className="truncate text-xs font-normal text-muted-foreground">{email}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound className="h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        {/* Closing the menu on click would be wrong here: the point of the row
            is to SEE the theme change, and it re-labels itself to the next
            direction. */}
        <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
          <ThemeToggle />
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2 text-left">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
