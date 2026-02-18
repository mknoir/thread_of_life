import { Separator } from "@/components/ui/separator";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";

export default function ManifestoPage() {
  return (
    <div className="space-y-8">
      <BreadcrumbNav />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <p className="text-lg text-muted-foreground">
          What we believe about genetic information.
        </p>
      </header>

      <Separator />

      <article className="prose prose-stone max-w-2xl dark:prose-invert">
        <p>
          Genetic information is powerful, personal, and often misunderstood.
          Thread of Life exists because we believe you deserve better than a raw
          data dump or a marketing pitch.
        </p>

        <h2>Where the evidence comes from</h2>
        <p>
          Every piece of evidence we show you comes from a public, peer-reviewed,
          or government-funded source: ClinVar, ClinGen, gnomAD, GTEx. We
          don&apos;t editorialize the science. We do editorialize the
          presentation — because clarity is a form of respect.
        </p>

        <h2>Images are mood. Evidence is evidence.</h2>
        <p>
          When you see a historical photograph, it&apos;s there to evoke the
          human story behind the data. When you open the evidence drawer,
          you&apos;ll find citations, dates, and links. We never let one
          masquerade as the other.
        </p>

        <h2>Uncertainty is not failure</h2>
        <p>
          Uncertainty is the honest state of most genetic knowledge. More than
          half of all variants submitted to ClinVar are classified as
          &ldquo;Uncertain Significance.&rdquo; We show you what&apos;s known,
          what&apos;s contested, and what&apos;s still a mystery — and we label
          each clearly.
        </p>

        <h2>No false certainty</h2>
        <p>
          We will never imply that a genetic variant determines your destiny. We
          will never use historical imagery to suggest certainty about the past.
          We will always distinguish between what&apos;s backed by published
          evidence and what&apos;s inferred from patterns.
        </p>

        <h2>Open data, open interpretation</h2>
        <p>
          The data sources we use are publicly available. Our interpretive layer
          — the narrative, the journeys, the threads — is our contribution. We
          believe that making science accessible is itself a form of scientific
          work.
        </p>

        <h2>Reference builds: GRCh37 (hg19) vs GRCh38 (hg38)</h2>
        <p>
          Not all coordinates are the same map. A variant location in GRCh37
          (also called hg19) does not always match the same numeric position in
          GRCh38 (hg38). The human reference genome has been revised over time:
          patches, corrected regions, and improved representations of difficult
          loci. GRCh37 became the dominant clinical coordinate system for years;
          GRCh38 improved many regions and is now standard in newer resources.
        </p>
        <p>
          When you compare results across tools, this matters. Two reports can
          disagree on position but still describe the same biological variant,
          because they are using different references. We try to make build
          context explicit whenever possible, and we encourage checking whether a
          source is reporting in hg19 or hg38 before drawing conclusions.
        </p>
        <p>
          The short version: if the map changes, the street number can change.
          The science doesn&apos;t become less true — but interpretation requires
          knowing which map you&apos;re on.
        </p>
      </article>
    </div>
  );
}
