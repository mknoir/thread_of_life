import { NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a science writer for Thread of Life, a genomics narrative app. Your job is to continue a narrative thread about a gene or genetic concept. The tone is emotional yet scientifically accurate — human, honest, and grounded in evidence. No hype, no false certainty. Write 2–4 paragraphs that flow naturally from the context provided.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: {
    threadTitle: string;
    geneSymbol?: string;
    sectionTitle: string;
    prose: string;
    claimsSummary?: string;
    nextSectionHint?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { threadTitle, geneSymbol, sectionTitle, prose, claimsSummary, nextSectionHint } =
    body;

  if (!prose || typeof prose !== "string") {
    return NextResponse.json(
      { error: "prose is required" },
      { status: 400 }
    );
  }

  const userPrompt = [
    `Thread: ${threadTitle}`,
    geneSymbol ? `Gene: ${geneSymbol}` : null,
    `Current section: ${sectionTitle}`,
    "",
    "Content so far:",
    prose,
    claimsSummary ? `\nKey evidence: ${claimsSummary}` : null,
    nextSectionHint ? `\nNext we'll explore: ${nextSectionHint}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Continue this narrative. Maintain the voice and accuracy.\n\n${userPrompt}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const continuation =
      completion.choices[0]?.message?.content?.trim() ?? "";

    if (!continuation) {
      return NextResponse.json(
        { error: "No continuation generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({ continuation });
  } catch (err) {
    console.error("OpenAI continue error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate continuation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
