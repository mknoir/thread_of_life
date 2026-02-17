import { ClinvarDistributionChart } from "@/components/gene/charts/clinvar-distribution-chart"
import { ClingenValidityCard } from "@/components/gene/charts/clingen-validity-card"
import { GnomadConstraintCards } from "@/components/gene/charts/gnomad-constraint-cards"
import { GtexExpressionChart } from "@/components/gene/charts/gtex-expression-chart"
import type { GeneSummary } from "@/lib/types/gene"

interface GeneStatsPanelProps {
  gene: GeneSummary
  compact?: boolean
}

export function GeneStatsPanel({ gene, compact = false }: GeneStatsPanelProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Data at a glance</h2>
        <p className="text-sm text-muted-foreground">
          Quantitative view across ClinVar, gnomAD, GTEx, and ClinGen.
        </p>
      </div>

      <div className={compact ? "grid gap-4 lg:grid-cols-2" : "grid gap-4 xl:grid-cols-2"}>
        <ClinvarDistributionChart clinvarSummary={gene.clinvarSummary} />
        <GtexExpressionChart topExpressions={gene.topExpressions} maxItems={compact ? 6 : 8} />
        <GnomadConstraintCards constraint={gene.constraint} />
        <ClingenValidityCard validity={gene.clingenValidity} />
      </div>
    </section>
  )
}
