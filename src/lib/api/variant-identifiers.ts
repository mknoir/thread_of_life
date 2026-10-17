import { CHROMOSOMES, normalizeChromosome } from "../genome/reference";

export function normalizeClinvarId(value: string): string | null {
  if (value.length > 32) return null;
  const normalized = value.trim().replace(/^0+(?=\d)/, "");
  return /^[1-9]\d{0,9}$/.test(normalized) ? normalized : null;
}

export function parseCoordinateVariant(value: string): {
  id: string; chromosome: string; position: number; refAllele: string; altAllele: string;
} | null {
  if (value.length > 240) return null;
  const match = value.trim().match(/^(?:chr)?(\d{1,2}|X|Y|M|MT)-(\d+)-([ACGTN]+)-([ACGTN]+)$/i);
  if (!match) return null;
  const chromosome = normalizeChromosome(match[1]);
  const reference = CHROMOSOMES.find((entry) => entry.id === chromosome);
  const position = Number(match[2]);
  const refAllele = match[3].toUpperCase();
  const altAllele = match[4].toUpperCase();
  if (!reference || !Number.isSafeInteger(position) || position < 1 || position + refAllele.length - 1 > reference.length || refAllele === altAllele) return null;
  return { id: `${chromosome}-${position}-${refAllele}-${altAllele}`, chromosome, position, refAllele, altAllele };
}

/** Remove VCF anchoring bases without guessing genomic alleles from transcript HGVS. */
export function normalizedAllele(position: number, ref: string, alt: string): { position: number; ref: string; alt: string } {
  while (ref && alt && ref[0] === alt[0]) {
    position++;
    ref = ref.slice(1);
    alt = alt.slice(1);
  }
  while (ref && alt && ref.at(-1) === alt.at(-1)) {
    ref = ref.slice(0, -1);
    alt = alt.slice(0, -1);
  }
  return { position, ref, alt };
}

export function parseVariantRequest(id: string, coordinateId?: string) {
  const clinvarId = normalizeClinvarId(id);
  const coordinate = parseCoordinateVariant(coordinateId ?? id);
  if ((!clinvarId && !coordinate) || (coordinateId !== undefined && !coordinate)) return null;
  if (!clinvarId && coordinateId !== undefined && parseCoordinateVariant(id)?.id !== coordinate?.id) return null;
  return { variantId: clinvarId ?? coordinate!.id, clinvarId, coordinate };
}
