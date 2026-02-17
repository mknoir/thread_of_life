import { NextResponse } from "next/server";

/**
 * POST /api/admin/refresh
 *
 * Manual cache refresh trigger (protected).
 * In production, protect with an API key or admin auth.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.ADMIN_API_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Placeholder: in production, this triggers a refresh of cached summaries
  return NextResponse.json({
    message: "Cache refresh triggered",
    timestamp: new Date().toISOString(),
  });
}
