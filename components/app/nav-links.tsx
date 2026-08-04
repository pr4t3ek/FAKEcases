"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Simulations are a filtered view of the library rather than a route of their
 * own: a simulation is a `Question` like any other, and a second catalogue would
 * have to reimplement the filters this one already has.
 *
 * That does mean two links share a pathname, so the active check compares the
 * `type` param too — matching on pathname alone would light up both.
 */
export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeType = params.get("type") ?? "";

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/library", label: "Library", type: "" },
    { href: "/library?type=simulation", label: "Simulations", type: "simulation" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => {
        const path = l.href.split("?")[0];
        const pathMatches = pathname === path || pathname.startsWith(path + "/");
        const active =
          l.type === undefined
            ? pathMatches
            : pathMatches && (l.type === "simulation") === (activeType === "simulation");

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
