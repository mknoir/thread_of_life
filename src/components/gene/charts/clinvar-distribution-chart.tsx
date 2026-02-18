"use client"

import { useState } from "react"
import {
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Tooltip as RechartsTooltip,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { GeneClinvarSummary } from "@/lib/types/gene"

interface ClinvarDistributionChartProps {
  clinvarSummary: GeneClinvarSummary | null
}

type PercentMode = "total" | "category"

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
  other: {
    label: "Other / unclassified",
    color: "#B0B0B0",
  },
} satisfies ChartConfig

export function ClinvarDistributionChart({
  clinvarSummary,
}: ClinvarDistributionChartProps) {
  const [percentMode, setPercentMode] = useState<PercentMode>("total")

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

  const total = clinvarSummary.totalVariants
  const pathogenic = asCount(clinvarSummary.pathogenic)
  const likelyPathogenic = asCount(clinvarSummary.likelyPathogenic)
  const vus = asCount(clinvarSummary.vus)
  const likelyBenign = asCount(clinvarSummary.likelyBenign)
  const benign = asCount(clinvarSummary.benign)
  const conflicting = asCount(clinvarSummary.conflicting)

  const explicitOther = asCount(clinvarSummary.other)
  const knownValues = [
    pathogenic,
    likelyPathogenic,
    vus,
    likelyBenign,
    benign,
    conflicting,
  ]
  const allKnownPresent = knownValues.every((v) => v !== null)
  const derivedOther = allKnownPresent
    ? Math.max(
        0,
        total -
          (pathogenic! +
            likelyPathogenic! +
            vus! +
            likelyBenign! +
            benign! +
            conflicting!)
      )
    : null
  const other = explicitOther ?? derivedOther

  const chartData = [
    {
      key: "pathogenic",
      label: "Pathogenic",
      value: pathogenic,
      color: chartConfig.pathogenic.color,
    },
    {
      key: "likelyPathogenic",
      label: "Likely pathogenic",
      value: likelyPathogenic,
      color: chartConfig.likelyPathogenic.color,
    },
    {
      key: "vus",
      label: "VUS",
      value: vus,
      color: chartConfig.vus.color,
    },
    {
      key: "likelyBenign",
      label: "Likely benign",
      value: likelyBenign,
      color: chartConfig.likelyBenign.color,
    },
    {
      key: "benign",
      label: "Benign",
      value: benign,
      color: chartConfig.benign.color,
    },
    {
      key: "conflicting",
      label: "Conflicting",
      value: conflicting,
      color: chartConfig.conflicting.color,
    },
    {
      key: "other",
      label: "Other / unclassified",
      value: other,
      color: chartConfig.other.color,
    },
  ]
  const categoryCountTotal = Math.max(
    1,
    chartData.reduce(
      (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
      0
    )
  )
  const percentageDenominator =
    percentMode === "total" ? Math.max(1, total) : categoryCountTotal
  const denominatorLabel =
    percentMode === "total"
      ? `${total.toLocaleString()} total variants`
      : `${categoryCountTotal.toLocaleString()} summed category counts`
  const modeSubtext =
    percentMode === "total"
      ? `Radial view shows each category as a percent of total submitted variants (${total.toLocaleString()}). ClinVar categories can overlap, so row percentages may sum above 100%.`
      : `Percentages are of summed category counts (${categoryCountTotal.toLocaleString()}). This normalizes overlapping categories to about 100%.`
  const activeData = chartData.filter((d) => typeof d.value === "number" && d.value > 0)
  const radialData = activeData.map((item) => ({
    ...item,
    pct: Math.round(((item.value as number) / Math.max(1, total)) * 100),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>ClinVar classification mix</CardTitle>
        <CardDescription>
          {total.toLocaleString()} submitted variants for this gene.
        </CardDescription>
        <div className="pt-1">
          <ToggleGroup
            type="single"
            value={percentMode}
            onValueChange={(value) => {
              if (value === "total" || value === "category") {
                setPercentMode(value)
              }
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="total" aria-label="Show percentages of total variants">
              % of total variants
            </ToggleGroupItem>
            <ToggleGroupItem value="category" aria-label="Show percentages of category counts">
              % of category counts
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-xs text-muted-foreground">
          {modeSubtext}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <ChartContainer config={chartConfig} className="h-56 w-full min-h-[14rem]">
            {percentMode === "category" ? (
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
                  labelFormatter={(_label, payload) => {
                    const categoryLabel = payload?.[0]?.payload?.label
                    return typeof categoryLabel === "string"
                      ? categoryLabel
                      : ""
                  }}
                  formatter={(value, name) => {
                    const numericValue =
                      typeof value === "number" ? value : Number(value ?? 0)
                    const pct = Math.round(
                      (numericValue / percentageDenominator) * 100
                    )
                    return [
                      `${numericValue.toLocaleString()} (${pct}% of ${denominatorLabel})`,
                      String(name ?? ""),
                    ]
                  }}
                />
              </PieChart>
            ) : (
              <RadialBarChart
                data={radialData}
                innerRadius="20%"
                outerRadius="95%"
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="pct" background cornerRadius={4}>
                  {radialData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </RadialBar>
                <RechartsTooltip
                  labelFormatter={(_label, payload) => {
                    const categoryLabel = payload?.[0]?.payload?.label
                    return typeof categoryLabel === "string"
                      ? categoryLabel
                      : ""
                  }}
                  formatter={(value, name, item) => {
                    const pctValue =
                      typeof value === "number" ? value : Number(value ?? 0)
                    const absolute =
                      typeof item?.payload?.value === "number"
                        ? item.payload.value
                        : null
                    return [
                      absolute === null
                        ? `${pctValue}% of ${denominatorLabel}`
                        : `${absolute.toLocaleString()} (${pctValue}% of ${denominatorLabel})`,
                      String(name ?? ""),
                    ]
                  }}
                />
              </RadialBarChart>
            )}
          </ChartContainer>
          <div className="space-y-2 text-sm">
            {chartData.map((item) => {
              const pct =
                typeof item.value === "number"
                  ? Math.round((item.value / percentageDenominator) * 100)
                  : null
              return (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCount(item.value)}
                    {pct !== null ? ` (${pct}%)` : ""}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <Stat
            label="Pathogenic + likely"
            value={
              pathogenic !== null && likelyPathogenic !== null
                ? pathogenic + likelyPathogenic
                : null
            }
          />
          <Stat label="VUS" value={vus} />
          <Stat label="Other / unclassified" value={other} />
        </div>
      </CardContent>
    </Card>
  )
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function formatCount(value: number | null) {
  return value === null ? "Unknown" : value.toLocaleString()
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="font-mono text-sm tabular-nums text-foreground">
        {formatCount(value)}
      </div>
      <div>{label}</div>
    </div>
  )
}
