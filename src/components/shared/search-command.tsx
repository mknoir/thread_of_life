"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
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

const SAMPLE_GENES = [
  { symbol: "BRCA1", name: "Breast cancer type 1 susceptibility protein" },
  { symbol: "BRCA2", name: "Breast cancer type 2 susceptibility protein" },
  { symbol: "TP53", name: "Tumor protein p53" },
  { symbol: "CFTR", name: "Cystic fibrosis transmembrane conductance regulator" },
  { symbol: "MTHFR", name: "Methylenetetrahydrofolate reductase" },
];

const SAMPLE_JOURNEYS = [
  { id: "what-is-brca", title: "What does BRCA1 actually mean for you?" },
  { id: "vus-explained", title: "The mystery of Variants of Uncertain Significance" },
  { id: "population-genetics", title: "How populations shape your genome" },
];

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();

  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search genes, variants, journeys..." />
      <CommandList>
        <CommandEmpty>
          No results found. Try a gene symbol like BRCA1 or TP53.
        </CommandEmpty>

        <CommandGroup heading="Genes">
          {SAMPLE_GENES.flatMap((gene) => [
            <CommandItem
              key={`${gene.symbol}-view`}
              value={`${gene.symbol} ${gene.name} view gene`}
              onSelect={() =>
                runCommand(() => router.push(`/gene/${gene.symbol}`))
              }
            >
              <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{gene.symbol}</span>
              <span className="ml-2 text-muted-foreground">
                — View gene summary
              </span>
            </CommandItem>,
            <CommandItem
              key={`${gene.symbol}-thread`}
              value={`${gene.symbol} ${gene.name} create thread`}
              onSelect={() =>
                runCommand(() => router.push(`/thread/gene/${gene.symbol}`))
              }
            >
              <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{gene.symbol}</span>
              <span className="ml-2 text-muted-foreground">
                — Create narrative thread
              </span>
            </CommandItem>,
          ])}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Journeys">
          {SAMPLE_JOURNEYS.map((journey) => (
            <CommandItem
              key={journey.id}
              value={journey.title}
              onSelect={() =>
                runCommand(() => router.push(`/thread/${journey.id}`))
              }
            >
              <Map className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{journey.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/manifesto"))}
          >
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Go to Manifesto</span>
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
