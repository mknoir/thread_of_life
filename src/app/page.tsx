import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { JourneyGrid } from "@/components/home/journey-grid";
import { GeneExploreForm } from "@/components/home/gene-explore-form";

interface HomeProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { tab } = await searchParams;
  const defaultTab = tab === "explore" ? "explore" : "journeys";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="space-y-4">
        <p className="max-w-2xl text-lg text-muted-foreground">
          Pull the thread on any gene or variant. See what science actually
          knows and what it doesn&apos;t.
        </p>
      </section>

      <Separator />

      {/* Main Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="journeys">Journeys</TabsTrigger>
          <TabsTrigger value="explore">Explore</TabsTrigger>
        </TabsList>

        <TabsContent value="journeys" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Choose a thread to pull
            </h2>
            <p className="text-sm text-muted-foreground">
              Each journey walks you through a gene, a variant, or a question,
              with evidence at every step.
            </p>
          </div>
          <JourneyGrid />
        </TabsContent>

        <TabsContent value="explore" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Go straight to a gene or variant
            </h2>
            <p className="text-sm text-muted-foreground">
              Press{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                ⌘K
              </kbd>{" "}
              to search, or type a gene symbol below.
            </p>
          </div>
          <div className="rounded-lg border border-dashed p-6">
            <GeneExploreForm />
            <p className="mt-4 text-xs text-muted-foreground">
              Enter a gene symbol to generate a narrative thread from ClinVar,
              gnomAD, ClinGen, and GTEx data.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
