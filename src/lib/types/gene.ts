import type { Claim } from "./claim";

export interface GeneConstraint {
  pLI: number | null;
  loeufScore: number | null;
  misZScore: number | null;
}

export interface GeneExpression {
  tissue: string;
  tpm: number;
  rank: number;
}

export interface GeneClinvarSummary {
  totalVariants: number;
  pathogenic: number;
  likelyPathogenic: number;
  vus: number;
  benign: number;
  likelyBenign: number;
  conflicting: number;
}

export interface GeneSummary {
  symbol: string;
  name: string;
  hgncId: string;
  description: string;
  chromosome: string;
  clinvarSummary: GeneClinvarSummary | null;
  constraint: GeneConstraint | null;
  topExpressions: GeneExpression[];
  clingenValidity: string | null;
  claims: Claim[];
  sourceVersions: Record<string, string>;
  fetchedAt: string;
}
