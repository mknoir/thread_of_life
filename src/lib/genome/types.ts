/** Primary GRCh38 reference coordinates; all local and global positions are 1-based. */
export interface GenomeGene {
  id: string;
  symbol: string;
  name: string;
  chromosome: string;
  start: number;
  end: number;
  strand: 1 | -1;
  biotype?: string;
}

export interface GenomeVariant {
  /** Numeric ClinVar variation ID for ClinVar records; otherwise the source identifier. */
  id: string;
  chromosome: string;
  position: number;
  end?: number;
  ref?: string;
  alt?: string;
  /** All source alternate alleles at a dbSNP site; an empty string denotes a deletion. */
  alternateAlleles?: string[];
  /** Contextual dbSNP indels may span repeat-equivalent placements and are not VCF-normalized. */
  representation?: "vcf" | "contextual" | "site";
  gene?: string;
  significance?: string;
  source: string;
  rsId?: string;
  consequence?: string;
  clinvarId?: string;
  /** Genomic forward-strand chrom-pos-ref-alt identifier, when source alleles exist. */
  coordinateId?: string;
}

export interface GenomeVariantSource {
  source: "dbSNP" | "ClinVar";
  chromosome: string;
  status: "loaded" | "unavailable" | "zoom_required";
  /** Rows returned by this source, not an estimate of the whole region or database. */
  recordCount: number;
  /** Parsed overlapping source records before cross-source merging; a site may have several alleles. */
  variantCount: number;
  limit: number;
  truncated: boolean;
  windowLimit: number;
  version: string;
  /** Conservative inclusive coordinate before the final (possibly incomplete) start-position group. */
  loadedThrough?: number;
  error?: string;
}

export interface GenomeRegion {
  chromosome: string;
  start: number;
  end: number;
}

export interface GenomeRegionResponse {
  genes: GenomeGene[];
  variants: GenomeVariant[];
  variantSources: GenomeVariantSource[];
  sequence?: string;
  sequenceStart?: number;
  source: string;
  warnings: string[];
  truncated?: boolean;
  totalGenes?: number;
  assembly: "GRCh38";
}
