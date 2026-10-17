import type { GenomeVariantSource } from "@/lib/genome/types";

export function VariantCoverage({ sources, onRetry }: { sources: GenomeVariantSource[]; onRetry: () => void }) {
  const summary = (["dbSNP", "ClinVar"] as const).map(name => {
    const entries = sources.filter(source => source.source === name);
    if (!entries.length) return null;
    const loaded = entries.filter(source => source.status === "loaded");
    const unavailable = entries.some(source => source.status === "unavailable");
    if (!loaded.length) return `${name} · ${unavailable ? "unavailable" : "zoom to load"}`;
    const count = loaded.reduce((sum, source) => sum + source.recordCount, 0);
    return `${name} ${count.toLocaleString()}${loaded.some(source => source.truncated) ? "+ · partial" : unavailable ? " · partial" : ""}`;
  }).filter(Boolean).join(" · ");
  return <details className="genome-variant-coverage" data-variant-controls="true" onPointerDown={event => event.stopPropagation()}>
    <summary>{summary}</summary>
    <div className="genome-variant-coverage-info">
      {sources.map((source, index) => <p key={`${source.source}-${index}`}><strong>{source.source} · {source.version}</strong><br/>{source.status === "unavailable"
        ? "Request failed. Variant coverage is unknown."
        : source.status === "zoom_required"
          ? `Zoom to ${(source.windowLimit / 1000).toLocaleString()} kb or closer to load records.`
          : `${source.recordCount.toLocaleString()} source records returned${source.truncated ? ` (limit ${source.limit.toLocaleString()}). Partial coverage; zoom in for the remaining positions.` : " in this window."}`}</p>)}
      <p>Ticks mark loaded positions. Numbers group records for selection. These catalogues combine observations across people.</p>
      {sources.some(source => source.status === "unavailable") && <button type="button" onClick={onRetry}>Retry variant sources</button>}
    </div>
  </details>;
}
