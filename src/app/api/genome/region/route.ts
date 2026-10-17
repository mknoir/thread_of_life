import { NextResponse } from "next/server";
import { genesInRegion, GENOME_INDEX_SOURCE, sampleGenes } from "@/lib/genome";
import { CHROMOSOMES, normalizeChromosome } from "@/lib/genome/reference";
import { fetchReferenceSequence, fetchRegionalVariantSources, SEQUENCE_WINDOW_LIMIT } from "@/lib/genome/upstream";
import type { GenomeRegionResponse } from "@/lib/genome/types";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const chromosome = normalizeChromosome(params.get("chromosome") ?? "");
  const reference = CHROMOSOMES.find((entry) => entry.id === chromosome);
  const start = Number(params.get("start"));
  const end = Number(params.get("end"));
  if (!reference || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > reference.length) {
    return NextResponse.json({ genes: [], variants: [], variantSources: [], source: GENOME_INDEX_SOURCE, warnings: ["Use a primary GRCh38 chromosome and valid 1-based inclusive start/end coordinates."], error: "Invalid reference region" }, { status: 400 });
  }
  const region = { chromosome, start, end };
  const span = end - start + 1;
  const matchingGenes = genesInRegion(region);
  const result: GenomeRegionResponse = {
    genes: sampleGenes(matchingGenes, 180), variants: [], variantSources: [], source: GENOME_INDEX_SOURCE,
    warnings: [], truncated: matchingGenes.length > 180, totalGenes: matchingGenes.length, assembly: "GRCh38",
  };
  if (matchingGenes.length > 180) result.warnings.push(`Showing 180 of ${matchingGenes.length.toLocaleString("en-US")} curated loci. Zoom in for more genes.`);
  const requests: Promise<void>[] = [];
  requests.push(fetchRegionalVariantSources(region).then((payload) => {
      result.variants = payload.variants;
      result.variantSources = payload.variantSources;
      for (const source of payload.variantSources) {
        if (source.status === "loaded") {
          result.source += ` · ${source.source} ${source.version} via UCSC`;
          if (source.truncated) {
            result.truncated = true;
            result.warnings.push(`${source.source} is capped at ${source.limit.toLocaleString("en-US")} source records; this is not the full regional count. Zoom in to load the rest.`);
          }
        } else if (source.status === "unavailable") {
          result.warnings.push(source.error ?? `${source.source} is temporarily unavailable.`);
        } else {
          result.warnings.push(`Zoom to ${source.windowLimit / 1000} kb or less to load regional ${source.source} records.`);
        }
      }
    }));
  if (span <= SEQUENCE_WINDOW_LIMIT) {
    requests.push(fetchReferenceSequence(region).then((sequence) => {
      result.sequence = sequence;
      result.sequenceStart = start;
      result.source += " · UCSC hg38 reference sequence";
    }).catch(() => { result.warnings.push("Reference bases are temporarily unavailable. The helix remains a schematic."); }));
  }
  await Promise.all(requests);
  // Incomplete upstream responses must not be cached as complete data.
  const unavailable = result.warnings.some((warning) => warning.includes("unavailable"));
  return NextResponse.json(result, { headers: { "Cache-Control": unavailable ? "no-store" : "public, max-age=3600, stale-while-revalidate=86400" } });
}
