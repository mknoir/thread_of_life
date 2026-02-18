"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ClinicalSignificance, GeneRegionVariant } from "@/lib/types/variant";

interface GeneVariantTrackProps {
  gene: string;
  chromosome: string;
  regionStart: number;
  regionEnd: number;
  variants: GeneRegionVariant[];
  focusVariantId?: string;
}

type DensityMode = "auto" | "points" | "bins";

const SIGNIFICANCE_ORDER: ClinicalSignificance[] = [
  "Pathogenic",
  "Likely pathogenic",
  "Uncertain significance",
  "Likely benign",
  "Benign",
  "Conflicting classifications",
  "Other",
];

const SIGNIFICANCE_COLORS: Record<ClinicalSignificance, string> = {
  Pathogenic: "#D43D2E",
  "Likely pathogenic": "#B66A00",
  "Uncertain significance": "#737373",
  "Likely benign": "#4A4A4A",
  Benign: "#1F1F1F",
  "Conflicting classifications": "#9A9A9A",
  Other: "#B8B8B8",
};

const DENSITY_THRESHOLD = 220;

export function GeneVariantTrack({
  gene,
  chromosome,
  regionStart,
  regionEnd,
  variants,
  focusVariantId,
}: GeneVariantTrackProps) {
  const [activeFilters, setActiveFilters] = useState<Set<ClinicalSignificance>>(
    () => new Set(SIGNIFICANCE_ORDER)
  );
  const [densityMode, setDensityMode] = useState<DensityMode>("auto");

  const filtered = useMemo(
    () =>
      variants.filter((variant) => activeFilters.has(variant.clinicalSignificance)),
    [variants, activeFilters]
  );

  const range = Math.max(1, regionEnd - regionStart);
  const shouldAggregate =
    densityMode === "bins" ||
    (densityMode === "auto" && filtered.length > DENSITY_THRESHOLD);
  const binCount = 72;

  const bins = useMemo(() => {
    if (!shouldAggregate) return [];
    const out = Array.from({ length: binCount }, (_, idx) => ({
      idx,
      start: regionStart + (idx / binCount) * range,
      end: regionStart + ((idx + 1) / binCount) * range,
      count: 0,
      pathogenicish: 0,
    }));
    for (const variant of filtered) {
      const relative = (variant.position - regionStart) / range;
      const idx = Math.max(0, Math.min(binCount - 1, Math.floor(relative * binCount)));
      const bin = out[idx]!;
      bin.count += 1;
      if (
        variant.clinicalSignificance === "Pathogenic" ||
        variant.clinicalSignificance === "Likely pathogenic"
      ) {
        bin.pathogenicish += 1;
      }
    }
    return out;
  }, [shouldAggregate, filtered, regionStart, range]);

  const maxBinCount = Math.max(1, ...bins.map((b) => b.count));
  const countsBySignificance = useMemo(() => {
    const map = new Map<ClinicalSignificance, number>();
    for (const key of SIGNIFICANCE_ORDER) map.set(key, 0);
    for (const variant of filtered) {
      map.set(
        variant.clinicalSignificance,
        (map.get(variant.clinicalSignificance) ?? 0) + 1
      );
    }
    return map;
  }, [filtered]);

  const toggleFilter = (value: ClinicalSignificance) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next.size > 0 ? next : prev;
    });
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle>Gene variant landscape</CardTitle>
          <CardDescription>
            {gene} on chr{chromosome}:{regionStart.toLocaleString()}-
            {regionEnd.toLocaleString()}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SIGNIFICANCE_ORDER.map((sig) => (
            <button
              key={sig}
              type="button"
              onClick={() => toggleFilter(sig)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                activeFilters.has(sig)
                  ? "bg-muted text-foreground"
                  : "bg-background text-muted-foreground opacity-70"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SIGNIFICANCE_COLORS[sig] }}
              />
              {sig}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            value={densityMode}
            onValueChange={(value) => {
              if (value === "auto" || value === "points" || value === "bins") {
                setDensityMode(value);
              }
            }}
            size="sm"
            variant="outline"
          >
            <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
            <ToggleGroupItem value="points">Points</ToggleGroupItem>
            <ToggleGroupItem value="bins">Bins</ToggleGroupItem>
          </ToggleGroup>
          <Badge variant={shouldAggregate ? "secondary" : "outline"}>
            {shouldAggregate
              ? `Aggregation active: ${filtered.length.toLocaleString()} variants in ${binCount} bins`
              : `Point mode: ${filtered.length.toLocaleString()} variants`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative rounded-lg border bg-muted/20 p-3">
          <div className="relative h-44">
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-border" />
            {shouldAggregate
              ? bins.map((bin) => {
                  if (bin.count === 0) return null;
                  const left = (bin.idx / binCount) * 100;
                  const width = 100 / binCount;
                  const height = Math.max(6, (bin.count / maxBinCount) * 92);
                  const hotness = bin.pathogenicish / Math.max(1, bin.count);
                  const color =
                    hotness > 0.5
                      ? SIGNIFICANCE_COLORS.Pathogenic
                      : hotness > 0.2
                        ? SIGNIFICANCE_COLORS["Likely pathogenic"]
                        : "#5A5A5A";
                  return (
                    <div
                      key={`bin-${bin.idx}`}
                      title={`${Math.round(bin.start).toLocaleString()}-${Math.round(bin.end).toLocaleString()}: ${bin.count} variants`}
                      className="absolute bottom-[50%] translate-y-1/2 rounded-sm opacity-90"
                      style={{
                        left: `${left}%`,
                        width: `calc(${width}% - 1px)`,
                        height: `${height}px`,
                        backgroundColor: color,
                      }}
                    />
                  );
                })
              : filtered.map((variant, idx) => {
                  const left = ((variant.position - regionStart) / range) * 100;
                  const isFocus = focusVariantId && variant.id === focusVariantId;
                  return (
                    <div
                      key={`${variant.id}-${idx}`}
                      title={`${variant.id} · ${variant.clinicalSignificance} · pos ${variant.position.toLocaleString()}`}
                      className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background ${
                        isFocus ? "ring-2 ring-foreground" : ""
                      }`}
                      style={{
                        left: `${Math.max(0, Math.min(100, left))}%`,
                        backgroundColor: SIGNIFICANCE_COLORS[variant.clinicalSignificance],
                      }}
                    />
                  );
                })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{regionStart.toLocaleString()}</span>
            <span>Gene span</span>
            <span>{regionEnd.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
          {SIGNIFICANCE_ORDER.map((sig) => (
            <div key={`count-${sig}`} className="rounded-md border px-2 py-1.5">
              <div className="font-mono text-sm text-foreground">
                {(countsBySignificance.get(sig) ?? 0).toLocaleString()}
              </div>
              <div className="truncate">{sig}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Analysis always uses the full filtered set. Rendering may switch to bins
          for readability, but counts and summaries are never computed from a trimmed subset.
        </p>
      </CardContent>
    </Card>
  );
}
