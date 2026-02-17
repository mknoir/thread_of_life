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
    // ClinGen gene search API
    const url = `${CLINGEN_BASE}/genes/${encodeURIComponent(symbol.toUpperCase())}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1209600 }, // 14 days
    });

    if (!res.ok) return null;

    const data = await res.json();

    // Extract validity classification from response
    // ClinGen API structure varies; this handles the common case
    const validityEntries = data?.gene_validity_assertions ?? [];

    if (validityEntries.length === 0) {
      return null;
    }

    // Take the first (most recent/strongest) assertion
    const first = validityEntries[0];

    return {
      validity: first?.classification ?? null,
      disease: first?.disease?.label ?? null,
      classification: first?.classification ?? null,
    };
  } catch (error) {
    console.error(`ClinGen fetch failed for gene ${symbol}:`, error);
    return null;
  }
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
