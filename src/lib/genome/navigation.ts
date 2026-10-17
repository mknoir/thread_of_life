import { GENOME_LENGTH } from "./reference";

export interface GenomeView { center: number; span: number }

/** The viewport contains exactly `span` 1-based bases, including both endpoints. */
export function clampGenomeView(view: GenomeView): GenomeView {
  const span = Math.round(Math.max(40, Math.min(GENOME_LENGTH, Number.isFinite(view.span) ? view.span : GENOME_LENGTH)));
  const center = Number.isFinite(view.center) ? view.center : (GENOME_LENGTH + 1) / 2;
  const start = Math.max(1, Math.min(GENOME_LENGTH - span + 1, Math.round(center - (span - 1) / 2)));
  return { span, center: start + (span - 1) / 2 };
}

/**
 * Project a 1-based inclusive interval onto viewport edges, clipped to [0, 1].
 * A single base occupies 1/span of the viewport. No visual minimum is applied.
 */
export function genomeIntervalToViewport(
  startGlobal: number,
  endGlobal: number,
  view: GenomeView,
): { start: number; end: number } | null {
  if (!Number.isSafeInteger(startGlobal) || !Number.isSafeInteger(endGlobal) || startGlobal > endGlobal) return null;
  const bounded = clampGenomeView(view);
  const firstBase = bounded.center - (bounded.span - 1) / 2;
  const lastBase = firstBase + bounded.span - 1;
  const start = Math.max(firstBase, startGlobal);
  const end = Math.min(lastBase, endGlobal);
  if (start > end) return null;
  return { start: (start - firstBase) / bounded.span, end: (end - firstBase + 1) / bounded.span };
}

/** Map normalized screen x to its inclusive base; the right edge stays on the last base. */
export function genomePositionAtFraction(fraction: number, view: GenomeView): number {
  const bounded = clampGenomeView(view);
  const firstBase = bounded.center - (bounded.span - 1) / 2;
  const normalized = Number.isNaN(fraction) ? 0 : Math.max(0, Math.min(1, fraction));
  return firstBase + Math.min(bounded.span - 1, Math.floor(normalized * bounded.span));
}
