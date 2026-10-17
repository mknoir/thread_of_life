import rows from "./gene-index.json";
import metadata from "./index-metadata.json";
import type { GenomeGene, GenomeRegion } from "./types";

/** Only import this module on the server: the complete locus index stays out of the browser bundle. */
export const GENOME_INDEX_SOURCE = `${metadata.source} · curated transcript-union loci · snapshot ${metadata.sourceLastModified.slice(0, 10)}`;
export const GENOME_INDEX_METADATA = metadata;
const genes: GenomeGene[] = rows.map((row) => ({
  id: String(row[0]), symbol: String(row[1]), name: String(row[2]), chromosome: String(row[3]),
  start: Number(row[4]), end: Number(row[5]), strand: Number(row[6]) === 1 ? 1 : -1, biotype: String(row[7]),
}));
const byChromosome = new Map<string, GenomeGene[]>();
for (const gene of genes) {
  const chromosome = byChromosome.get(gene.chromosome) ?? [];
  chromosome.push(gene);
  byChromosome.set(gene.chromosome, chromosome);
}

export function genesInRegion(region: GenomeRegion): GenomeGene[] {
  return (byChromosome.get(region.chromosome) ?? []).filter((gene) => gene.start <= region.end && gene.end >= region.start);
}

/** Deterministic spatial sampling avoids pretending every feature is visible at distant zoom. */
export function sampleGenes(input: GenomeGene[], maximum: number): GenomeGene[] {
  if (input.length <= maximum) return input;
  return Array.from({ length: maximum }, (_, index) => input[Math.floor((index * (input.length - 1)) / (maximum - 1))]);
}

export function overviewGenes(): GenomeGene[] {
  // Every chromosome receives representation, including the much smaller mitochondrial genome.
  return [...byChromosome.values()].flatMap((chromosome) => sampleGenes(chromosome, 24));
}

export function searchIndexedGenes(query: string, maximum = 12): GenomeGene[] {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];
  const exact: GenomeGene[] = [];
  const prefix: GenomeGene[] = [];
  const other: GenomeGene[] = [];
  for (const gene of genes) {
    const symbol = gene.symbol.toUpperCase();
    if (symbol === normalized || gene.id.toUpperCase() === normalized) exact.push(gene);
    else if (symbol.startsWith(normalized)) prefix.push(gene);
    else if (normalized.length > 2 && gene.name.toUpperCase().includes(normalized)) other.push(gene);
  }
  return [...exact, ...prefix, ...other].slice(0, maximum);
}
