"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  onOpenSearch: () => void;
}

export function SiteHeader({ onOpenSearch }: SiteHeaderProps) {
  const pathname = usePathname();

  const navItems = [{ href: "/manifesto", label: "About" }];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-6">
        <Link href="/" className="mr-8 flex items-center space-x-2">
          <span className="text-lg font-semibold tracking-tight">
            Thread of Life
          </span>
        </Link>

        <NavigationMenu>
          <NavigationMenuList>
            {navItems.map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      pathname === item.href && "bg-accent"
                    )}
                  >
                    {item.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto flex min-w-0 items-center">
          <Button
            variant="outline"
            size="sm"
            className="relative h-9 w-64 justify-start gap-2 pr-14 text-sm text-muted-foreground"
            onClick={onOpenSearch}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Search genes, variants...</span>
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>
      </div>
    </header>
  );
}
