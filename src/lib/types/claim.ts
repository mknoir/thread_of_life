export interface EvidenceRef {
  id: string;
  /** e.g. "ClinVar", "ClinGen", "gnomAD" */
  sourceName: string;
  /** ISO date string, e.g. "2025-11-03" */
  date: string;
  /** Direct URL to the source record */
  link: string;
  /** Short quote or summary */
  excerpt: string;
}

export type ConfidenceLevel =
  | "high"
  | "moderate"
  | "low"
  | "contested"
  | "insufficient";

export interface Claim {
  claimText: string;
  confidenceLevel: ConfidenceLevel;
  evidenceRefs: EvidenceRef[];
}
