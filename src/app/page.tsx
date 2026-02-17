import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { JourneyGrid } from "@/components/home/journey-grid";

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Thread of Life</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Pull the thread on any gene or variant. See what science actually
          knows — and what it doesn&apos;t. No hype, no false certainty. Just
          the evidence, told as a story.
        </p>
      </section>

      <Separator />

      {/* Main Tabs */}
      <Tabs defaultValue="journeys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="journeys">Journeys</TabsTrigger>
          <TabsTrigger value="explore">Explore</TabsTrigger>
          <TabsTrigger value="manifesto">Manifesto</TabsTrigger>
        </TabsList>

        <TabsContent value="journeys" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Choose a thread to pull
            </h2>
            <p className="text-sm text-muted-foreground">
              Each journey walks you through a gene, a variant, or a question —
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
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Search coming soon — use ⌘K for now
            </p>
          </div>
        </TabsContent>

        <TabsContent value="manifesto" className="space-y-4">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">
              What we believe
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Genetic information is powerful, personal, and often
                misunderstood. Thread of Life exists because we believe you
                deserve better than a raw data dump or a marketing pitch.
              </p>
              <p>
                Every piece of evidence we show you comes from a public,
                peer-reviewed, or government-funded source: ClinVar, ClinGen,
                gnomAD, GTEx. We don&apos;t editorialize the science. We do
                editorialize the presentation — because clarity is a form of
                respect.
              </p>
              <p>
                <strong>Images are mood. Evidence is evidence.</strong> When you
                see a historical photograph, it&apos;s there to evoke the human
                story behind the data. When you open the evidence drawer,
                you&apos;ll find citations, dates, and links. We never let one
                masquerade as the other.
              </p>
              <p>
                Uncertainty is not a failure. It&apos;s the honest state of most
                genetic knowledge. We show you what&apos;s known, what&apos;s
                contested, and what&apos;s still a mystery — and we label each
                clearly.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
