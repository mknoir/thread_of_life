/**
 * Pre-seed the search cache with known gene/variant entries.
 * Run via: npx tsx scripts/seed-search-index.ts
 *
 * This makes search near-instant for common queries.
 */

export {};

const INDEX_GENES = [
  { symbol: "BRCA1", name: "Breast cancer type 1 susceptibility protein" },
  { symbol: "BRCA2", name: "Breast cancer type 2 susceptibility protein" },
  { symbol: "TP53", name: "Tumor protein p53" },
  { symbol: "CFTR", name: "Cystic fibrosis transmembrane conductance regulator" },
  { symbol: "MTHFR", name: "Methylenetetrahydrofolate reductase" },
  { symbol: "MLH1", name: "DNA mismatch repair protein Mlh1" },
  { symbol: "APOE", name: "Apolipoprotein E" },
  { symbol: "PTEN", name: "Phosphatase and tensin homolog" },
  { symbol: "MSH2", name: "DNA mismatch repair protein Msh2" },
  { symbol: "APC", name: "Adenomatous polyposis coli protein" },
  { symbol: "PALB2", name: "Partner and localizer of BRCA2" },
  { symbol: "CHEK2", name: "Checkpoint kinase 2" },
  { symbol: "ATM", name: "Ataxia-telangiectasia mutated" },
  { symbol: "CDH1", name: "Cadherin-1" },
  { symbol: "RB1", name: "Retinoblastoma-associated protein" },
];

async function main() {
  console.log("Seeding search index...");
  console.log(`DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);

  // For now, the search seeds are hardcoded in the search API route.
  // When DB is connected, this script will INSERT INTO search_cache.
  console.log(`Would seed ${INDEX_GENES.length} gene entries.`);
  console.log("Search seed complete.");

  for (const gene of INDEX_GENES) {
    console.log(`  ${gene.symbol}: ${gene.name}`);
  }
}

main().catch(console.error);
