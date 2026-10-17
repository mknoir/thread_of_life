import { NextResponse } from "next/server";
import { generateGenomeStory, parseGenomeStoryInput } from "@/lib/ai/genome-story";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 1024) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }
  // This route can trigger a paid model call. Reject cross-origin browser requests.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Provide a valid JSON request." }, { status: 400 });
  }
  const input = parseGenomeStoryInput(body);
  if (!input) {
    return NextResponse.json({ error: "Provide a gene symbol and, optionally, a ClinVar ID or GRCh38 chromosome-position-reference-alternate variant ID." }, { status: 400 });
  }
  const result = await generateGenomeStory(input);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
