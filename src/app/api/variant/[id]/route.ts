import { NextResponse } from "next/server";
import { composeVariantSummary } from "@/lib/api/compose-variant";

/**
 * GET /api/variant/[id]
 *
 * Returns a composed VariantSummary (ClinVar + gnomAD).
 * Uses cache-aside pattern when DB is connected.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || id.length < 1) {
    return NextResponse.json(
      { error: "Variant ID is required" },
      { status: 400 }
    );
  }

  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("user:password")) {
      const { getCachedVariantSummary } = await import("@/lib/cache");
      const summary = await getCachedVariantSummary(id, () =>
        composeVariantSummary(id)
      );
      return NextResponse.json(summary);
    }

    const summary = await composeVariantSummary(id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error(`Error fetching variant ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch variant data" },
      { status: 500 }
    );
  }
}
