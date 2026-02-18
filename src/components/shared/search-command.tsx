"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Map,
  FileText,
  BookOpen,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  type: "gene" | "variant" | "journey";
  id: string;
  title: string;
  description: string;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query, open]);

  const grouped = useMemo(() => {
    const genes = results.filter((r) => r.type === "gene");
    const variants = results.filter((r) => r.type === "variant");
    const journeys = results.filter((r) => r.type === "journey");
    return { genes, variants, journeys };
  }, [results]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search genes, variants, journeys..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading
            ? "Searching..."
            : "No results found. Try BRCA1 or 17-43057051-C-CC."}
        </CommandEmpty>

        {grouped.genes.length > 0 && (
          <CommandGroup heading="Genes">
            {grouped.genes.flatMap((gene) => [
              <CommandItem
                key={`${gene.id}-view`}
                value={`${gene.title} ${gene.description} view gene`}
                onSelect={() =>
                  runCommand(() => router.push(`/gene/${gene.id}`))
                }
              >
                <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{gene.title}</span>
                <span className="ml-2 text-muted-foreground">
                  — View gene summary
                </span>
              </CommandItem>,
              <CommandItem
                key={`${gene.id}-thread`}
                value={`${gene.title} ${gene.description} create thread`}
                onSelect={() =>
                  runCommand(() => router.push(`/thread/gene/${gene.id}`))
                }
              >
                <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{gene.title}</span>
                <span className="ml-2 text-muted-foreground">
                  — Create narrative thread
                </span>
              </CommandItem>,
            ])}
          </CommandGroup>
        )}

        {grouped.variants.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Variants">
              {grouped.variants.map((variant) => (
                <CommandItem
                  key={variant.id}
                  value={`${variant.title} ${variant.description}`}
                  onSelect={() =>
                    runCommand(() => router.push(`/variant/${variant.id}`))
                  }
                >
                  <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{variant.title}</span>
                  <span className="ml-2 text-muted-foreground">
                    — Open variant detail
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {grouped.journeys.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Journeys">
              {grouped.journeys.map((journey) => (
                <CommandItem
                  key={journey.id}
                  value={`${journey.title} ${journey.description}`}
                  onSelect={() =>
                    runCommand(() => router.push(`/thread/${journey.id}`))
                  }
                >
                  <Map className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{journey.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/manifesto"))}
          >
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Go to About</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/"))}
          >
            <FlaskConical className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Explore all journeys</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
