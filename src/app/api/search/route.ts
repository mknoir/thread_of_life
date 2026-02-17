import { NextResponse } from "next/server";
import { searchClinvar } from "@/lib/api/clinvar";

interface SearchResult {
  type: "gene" | "variant" | "journey";
  id: string;
  title: string;
  description: string;
}

/**
 * Local gene seed for instant search results.
 * In production, these come from search_cache table.
 */
const GENE_SEEDS: SearchResult[] = [
  {
    type: "gene",
    id: "BRCA1",
    title: "BRCA1",
    description: "Breast cancer type 1 susceptibility protein",
  },
  {
    type: "gene",
    id: "BRCA2",
    title: "BRCA2",
    description: "Breast cancer type 2 susceptibility protein",
  },
  {
    type: "gene",
    id: "TP53",
    title: "TP53",
    description: "Tumor protein p53",
  },
  {
    type: "gene",
    id: "CFTR",
    title: "CFTR",
    description: "Cystic fibrosis transmembrane conductance regulator",
  },
  {
    type: "gene",
    id: "MTHFR",
    title: "MTHFR",
    description: "Methylenetetrahydrofolate reductase",
  },
  {
    type: "gene",
    id: "MLH1",
    title: "MLH1",
    description: "DNA mismatch repair protein",
  },
  {
    type: "gene",
    id: "APOE",
    title: "APOE",
    description: "Apolipoprotein E",
  },
  {
    type: "gene",
    id: "PTEN",
    title: "PTEN",
    description: "Phosphatase and tensin homolog",
  },
];

const JOURNEY_SEEDS: SearchResult[] = [
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
];

/**
 * GET /api/search?q=<query>
 *
 * Cache-first search:
 * 1. Search local seeds
 * 2. Search cached summaries (when DB is connected)
 * 3. Live API fallback (ClinVar esearch)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const lower = query.toLowerCase();
  const results: SearchResult[] = [];

  // 1. Search local seeds (instant)
  const matchingGenes = GENE_SEEDS.filter(
    (g) =>
      g.id.toLowerCase().includes(lower) ||
      g.description.toLowerCase().includes(lower)
  );
  results.push(...matchingGenes);

  const matchingJourneys = JOURNEY_SEEDS.filter(
    (j) =>
      j.title.toLowerCase().includes(lower) ||
      j.description.toLowerCase().includes(lower)
  );
  results.push(...matchingJourneys);

  // 2. If no local results, try live ClinVar search as fallback
  if (results.length === 0) {
    try {
      const clinvarIds = await searchClinvar(query, 5);
      if (clinvarIds.length > 0) {
        results.push({
          type: "gene",
          id: query.toUpperCase(),
          title: query.toUpperCase(),
          description: `Found ${clinvarIds.length} ClinVar entries`,
        });
      }
    } catch {
      // Silently fail — search should always return fast
    }
  }

  return NextResponse.json({ results: results.slice(0, 10) });
}
