/**
 * Background cache refresh script.
 * Run via: npx tsx scripts/refresh-cache.ts
 * Or via GitHub Actions cron.
 *
 * Iterates known gene/variant seeds, re-composes summaries, and updates the DB.
 * Uses the same DATABASE_URL as the Next.js app.
 */

export {};

const REFRESH_GENES = [
  "BRCA1",
  "BRCA2",
  "TP53",
  "CFTR",
  "MTHFR",
  "MLH1",
  "APOE",
  "PTEN",
  "MSH2",
  "APC",
];

async function main() {
  console.log("Starting cache refresh...");
  console.log(`DATABASE_URL configured: ${!!process.env.DATABASE_URL}`);
  console.log(`Seeds: ${REFRESH_GENES.length} genes`);

  for (const gene of REFRESH_GENES) {
    try {
      console.log(`Refreshing: ${gene}...`);
      const res = await fetch(
        `${process.env.APP_URL ?? "http://localhost:3000"}/api/gene/${gene}`
      );
      if (res.ok) {
        console.log(`  ✓ ${gene} refreshed`);
      } else {
        console.log(`  ✗ ${gene} failed: ${res.status}`);
      }
    } catch (error) {
      console.log(`  ✗ ${gene} error: ${error}`);
    }
  }

  console.log("Cache refresh complete.");
}

main().catch(console.error);
