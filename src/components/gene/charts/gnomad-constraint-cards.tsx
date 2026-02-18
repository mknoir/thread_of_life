 "use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { GeneConstraint, GnomadGeneLandscape } from "@/lib/types/gene"

interface GnomadConstraintCardsProps {
  constraint: GeneConstraint | null
  landscape: GnomadGeneLandscape | null
}

export function GnomadConstraintCards({ constraint, landscape }: GnomadConstraintCardsProps) {
  if (!constraint && !landscape) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>gnomAD constraint</CardTitle>
          <CardDescription>No gnomAD data available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const pLI = constraint?.pLI ?? null
  const loeuf = constraint?.loeufScore ?? null
  const misZ = constraint?.misZScore ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>gnomAD profile</CardTitle>
        <CardDescription>
          Constraint metrics plus full-gene variant distribution across GRCh38 coordinates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {constraint ? (
          <div className="space-y-4">
            <MetricRow
              label="pLI"
              value={pLI}
              normalized={pLI == null ? null : Math.max(0, Math.min(100, pLI * 100))}
              note="Higher suggests stronger LoF intolerance"
            />
            <MetricRow
              label="LOEUF"
              value={loeuf}
              normalized={
                loeuf == null ? null : Math.max(0, Math.min(100, (1 - Math.min(loeuf, 1.5) / 1.5) * 100))
              }
              note="Lower indicates stronger LoF constraint"
              precision={3}
            />
            <MetricRow
              label="Mis-Z"
              value={misZ}
              normalized={misZ == null ? null : Math.max(0, Math.min(100, ((misZ + 2) / 7) * 100))}
              note="Higher can suggest missense depletion"
              precision={2}
            />
          </div>
        ) : null}
        <GeneLandscapeTrack landscape={landscape} />
      </CardContent>
    </Card>
  )
}

function MetricRow({
  label,
  value,
  normalized,
  note,
  precision = 2,
}: {
  label: string
  value: number | null
  normalized: number | null
  note: string
  precision?: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          {value == null ? "N/A" : value.toFixed(precision)}
        </span>
      </div>
      <Progress value={normalized ?? 0} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  )
}

function GeneLandscapeTrack({ landscape }: { landscape: GnomadGeneLandscape | null }) {
  type FilterMode = "total" | "lof" | "missense" | "synonymous" | "other"
  const [mode, setMode] = useState<FilterMode>("total")
  const [selectedBinIndex, setSelectedBinIndex] = useState<number | null>(null)

  const countsByMode = useMemo(() => {
    const bins = landscape?.bins ?? []
    return bins.reduce(
      (acc, bin) => {
        acc.total += bin.total
        acc.lof += bin.lof
        acc.missense += bin.missense
        acc.synonymous += bin.synonymous
        acc.other += bin.other
        return acc
      },
      { total: 0, lof: 0, missense: 0, synonymous: 0, other: 0 }
    )
  }, [landscape?.bins])

  if (!landscape || landscape.bins.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        gnomAD variant map unavailable for this gene.
      </div>
    )
  }

  const modeLabel =
    mode === "total"
      ? "All gnomAD variants"
      : mode === "lof"
        ? "Loss-of-function variants"
        : mode === "missense"
          ? "Missense variants"
          : mode === "synonymous"
            ? "Synonymous variants"
            : "Other consequences"

  const valueForBin = (bin: GnomadGeneLandscape["bins"][number]): number => {
    if (mode === "total") return bin.total
    if (mode === "lof") return bin.lof
    if (mode === "missense") return bin.missense
    if (mode === "synonymous") return bin.synonymous
    return bin.other
  }

  const maxCount = Math.max(1, ...landscape.bins.map((bin) => valueForBin(bin)))
  const variantLabel = `${countsByMode[mode].toLocaleString()} shown`
  const selectedBin =
    selectedBinIndex == null
      ? null
      : landscape.bins.find((bin) => bin.index === selectedBinIndex) ?? null

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium">Genome-mapped variant landscape</p>
        <p className="text-xs text-muted-foreground">{variantLabel}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        This is a positional map of gnomAD population variation, not a pathogenicity map.
        For pathogenic vs VUS, use the ClinVar panel.
      </p>
      <p className="text-[11px] text-muted-foreground">
        chr{landscape.chromosome}:{landscape.regionStart.toLocaleString()}-
        {landscape.regionEnd.toLocaleString()} on GRCh38
      </p>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={mode}
        onValueChange={(value) => {
          if (
            value === "total" ||
            value === "lof" ||
            value === "missense" ||
            value === "synonymous" ||
            value === "other"
          ) {
            setMode(value)
          }
        }}
      >
        <ToggleGroupItem value="total">All</ToggleGroupItem>
        <ToggleGroupItem value="lof">LoF</ToggleGroupItem>
        <ToggleGroupItem value="missense">Missense</ToggleGroupItem>
        <ToggleGroupItem value="synonymous">Synonymous</ToggleGroupItem>
        <ToggleGroupItem value="other">Other</ToggleGroupItem>
      </ToggleGroup>
      <p className="text-[11px] text-muted-foreground">
        Display: {modeLabel}. Click a bar to inspect that genomic interval.
      </p>
      <div className="flex h-16 items-end gap-[2px]">
        {landscape.bins.map((bin) => {
          const modeValue = valueForBin(bin)
          const heightPercent = Math.max(4, Math.round((modeValue / maxCount) * 100))
          const title = [
            `${bin.start.toLocaleString()}-${bin.end.toLocaleString()}`,
            `Total: ${bin.total.toLocaleString()}`,
            `LoF: ${bin.lof.toLocaleString()}`,
            `Missense: ${bin.missense.toLocaleString()}`,
            `Synonymous: ${bin.synonymous.toLocaleString()}`,
            `Other: ${bin.other.toLocaleString()}`,
          ].join(" | ")
          return (
            <button
              key={bin.index}
              type="button"
              className={
                "min-w-0 flex-1 rounded-sm bg-zinc-700/70 hover:bg-zinc-500 " +
                (selectedBinIndex === bin.index ? "ring-1 ring-primary" : "")
              }
              style={{ height: `${heightPercent}%` }}
              title={title}
              onClick={() => setSelectedBinIndex(bin.index)}
              aria-label={`Bin ${bin.start.toLocaleString()} to ${bin.end.toLocaleString()}`}
            />
          )
        })}
      </div>
      {selectedBin ? (
        <div className="rounded-md bg-muted/60 p-2 text-[11px]">
          <p className="font-medium">
            Selected interval: {selectedBin.start.toLocaleString()}-
            {selectedBin.end.toLocaleString()}
          </p>
          <p className="text-muted-foreground">
            Total {selectedBin.total.toLocaleString()} | LoF {selectedBin.lof.toLocaleString()} | Missense{" "}
            {selectedBin.missense.toLocaleString()} | Synonymous{" "}
            {selectedBin.synonymous.toLocaleString()} | Other {selectedBin.other.toLocaleString()}
          </p>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Binned from the full gene variant set to preserve complete counts while keeping UI readable.
      </p>
    </div>
  )
}
