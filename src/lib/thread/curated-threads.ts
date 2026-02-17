import { getAssetById } from "@/lib/images/registry";
import type { ThreadData } from "./compose-thread-from-gene";

/** Gene journeys that redirect to dynamic gene thread */
export const GENE_JOURNEY_REDIRECTS: Record<string, string> = {
  "what-is-brca": "BRCA1",
  "mthfr-truth": "MTHFR",
};

/** Journeys that redirect elsewhere */
export const JOURNEY_REDIRECTS: Record<string, string> = {
  "create-your-own": "/?tab=explore",
};

/** Curated content for conceptual journeys */
export function getCuratedThread(id: string): ThreadData | null {
  const content = CURATED_THREADS[id];
  if (!content) return null;
  return content;
}

const CURATED_THREADS: Record<string, ThreadData> = {
  "vus-explained": {
    id: "vus-explained",
    title: "The mystery of Variants of Uncertain Significance",
    subtitle: "Science's honest answer: we don't know yet.",
    sections: [
      {
        title: "What is a VUS?",
        prose:
          "When a lab sequences your DNA and finds a variant they've never seen before, or one that hasn't been studied enough, they often classify it as a Variant of Uncertain Significance. It's not benign. It's not pathogenic. It's the scientific equivalent of \"we need more data.\" For many genes, VUS is the most common result in ClinVar.",
        imageAsset: getAssetById("evidence", "broken-plate") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
      {
        title: "Why so many?",
        prose:
          "Genetic testing has exploded in the last decade. We're finding variants faster than we can study them. Each new variant requires functional studies, population data, and clinical follow-up before we can confidently say what it means. That takes time. In the meantime, the honest answer is uncertainty.",
        claims: [],
        sourceVersions: {},
      },
      {
        title: "What it means for you",
        prose:
          "A VUS result doesn't mean your variant is dangerous. It doesn't mean it's harmless. It means we don't know yet. Some VUS get reclassified as pathogenic or benign as evidence accumulates. If you have a VUS, ask your provider about reanalysis timelines and whether your variant has been seen in other families.",
        imageAsset: getAssetById("evidence", "book") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
    ],
  },
  "population-genetics": {
    id: "population-genetics",
    title: "How populations shape your genome",
    subtitle: "Your DNA is a diary of where your ancestors walked.",
    sections: [
      {
        title: "Migration and drift",
        prose:
          "Human genetic variation didn't arise randomly. It was shaped by migration, isolation, founder effects, and natural selection. A variant that's rare in one population might be common in another. That's why ancestry matters in clinical interpretation: the same variant can have different implications depending on the population context.",
        imageAsset: getAssetById("history", "mohenjodaro") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
      {
        title: "Why it matters clinically",
        prose:
          "When a lab interprets a variant, they often look at population databases like gnomAD. A variant that's common in your ancestral population may be less likely to cause disease than one that's vanishingly rare everywhere. Population genetics helps us separate signal from noise.",
        claims: [],
        sourceVersions: {},
      },
      {
        title: "The limits of labels",
        prose:
          "Population labels are imperfect. Admixture, migration, and identity are complex. Genetic ancestry is one piece of the puzzle, not the whole picture. Use it to inform interpretation, not to oversimplify.",
        imageAsset: getAssetById("history", "tree-rings") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
    ],
  },
  "clinvar-evolves": {
    id: "clinvar-evolves",
    title: "When science changes its mind",
    subtitle: "Pathogenic yesterday, benign today.",
    sections: [
      {
        title: "Interpretations are not set in stone",
        prose:
          "ClinVar is a living database. Labs submit their interpretations, and over time, as new evidence emerges, those interpretations can change. A variant classified as pathogenic in 2015 might be reclassified as benign in 2025. That's not a bug. It's how science works.",
        imageAsset: getAssetById("history", "tree-rings") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
      {
        title: "Why reclassification happens",
        prose:
          "New functional studies, population data, or clinical follow-up can shift the balance of evidence. Sometimes a variant turns out to be too common in healthy people to cause disease. Sometimes we learn it disrupts a critical protein domain. The goal is to get it right, even if that means changing our minds.",
        claims: [],
        sourceVersions: {},
      },
      {
        title: "What you can do",
        prose:
          "If you have a variant that was classified years ago, ask about reanalysis. Many labs and clinics periodically review old results. ClinVar tracks submission history so you can see how interpretations have evolved.",
        imageAsset: getAssetById("evidence", "archive-drawers") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
    ],
  },
  "ancient-dna": {
    id: "ancient-dna",
    title: "What ancient DNA reveals about modern variants",
    subtitle: "The past is written in base pairs.",
    sections: [
      {
        title: "Reading the past",
        prose:
          "Ancient DNA from bones, teeth, and sediments has transformed our understanding of human history. We can now trace migrations, admixture events, and the spread of variants across continents and millennia. Some variants we carry today were present in people who lived thousands of years ago.",
        imageAsset: getAssetById("history", "mohenjodaro") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
      {
        title: "Clinical implications",
        prose:
          "If a variant was present in ancient populations and has persisted, it may be tolerated by natural selection. That doesn't automatically make it benign, but it adds context. Ancient DNA is one more line of evidence in the interpretation puzzle.",
        claims: [],
        sourceVersions: {},
      },
      {
        title: "The long view",
        prose:
          "We're still learning. Ancient DNA studies are expanding rapidly. What we know today will look different in a decade. The thread of life runs through time, and we're only beginning to trace it.",
        imageAsset: getAssetById("evidence", "book") ?? undefined,
        claims: [],
        sourceVersions: {},
      },
    ],
  },
};
