"use client"

import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import type { GeneClinvarSummary } from "@/lib/types/gene"

interface ClinvarDistributionChartProps {
  clinvarSummary: GeneClinvarSummary | null
}

const chartConfig = {
  pathogenic: {
    label: "Pathogenic",
    color: "#D4AF37",
  },
  likelyPathogenic: {
    label: "Likely pathogenic",
    color: "#A67C00",
  },
  vus: {
    label: "VUS",
    color: "#6E6E6E",
  },
  likelyBenign: {
    label: "Likely benign",
    color: "#4B4B4B",
  },
  benign: {
    label: "Benign",
    color: "#1F1F1F",
  },
  conflicting: {
    label: "Conflicting",
    color: "#8A8A8A",
  },
} satisfies ChartConfig

export function ClinvarDistributionChart({
  clinvarSummary,
}: ClinvarDistributionChartProps) {
  if (!clinvarSummary || clinvarSummary.totalVariants === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ClinVar</CardTitle>
          <CardDescription>No ClinVar variant data available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const chartData = [
    {
      key: "pathogenic",
      label: "Pathogenic",
      value: clinvarSummary.pathogenic,
      color: chartConfig.pathogenic.color,
    },
    {
      key: "likelyPathogenic",
      label: "Likely pathogenic",
      value: clinvarSummary.likelyPathogenic,
      color: chartConfig.likelyPathogenic.color,
    },
    {
      key: "vus",
      label: "VUS",
      value: clinvarSummary.vus,
      color: chartConfig.vus.color,
    },
    {
      key: "likelyBenign",
      label: "Likely benign",
      value: clinvarSummary.likelyBenign,
      color: chartConfig.likelyBenign.color,
    },
    {
      key: "benign",
      label: "Benign",
      value: clinvarSummary.benign,
      color: chartConfig.benign.color,
    },
    {
      key: "conflicting",
      label: "Conflicting",
      value: clinvarSummary.conflicting,
      color: chartConfig.conflicting.color,
    },
  ]
  const activeData = chartData.filter((d) => d.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>ClinVar classification mix</CardTitle>
        <CardDescription>
          {clinvarSummary.totalVariants.toLocaleString()} submitted variants for this gene.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <ChartContainer config={chartConfig} className="h-56 w-full min-h-[14rem]">
            <PieChart>
              <Pie
                data={activeData}
                dataKey="value"
                nameKey="label"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              >
                {activeData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => {
                  const pct = Math.round((Number(value) / clinvarSummary.totalVariants) * 100)
                  return [`${Number(value).toLocaleString()} (${pct}%)`, name]
                }}
              />
            </PieChart>
          </ChartContainer>
          <div className="space-y-2 text-sm">
            {chartData.map((item) => {
              const pct = Math.round((item.value / clinvarSummary.totalVariants) * 100)
              return (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono tabular-nums text-foreground">
                    {item.value.toLocaleString()} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <Stat label="Pathogenic + likely" value={clinvarSummary.pathogenic + clinvarSummary.likelyPathogenic} />
          <Stat label="VUS" value={clinvarSummary.vus} />
          <Stat label="Conflicting" value={clinvarSummary.conflicting} />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="font-mono text-sm tabular-nums text-foreground">{value.toLocaleString()}</div>
      <div>{label}</div>
    </div>
  )
}
