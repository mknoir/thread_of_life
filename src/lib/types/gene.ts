import type { Claim } from "./claim";

export interface GeneConstraint {
  pLI: number | null;
  loeufScore: number | null;
  misZScore: number | null;
}

export interface GnomadGeneLandscapeBin {
  index: number;
  start: number;
  end: number;
  total: number;
  lof: number;
  missense: number;
  synonymous: number;
  other: number;
  maxAf: number;
}

export interface GnomadGeneLandscape {
  chromosome: string;
  regionStart: number;
  regionEnd: number;
  totalVariants: number;
  binCount: number;
  bins: GnomadGeneLandscapeBin[];
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
  other: number;
}

export interface GeneSummary {
  symbol: string;
  name: string;
  hgncId: string;
  description: string;
  chromosome: string;
  clinvarSummary: GeneClinvarSummary | null;
  constraint: GeneConstraint | null;
  gnomadLandscape: GnomadGeneLandscape | null;
  topExpressions: GeneExpression[];
  clingenValidity: string | null;
  claims: Claim[];
  sourceVersions: Record<string, string>;
  fetchedAt: string;
}
