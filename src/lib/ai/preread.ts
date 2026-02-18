import "server-only";

import OpenAI from "openai";

export type PreReadPageType = "gene-summary" | "gene-thread" | "variant-summary";

interface GeneratePreReadInput {
  pageType: PreReadPageType;
  title: string;
  facts: string[];
}

function buildSystemPrompt(pageType: PreReadPageType): string {
  const pageLabel =
    pageType === "gene-summary"
      ? "a gene summary page"
      : pageType === "gene-thread"
        ? "a gene storytelling thread page"
        : "a variant summary page";

  return [
    "You are a science writer for Thread of Life.",
    `Write a short pre-read for ${pageLabel}.`,
    "Tone: slightly poetic, humane, restrained.",
    "Constraint: every factual statement must come only from the provided facts.",
    "Never invent counts, genes, coordinates, variants, disease names, or confidence.",
    "If facts are limited, say uncertainty plainly.",
    "Output exactly 2 short paragraphs, total under 120 words.",
  ].join(" ");
}

function buildFallback(input: GeneratePreReadInput): string {
  const topFacts = input.facts.filter(Boolean).slice(0, 3);
  return [
    "Before we begin, anchor yourself in what is measured, not imagined.",
    topFacts.length > 0
      ? `From this page: ${topFacts.join(" ")}`
      : "Data is still loading from external sources; read this page as provisional until evidence fills in.",
  ].join(" ");
}

export async function generatePreRead(
  input: GeneratePreReadInput
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallback(input);

  const openai = new OpenAI({ apiKey });
  const facts = input.facts.filter(Boolean).map((fact) => `- ${fact}`).join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 220,
      messages: [
        { role: "system", content: buildSystemPrompt(input.pageType) },
        {
          role: "user",
          content: [
            `Title: ${input.title}`,
            "",
            "Facts:",
            facts || "- No facts available",
            "",
            "Write the pre-read now.",
          ].join("\n"),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : buildFallback(input);
  } catch (error) {
    console.error("Pre-read generation failed:", error);
    return buildFallback(input);
  }
}
