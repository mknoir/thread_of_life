import { NextResponse } from "next/server";
import { GENOME_INDEX_METADATA, GENOME_INDEX_SOURCE, overviewGenes } from "@/lib/genome";

export async function GET() {
  return NextResponse.json({
    genes: overviewGenes(),
    source: GENOME_INDEX_SOURCE,
    assembly: "GRCh38",
    totalGenes: GENOME_INDEX_METADATA.totalGenes,
    warnings: ["Overview samples curated RefSeq loci. Zoom in to resolve more genes; alternate contigs and predicted genes are outside this index."],
    truncated: true,
  }, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}
