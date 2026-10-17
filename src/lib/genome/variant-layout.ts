import { toGlobalPosition } from "./reference";
import type { GenomeVariant } from "./types";

export function variantKey(variant: GenomeVariant): string {
  return `${variant.clinvarId || variant.id}:${variant.coordinateId || `${variant.chromosome}:${variant.position}:${variant.ref || ""}:${variant.alt || ""}`}`;
}

/** Group hit targets, never genomic positions. Every visible record stays in a group. */
export function layoutVariants(variants: GenomeVariant[], view: { center: number; span: number }, width: number) {
  const left = view.center - (view.span - 1) / 2;
  const right = left + view.span - 1;
  const columns = Math.max(1, Math.floor(width / 40));
  const unique = new Map<string, GenomeVariant>();
  for (const variant of variants) {
    const position = toGlobalPosition(variant.chromosome, variant.position);
    if (position >= left && position <= right) unique.set(variantKey(variant), variant);
  }
  const points = [...unique.values()].map(variant => ({
    variant,
    fraction: (toGlobalPosition(variant.chromosome, variant.position) - left + .5) / view.span,
  })).sort((a, b) => a.fraction - b.fraction);
  const groups = new Map<string, { key: string; column: number; points: typeof points }>();
  for (const point of points) {
    const column = Math.min(columns - 1, Math.floor(point.fraction * columns));
    const key = `${point.variant.chromosome}:${column}`;
    const group = groups.get(key) ?? { key, column, points: [] };
    group.points.push(point);
    groups.set(key, group);
  }
  return { points, groups: [...groups.values()], columns };
}
