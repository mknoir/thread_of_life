import { NextResponse } from "next/server";
import { composeGeneSummary } from "@/lib/api/compose-gene";

/**
 * GET /api/gene/[symbol]
 *
 * Returns a composed GeneSummary (ClinVar + gnomAD + ClinGen + GTEx).
 * Uses cache-aside pattern when DB is connected.
 * Falls back to direct composition when DB is unavailable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  if (!symbol || symbol.length < 1) {
    return NextResponse.json(
      { error: "Gene symbol is required" },
      { status: 400 }
    );
  }

  try {
    // Try cache-aside if DB is configured
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("user:password")) {
      const { getCachedGeneSummary } = await import("@/lib/cache");
      const summary = await getCachedGeneSummary(symbol, () =>
        composeGeneSummary(symbol)
      );
      return NextResponse.json(summary);
    }

    // No DB — compose directly
    const summary = await composeGeneSummary(symbol);
    return NextResponse.json(summary);
  } catch (error) {
    console.error(`Error fetching gene ${symbol}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch gene data" },
      { status: 500 }
    );
  }
}
