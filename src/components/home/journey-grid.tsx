import { JourneyCard, type JourneyCardProps } from "./journey-card";

const JOURNEYS: JourneyCardProps[] = [
  {
    id: "what-is-brca",
    title: "What does BRCA1 actually mean for you?",
    hook: "A gene everyone's heard of. Almost nobody understands.",
    description:
      "Walk through BRCA1 — from what it does in your cells, to what a variant means, to how interpretations have changed over 20 years.",
    tags: ["BRCA1", "breast cancer", "hereditary"],
    ctaLabel: "Explore BRCA1",
    imageCaption: "Every thread tells a story when you follow it far enough.",
    imageSrc: "/images/packs/thread/braided_rope.webp",
  },
  {
    id: "vus-explained",
    title: "The mystery of Variants of Uncertain Significance",
    hook: "Science's honest answer: we don't know yet.",
    description:
      "What happens when a genetic test returns a VUS? Explore why uncertainty is the most common result, and what it means for you.",
    tags: ["VUS", "interpretation", "uncertainty"],
    ctaLabel: "Understand VUS",
    imageCaption: "Certainty shatters. The pieces remain.",
    imageSrc: "/images/packs/evidence/broken_plate.webp",
  },
  {
    id: "population-genetics",
    title: "How populations shape your genome",
    hook: "Your DNA is a diary of where your ancestors walked.",
    description:
      "Explore how migration, isolation, and admixture created the genetic variation we see today — and why population matters in clinical interpretation.",
    tags: ["population", "migration", "ancestry"],
    ctaLabel: "See population story",
    imageCaption: "Frequencies move with people.",
    imageSrc: "/images/packs/history/mohenjodaro.webp",
  },
  {
    id: "mthfr-truth",
    title: "MTHFR: separating signal from noise",
    hook: "The most over-interpreted gene on the internet.",
    description:
      "MTHFR variants are common and mostly benign. But the story of how they became a wellness obsession tells us something about genetic literacy.",
    tags: ["MTHFR", "wellness", "evidence"],
    ctaLabel: "Read MTHFR evidence",
    imageCaption: "Every drawer holds a question someone once thought was answered.",
    imageSrc: "/images/packs/evidence/archive_drawers.webp",
  },
  {
    id: "clinvar-evolves",
    title: "When science changes its mind",
    hook: "Pathogenic yesterday, benign today.",
    description:
      "ClinVar tracks how variant interpretations change over time. See real examples of reclassification — and why it's a feature, not a bug.",
    tags: ["ClinVar", "reclassification", "time"],
    ctaLabel: "Track reclassifications",
    imageCaption: "Time writes itself into everything that lives.",
    imageSrc: "/images/packs/history/tree_rings.webp",
  },
  {
    id: "ancient-dna",
    title: "What ancient DNA reveals about modern variants",
    hook: "The past is written in base pairs.",
    description:
      "Some variants we carry today were present in populations thousands of years ago. Explore what ancient DNA studies are uncovering about the deep history of human genetic variation.",
    tags: ["ancient DNA", "history", "migration"],
    ctaLabel: "Explore ancient DNA",
    imageCaption: "The evidence is always in the footnotes.",
    imageSrc: "/images/packs/evidence/book.webp",
  },
  {
    id: "create-your-own",
    title: "Create your own thread",
    hook: "Any gene. Your story.",
    description:
      "Enter a gene symbol and we'll compose a narrative thread from live data — ClinVar, gnomAD, ClinGen, and GTEx.",
    tags: ["create", "gene", "explore"],
    ctaLabel: "Open explore",
    imageCaption: "Every thread tells a story when you follow it far enough.",
    imageSrc: "/images/packs/thread/spiderweb.webp",
    href: "/?tab=explore",
  },
];

export function JourneyGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {JOURNEYS.map((journey) => (
        <JourneyCard key={journey.id} {...journey} />
      ))}
    </div>
  );
}
