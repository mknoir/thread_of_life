"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { GeneExpression } from "@/lib/types/gene"

interface GtexExpressionChartProps {
  topExpressions: GeneExpression[]
  maxItems?: number
}

const chartConfig = {
  tpm: {
    label: "TPM",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function GtexExpressionChart({
  topExpressions,
  maxItems = 8,
}: GtexExpressionChartProps) {
  if (topExpressions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GTEx expression</CardTitle>
          <CardDescription>No GTEx tissue expression data available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const chartData = topExpressions.slice(0, maxItems).map((item) => ({
    tissue: compactTissue(item.tissue),
    fullTissue: item.tissue,
    tpm: Number(item.tpm.toFixed(2)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>GTEx top tissue expression</CardTitle>
        <CardDescription>Median TPM across top tissues.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <AreaChart data={chartData} margin={{ left: -12, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="tissue" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const first = payload?.[0]?.payload as
                      | { fullTissue?: string }
                      | undefined
                    return first?.fullTissue ?? ""
                  }}
                  formatter={(value) => `${Number(value).toFixed(1)} TPM`}
                />
              }
            />
            <Area
              dataKey="tpm"
              type="natural"
              fill="var(--color-tpm)"
              fillOpacity={0.2}
              stroke="var(--color-tpm)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function compactTissue(tissue: string) {
  if (tissue.length <= 16) return tissue
  const words = tissue.split(" ")
  if (words.length <= 2) return `${tissue.slice(0, 16)}...`
  return words
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
