"use client"

import { useState } from "react"
import { ClinvarDistributionChart } from "@/components/gene/charts/clinvar-distribution-chart"
import { ClingenValidityCard } from "@/components/gene/charts/clingen-validity-card"
import { GnomadConstraintCards } from "@/components/gene/charts/gnomad-constraint-cards"
import { GtexExpressionChart } from "@/components/gene/charts/gtex-expression-chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { GeneSummary } from "@/lib/types/gene"

interface GeneStatsPanelProps {
  gene: GeneSummary
  compact?: boolean
}

type StatsPanelKey = "gtex" | "clinvar" | "gnomad" | "clingen"

export function GeneStatsPanel({ gene, compact = false }: GeneStatsPanelProps) {
  const [activePanel, setActivePanel] = useState<StatsPanelKey>("gtex")

  const panelOrder: StatsPanelKey[] = ["gtex", "clinvar", "gnomad", "clingen"]
  const secondaryPanels = panelOrder.filter((key) => key !== activePanel)

  const renderPanel = (key: StatsPanelKey, featured: boolean) => {
    switch (key) {
      case "gtex":
        return (
          <GtexExpressionChart
            topExpressions={gene.topExpressions}
            maxItems={featured ? 10 : compact ? 6 : 8}
          />
        )
      case "clinvar":
        return <ClinvarDistributionChart clinvarSummary={gene.clinvarSummary} />
      case "gnomad":
        return <GnomadConstraintCards constraint={gene.constraint} />
      case "clingen":
        return <ClingenValidityCard validity={gene.clingenValidity} />
      default:
        return null
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Data at a glance</h2>
        <p className="text-sm text-muted-foreground">
          Quantitative view across ClinVar, gnomAD, GTEx, and ClinGen.
        </p>
      </div>

      <div className="space-y-3">
        <ToggleGroup
          type="single"
          value={activePanel}
          onValueChange={(value) => {
            if (
              value === "gtex" ||
              value === "clinvar" ||
              value === "gnomad" ||
              value === "clingen"
            ) {
              setActivePanel(value)
            }
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="gtex">GTEx</ToggleGroupItem>
          <ToggleGroupItem value="clinvar">ClinVar</ToggleGroupItem>
          <ToggleGroupItem value="gnomad">gnomAD</ToggleGroupItem>
          <ToggleGroupItem value="clingen">ClinGen</ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          GTEx is featured first. Use the selector to move across data sources.
        </p>
      </div>

      <div className="grid gap-4">
        {renderPanel(activePanel, true)}
      </div>

      <div className={compact ? "grid gap-4 md:grid-cols-2" : "grid gap-4 xl:grid-cols-3"}>
        {secondaryPanels.map((panelKey) => (
          <div key={panelKey}>{renderPanel(panelKey, false)}</div>
        ))}
      </div>
    </section>
  )
}
