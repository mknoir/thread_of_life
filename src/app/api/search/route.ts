import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { searchClinvar } from "@/lib/api/clinvar";
import { searchCache } from "@/lib/db/schema";

interface SearchResult {
  type: "gene" | "variant" | "journey";
  id: string;
  title: string;
  description: string;
}

const JOURNEY_INDEX: SearchResult[] = [
  {
    type: "journey",
    id: "what-is-brca",
    title: "What does BRCA1 actually mean for you?",
    description: "Walk through BRCA1 from biology to interpretation.",
  },
  {
    type: "journey",
    id: "vus-explained",
    title: "The mystery of Variants of Uncertain Significance",
    description: "Why uncertainty is the most common test result.",
  },
  {
    type: "journey",
    id: "population-genetics",
    title: "How populations shape your genome",
    description: "Migration, isolation, and genetic variation.",
  },
  {
    type: "journey",
    id: "mthfr-truth",
    title: "MTHFR: separating signal from noise",
    description: "The most over-interpreted gene on the internet.",
  },
  {
    type: "journey",
    id: "clinvar-evolves",
    title: "When science changes its mind",
    description: "Pathogenic yesterday, benign today.",
  },
  {
    type: "journey",
    id: "ancient-dna",
    title: "What ancient DNA reveals about modern variants",
    description: "The past is written in base pairs.",
  },
  {
    type: "journey",
    id: "create-your-own",
    title: "Create your own thread",
    description: "Any gene. Your story.",
  },
];

const VARIANT_ID_REGEX = /^(?:CHR)?[0-9XYM]+-\d+-[A-Z]+-[A-Z]+$/i;

/**
 * GET /api/search?q=<query>
 *
 * Search strategy:
 * 1. Journey index for curated content routes
 * 2. Variant-route intent by variant-id pattern
 * 3. Optional DB-backed search cache lookup
 * 4. Live ClinVar-assisted gene hint
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const lower = query.toLowerCase();
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const addResult = (result: SearchResult) => {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(result);
  };

  // 1) Curated journey index.
  const matchingJourneys = JOURNEY_INDEX.filter(
    (j) =>
      j.title.toLowerCase().includes(lower) ||
      j.description.toLowerCase().includes(lower)
  );
  matchingJourneys.forEach(addResult);

  // 2) Variant entrypoint intent.
  if (VARIANT_ID_REGEX.test(query)) {
    const normalized = query.toUpperCase().replace(/^CHR/, "");
    addResult({
      type: "variant",
      id: normalized,
      title: normalized,
      description: "Open variant detail page",
    });
  }

  // 3) Optional DB-backed cache lookup.
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("user:password")
  ) {
    try {
      const { db } = await import("@/lib/db");
      const cached = await db
        .select()
        .from(searchCache)
        .where(eq(searchCache.query, lower))
        .limit(1);
      const cachedResults = cached[0]?.results;
      if (Array.isArray(cachedResults)) {
        for (const row of cachedResults) {
          const candidate = row as Partial<SearchResult>;
          if (
            (candidate.type === "gene" ||
              candidate.type === "variant" ||
              candidate.type === "journey") &&
            typeof candidate.id === "string" &&
            typeof candidate.title === "string" &&
            typeof candidate.description === "string"
          ) {
            addResult(candidate as SearchResult);
          }
        }
      }
    } catch {
      // Ignore DB cache lookup failures.
    }
  }

  // 4) Live ClinVar-backed gene hint.
  try {
    const clinvarIds = await searchClinvar(query, 5);
    if (clinvarIds.length > 0) {
      addResult({
        type: "gene",
        id: query.toUpperCase(),
        title: query.toUpperCase(),
        description: `Found ${clinvarIds.length} ClinVar entries`,
      });
    }
  } catch {
    // Keep endpoint resilient.
  }

  return NextResponse.json({ results: results.slice(0, 10) });
}
