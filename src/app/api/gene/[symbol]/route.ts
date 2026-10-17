import { NextResponse } from "next/server";
import { fetchGeneData } from "@/lib/api/fetch-gene";

/**
 * GET /api/gene/[symbol]
 *
 * Returns a composed GeneSummary (ClinVar + gnomAD + ClinGen + GTEx).
 * Uses cache-aside pattern when DB is connected.
 * Falls back to direct composition when DB is unavailable.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  if (!symbol || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(symbol.trim())) {
    return NextResponse.json(
      { error: "Provide a valid gene symbol." },
      { status: 400 }
    );
  }

  try {
    const summary = await fetchGeneData(symbol, { refresh: new URL(request.url).searchParams.get("refresh") === "1" });
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`Error fetching gene ${symbol}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch gene data" },
      { status: 500 }
    );
  }
}
