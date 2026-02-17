import "server-only";

const CLINGEN_BASE = "https://search.clinicalgenome.org/kb";

interface ClinGenGeneValidity {
  validity: string | null;
  disease: string | null;
  classification: string | null;
}

/**
 * Fetch ClinGen gene-disease validity for a gene symbol.
 * Uses ClinGen's search API.
 */
export async function fetchClingenValidity(
  symbol: string
): Promise<ClinGenGeneValidity | null> {
  try {
    const url = `${CLINGEN_BASE}/genes/${encodeURIComponent(symbol.toUpperCase())}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1209600 }, // 14 days
    });

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";

    // Old behavior: JSON payload with gene_validity_assertions.
    if (contentType.includes("application/json")) {
      const data = await res.json();
      const validityEntries = data?.gene_validity_assertions ?? [];
      if (validityEntries.length === 0) return null;
      const first = validityEntries[0];
      const classification = first?.classification ?? null;
      return {
        validity: classification,
        disease: first?.disease?.label ?? null,
        classification,
      };
    }

    // Current behavior: HTML page. Extract classification label(s) from curation rows.
    const html = await res.text();
    const classifications = extractValidityClassificationsFromHtml(html);
    if (classifications.length === 0) return null;

    const strongest = pickStrongestValidity(classifications);
    return {
      validity: strongest,
      disease: null,
      classification: strongest,
    };
  } catch (error) {
    console.error(`ClinGen fetch failed for gene ${symbol}:`, error);
    return null;
  }
}

const VALIDITY_RANK: Record<string, number> = {
  Definitive: 6,
  Strong: 5,
  Moderate: 4,
  Limited: 3,
  Disputed: 2,
  Refuted: 1,
  "No Known Disease Relationship": 0,
};

function extractValidityClassificationsFromHtml(html: string): string[] {
  const matches = html.matchAll(
    /btn-classification"[^>]*>\s*([^<\n\r]+?)\s*<\/a>/gi
  );
  const values = Array.from(matches, (m) => normalizeValidityLabel(m[1] ?? ""));
  return values.filter((v): v is string => Boolean(v));
}

function normalizeValidityLabel(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned in VALIDITY_RANK) return cleaned;
  return null;
}

function pickStrongestValidity(labels: string[]): string {
  return labels.sort(
    (a, b) => (VALIDITY_RANK[b] ?? -1) - (VALIDITY_RANK[a] ?? -1)
  )[0]!;
}

/**
 * Fetch ClinGen dosage sensitivity for a gene.
 */
export async function fetchClingenDosage(
  symbol: string
): Promise<{ haploinsufficiency: string | null; triplosensitivity: string | null } | null> {
  try {
    const url = `${CLINGEN_BASE}/gene-dosage/${encodeURIComponent(symbol.toUpperCase())}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1209600 }, // 14 days
    });

    if (!res.ok) return null;

    const data = await res.json();

    return {
      haploinsufficiency: data?.haploinsufficiency?.label ?? null,
      triplosensitivity: data?.triplosensitivity?.label ?? null,
    };
  } catch (error) {
    console.error(`ClinGen dosage fetch failed for ${symbol}:`, error);
    return null;
  }
}
