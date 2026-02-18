"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dna } from "lucide-react";

interface GeneExploreFormProps {
  autoFocus?: boolean;
}

export function GeneExploreForm({ autoFocus = false }: GeneExploreFormProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const normalized = trimmed.toUpperCase();
  const isVariantId = /^(CHR)?[0-9XYM]+-\d+-[A-Z]+-[A-Z]+$/.test(normalized);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (isVariantId) {
      const canonical = normalized.startsWith("CHR")
        ? normalized.slice(3)
        : normalized;
      router.push(`/variant/${canonical}`);
      return;
    }
    router.push(`/thread/gene/${normalized}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row">
      <div className="relative flex-1">
        <Dna className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="e.g. BRCA1 or 17-43057051-C-CC"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 font-mono uppercase placeholder:normal-case placeholder:font-sans"
          autoComplete="off"
        />
      </div>
      <Button type="submit" disabled={!trimmed}>
        {isVariantId ? "Open variant" : "Create thread"}
      </Button>
    </form>
  );
}
