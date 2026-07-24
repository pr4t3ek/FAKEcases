"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/library", label: "Library" },
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
