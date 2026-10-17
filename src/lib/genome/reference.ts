import landmarkRows from "./landmark-genes.json";
import type { GenomeGene } from "./types";

/** GRCh38.p14 primary chromosomes, verified with Ensembl /info/assembly/homo_sapiens. */
const LENGTHS: Array<[string, number]> = [
  ["1", 248956422], ["2", 242193529], ["3", 198295559], ["4", 190214555],
  ["5", 181538259], ["6", 170805979], ["7", 159345973], ["8", 145138636],
  ["9", 138394717], ["10", 133797422], ["11", 135086622], ["12", 133275309],
  ["13", 114364328], ["14", 107043718], ["15", 101991189], ["16", 90338345],
  ["17", 83257441], ["18", 80373285], ["19", 58617616], ["20", 64444167],
  ["21", 46709983], ["22", 50818468], ["X", 156040895], ["Y", 57227415], ["MT", 16569],
];

let offset = 0;
export const CHROMOSOMES = LENGTHS.map(([id, length]) => {
  const chromosome = { id, name: id === "MT" ? "Mitochondrial" : `Chromosome ${id}`, length, offset };
  offset += length;
  return chromosome;
});
export const GENOME_LENGTH = offset;

export function normalizeChromosome(chromosome: string): string {
  const value = chromosome.trim().replace(/^chr/i, "").toUpperCase();
  return value === "M" ? "MT" : value;
}

/** Convert 1-based inclusive chromosome coordinates to the concatenated 1-based axis. */
export function toGlobalPosition(chromosome: string, position: number): number {
  const record = CHROMOSOMES.find((entry) => entry.id === normalizeChromosome(chromosome));
  if (!record) throw new RangeError(`Unknown primary chromosome: ${chromosome}`);
  if (!Number.isSafeInteger(position) || position < 1 || position > record.length) {
    throw new RangeError(`Position outside chromosome ${record.id}`);
  }
  return record.offset + position;
}

/** Fractional display positions are rounded to bases and clamped to the primary reference. */
export function fromGlobalPosition(globalPosition: number): { chromosome: string; position: number } {
  if (!Number.isFinite(globalPosition)) throw new RangeError("Global position must be finite");
  const position = Math.max(1, Math.min(GENOME_LENGTH, Math.round(globalPosition)));
  const chromosome = CHROMOSOMES.find((entry) => position <= entry.offset + entry.length)!;
  return { chromosome: chromosome.id, position: position - chromosome.offset };
}

export function formatPosition(position: number): string {
  const magnitude = Math.abs(position);
  if (magnitude >= 1e9) return `${(position / 1e9).toFixed(2)} Gb`;
  if (magnitude >= 1e6) return `${(position / 1e6).toFixed(2)} Mb`;
  if (magnitude >= 1e3) return `${(position / 1e3).toFixed(1)} kb`;
  return `${Math.round(position).toLocaleString("en-US")} bp`;
}

/** Small initial visual landmarks. The full server index is loaded progressively by region. */
export const LANDMARK_GENES: GenomeGene[] = landmarkRows.map((row) => ({
  id: String(row[0]), symbol: String(row[1]), name: String(row[2]), chromosome: String(row[3]),
  start: Number(row[4]), end: Number(row[5]), strand: Number(row[6]) === 1 ? 1 : -1, biotype: String(row[7]),
}));
