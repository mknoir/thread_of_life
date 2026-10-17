"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SearchCommand } from "@/components/shared/search-command";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pathname === "/") return;
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [pathname]);

  if (pathname === "/") return <main>{children}</main>;

  return (
    <>
      <SiteHeader onOpenSearch={handleOpenSearch} />
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-5xl px-6 py-8">
        {children}
      </main>
    </>
  );
}
