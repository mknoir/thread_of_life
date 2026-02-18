import type { Claim } from "./claim";

export type ClinicalSignificance =
  | "Pathogenic"
  | "Likely pathogenic"
  | "Uncertain significance"
  | "Likely benign"
  | "Benign"
  | "Conflicting classifications"
  | "Other";

export type ReviewStatus =
  | "practice guideline"
  | "reviewed by expert panel"
  | "criteria provided, multiple submitters, no conflicts"
  | "criteria provided, conflicting classifications"
  | "criteria provided, single submitter"
  | "no assertion criteria provided"
  | "no classification provided";

export interface ClinvarSubmission {
  submitter: string;
  classification: ClinicalSignificance;
  condition: string;
  reviewStatus: ReviewStatus;
  dateLastEvaluated: string | null;
  method: string;
}

export interface PopulationFrequency {
  population: string;
  alleleFrequency: number;
  alleleCount: number;
  alleleNumber: number;
  homozygoteCount: number;
}

export interface GeneRegionVariant {
  id: string;
  position: number;
  clinicalSignificance: ClinicalSignificance;
  reviewStatus: ReviewStatus;
  alleleFrequency?: number | null;
}

export interface VariantSummary {
  variantId: string;
  hgvs: string;
  gene: string;
  chromosome: string;
  position: number;
  refAllele: string;
  altAllele: string;
  clinicalSignificance: ClinicalSignificance;
  reviewStatus: ReviewStatus;
  submissions: ClinvarSubmission[];
  populationFrequencies: PopulationFrequency[];
  regionStart?: number;
  regionEnd?: number;
  regionalVariants?: GeneRegionVariant[];
  claims: Claim[];
  sourceVersions: Record<string, string>;
  fetchedAt: string;
}
