"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * War rooms have their own route.
 *
 * They used to be a filtered view of the library — `/library?type=simulation` —
 * on the reasoning that a simulation is a `Question` like any other and a second
 * catalogue would reimplement the filters this one already has. The filters are
 * in fact shared (`FilterBar` takes a surface), so that cost never materialised,
 * and the two formats are different enough that one grid holding both offered
 * them as interchangeable.
 *
 * The upside here is that the active check is a plain pathname comparison again.
 * Two links sharing a pathname meant it had to read the `type` param too, or
 * both would light up at once.
 */
export function NavLinks({ isAdmin, canHost }: { isAdmin: boolean; canHost: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/library", label: "Library" },
    { href: "/simulations", label: "War rooms" },
    // Professors and admins only. Its own link rather than a tab inside War
    // rooms: hosting a class is a different job from playing one, and burying
    // it under the catalogue would make the catalogue's primary action
    // ambiguous for the one person who uses both.
    ...(canHost ? [{ href: "/host", label: "Host" }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");

        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
