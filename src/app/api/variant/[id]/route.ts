import { NextResponse } from "next/server";
import { fetchVariantData } from "@/lib/api/fetch-variant";
import { parseVariantRequest } from "@/lib/api/variant-identifiers";

/**
 * GET /api/variant/[id]?coordinateId=9-94955251-A-G&refresh=1
 *
 * Returns a composed VariantSummary (ClinVar + gnomAD).
 * Numeric IDs address ClinVar; GRCh38 allele IDs address gnomAD. An optional
 * coordinateId supplies a verified VCF representation for the ClinVar record.
 * Source statuses distinguish absent records, source failures and usable data.
 * Explicit refresh bypasses the composed-data cache; DB failure falls back live.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const coordinateId = query.get("coordinateId") ?? undefined;

  if (!id || !parseVariantRequest(id, coordinateId)) {
    return NextResponse.json(
      { error: /^rs\d+$/i.test(id ?? "") ? "An rsID can describe several alleles. Select a specific genomic allele for variant evidence." : "Provide a numeric ClinVar variation ID or a GRCh38 chromosome-position-reference-alternate allele ID." },
      { status: 400 }
    );
  }

  try {
    const summary = await fetchVariantData(id, { coordinateId, refresh: query.get("refresh") === "1" });
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`Error fetching variant ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch variant data" },
      { status: 500 }
    );
  }
}
