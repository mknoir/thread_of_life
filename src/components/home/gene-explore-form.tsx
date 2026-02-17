"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dna } from "lucide-react";

export function GeneExploreForm() {
  const [symbol, setSymbol] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/thread/gene/${trimmed}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row">
      <div className="relative flex-1">
        <Dna className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="e.g. BRCA1, TP53, MTHFR"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="pl-9 font-mono uppercase placeholder:normal-case placeholder:font-sans"
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={!symbol.trim()}>
        Create thread
      </Button>
    </form>
  );
}
