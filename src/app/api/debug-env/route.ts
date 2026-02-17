import { NextResponse } from "next/server";

/**
 * Debug endpoint: check if OPENAI_API_KEY is visible to the server.
 * Hit GET /api/debug-env — if hasOpenAIKey is false, env isn't loading.
 */
export async function GET() {
  return NextResponse.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    keyLength: process.env.OPENAI_API_KEY?.length ?? 0,
  });
}
