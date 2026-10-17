import type { GenomeGene, GenomeRegion, GenomeVariant, GenomeVariantSource } from "./types";
import { CHROMOSOMES, normalizeChromosome } from "./reference";

const UCSC = "https://api.genome.ucsc.edu";
export const VARIANT_WINDOW_LIMIT = 500_000;
export const VARIANT_RESULT_LIMIT = 250;
export const DBSNP_WINDOW_LIMIT = 50_000;
export const DBSNP_RESULT_LIMIT = 2_500;
export const SEQUENCE_WINDOW_LIMIT = 250;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`Reference service returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function ucscRegion(region: GenomeRegion): string {
  const chromosome = region.chromosome === "MT" ? "M" : region.chromosome;
  return `genome=hg38;chrom=chr${chromosome};start=${region.start - 1};end=${region.end}`;
}

interface UcscClinvarRecord {
  chrom: string;
  chromStart: number;
  chromEnd: number;
  name: string;
  origName?: string;
  clinSign?: string;
  geneId?: string;
  molConseq?: string;
  snpId?: string;
  vcfDesc?: string;
  assembly?: string;
}

/** vcfDesc supplies genomic forward-strand alleles, unlike transcript HGVS labels. */
export function parseClinvarRecord(record: UcscClinvarRecord): GenomeVariant | null {
  if (record.assembly && record.assembly !== "GRCh38") return null;
  const chromosome = normalizeChromosome(record.chrom);
  if (!CHROMOSOMES.some((entry) => entry.id === chromosome)) return null;
  const clinvarId = record.origName?.match(/^(\d+)\|/)?.[1]
    ?? record.name.match(/^VCV0*(\d+)/)?.[1];
  if (!clinvarId) return null;
  const alleleMatch = record.vcfDesc?.match(/^(?:chr)?([\dXYM]+):(\d+):([ACGTN]+)>([ACGTN]+)$/i);
  const validAlleles = alleleMatch && normalizeChromosome(alleleMatch[1]) === chromosome;
  const position = validAlleles ? Number(alleleMatch[2]) : record.chromStart + 1;
  const ref = validAlleles ? alleleMatch[3].toUpperCase() : undefined;
  const alt = validAlleles ? alleleMatch[4].toUpperCase() : undefined;
  return {
    id: clinvarId, clinvarId, chromosome, position, end: record.chromEnd,
    ref, alt,
    coordinateId: ref && alt ? `${chromosome}-${position}-${ref}-${alt}` : undefined,
    representation: ref && alt ? "vcf" : "site",
    gene: record.geneId?.split(/[,;]/).map((part) => part.split("|")[1]).filter(Boolean).join(", ") || undefined,
    significance: record.clinSign || undefined,
    consequence: record.molConseq || undefined,
    rsId: record.snpId?.match(/rs\d+/)?.[0],
    source: "ClinVar via UCSC · GRCh38",
  };
}

/** ClinVar-only lookup retained for exact-allele search enrichment. */
export async function fetchRegionalVariants(region: GenomeRegion): Promise<{ variants: GenomeVariant[]; truncated: boolean; recordCount: number }> {
  const payload = await getJson<{ clinvarMain?: UcscClinvarRecord[]; maxItemsLimit?: boolean }>(
    `${UCSC}/getData/track?${ucscRegion(region)};track=clinvarMain;maxItemsOutput=${VARIANT_RESULT_LIMIT}`,
  );
  if (!Array.isArray(payload.clinvarMain)) throw new Error("ClinVar returned no readable track");
  const variants = payload.clinvarMain.map(parseClinvarRecord).filter((variant): variant is GenomeVariant => variant !== null);
  return { variants, truncated: payload.maxItemsLimit === true || payload.clinvarMain.length >= VARIANT_RESULT_LIMIT, recordCount: payload.clinvarMain.length };
}

interface UcscDbSnpRecord {
  chrom: string;
  chromStart: number;
  chromEnd: number;
  name: string;
  ref: string;
  altCount: number;
  alts: string;
  shiftBases: number;
}

/** UCSC bigDbSnp uses zero-based intervals and contextual, not necessarily VCF, alleles. */
export function parseDbSnpRecord(record: UcscDbSnpRecord): GenomeVariant | null {
  const chromosome = normalizeChromosome(record.chrom);
  const reference = CHROMOSOMES.find((entry) => entry.id === chromosome);
  if (!reference || !/^rs\d+$/.test(record.name)
    || !Number.isSafeInteger(record.chromStart) || !Number.isSafeInteger(record.chromEnd)
    || record.chromStart < 0 || record.chromEnd < record.chromStart || record.chromEnd > reference.length
    || !Number.isSafeInteger(record.altCount) || record.altCount < 1
    || !Number.isSafeInteger(record.shiftBases) || record.shiftBases < 0
    || typeof record.ref !== "string" || typeof record.alts !== "string") return null;
  // A trailing comma terminates the list; empty elements within it are real deletion alleles.
  const alternateAlleles = record.alts.split(",").slice(0, record.altCount).map((allele) => allele.toUpperCase());
  const ref = record.ref.toUpperCase();
  if (alternateAlleles.length !== record.altCount || ref.length !== record.chromEnd - record.chromStart || !/^[ACGTN]*$/.test(ref)
    || alternateAlleles.some((allele) => !/^[ACGTN]*$/.test(allele))) return null;
  const alt = alternateAlleles.length === 1 ? alternateAlleles[0] : undefined;
  // Empty-reference insertions occur between bases. Anchor their site marker to the
  // preceding base, without asserting that it is a VCF allele/position.
  const position = ref.length === 0 ? Math.max(1, record.chromStart) : record.chromStart + 1;
  const simple = record.shiftBases === 0 && ref.length > 0 && alt !== undefined && alt.length === ref.length
    && record.chromEnd - record.chromStart === ref.length;
  return {
    id: record.name, rsId: record.name, chromosome, position,
    end: Math.max(position, record.chromEnd), ref, alt, alternateAlleles,
    coordinateId: simple ? `${chromosome}-${position}-${ref}-${alt}` : undefined,
    representation: simple ? "vcf" : (record.shiftBases > 0 || alternateAlleles.some((allele) => allele.length !== ref.length)) ? "contextual" : "site",
    source: "dbSNP build 155 via UCSC · GRCh38",
  };
}

/** Merge only identical explicit alleles. An rsID alone does not establish allele identity. */
export function mergeRegionalVariants(dbSnp: GenomeVariant[], clinvar: GenomeVariant[]): GenomeVariant[] {
  const clinicalCoordinates = new Set(clinvar.map((variant) => variant.coordinateId).filter(Boolean));
  const dbSnpByCoordinate = new Map(dbSnp.filter((variant) => variant.coordinateId).map((variant) => [variant.coordinateId, variant]));
  const merged = dbSnp.filter((variant) => !variant.coordinateId || !clinicalCoordinates.has(variant.coordinateId));
  for (const clinical of clinvar) {
    const site = clinical.coordinateId ? dbSnpByCoordinate.get(clinical.coordinateId) : undefined;
    merged.push(site ? {
      ...site, ...clinical, rsId: clinical.rsId ?? site.rsId,
      source: "ClinVar + dbSNP build 155 via UCSC · GRCh38",
    } : clinical);
  }
  const seen = new Set<string>();
  return merged.filter((variant) => {
    const key = `${variant.chromosome}:${variant.position}:${variant.id}:${variant.coordinateId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** Both tracks are independent: a source outage must never masquerade as no variants. */
export async function fetchRegionalVariantSources(region: GenomeRegion): Promise<{ variants: GenomeVariant[]; variantSources: GenomeVariantSource[] }> {
  const span = region.end - region.start + 1;
  const configurations = [
    { source: "dbSNP" as const, limit: DBSNP_RESULT_LIMIT, windowLimit: DBSNP_WINDOW_LIMIT, version: "build 155" },
    { source: "ClinVar" as const, limit: VARIANT_RESULT_LIMIT, windowLimit: VARIANT_WINDOW_LIMIT, version: "UCSC clinvarMain" },
  ];
  const results = await Promise.all(configurations.map(async (configuration) => {
    const status: GenomeVariantSource = {
      ...configuration, chromosome: region.chromosome,
      status: span > configuration.windowLimit ? "zoom_required" : "loaded",
      recordCount: 0, variantCount: 0, truncated: false,
    };
    if (status.status === "zoom_required") return { variants: [] as GenomeVariant[], status };
    try {
      let variants: GenomeVariant[];
      if (configuration.source === "ClinVar") {
        const payload = await fetchRegionalVariants(region);
        variants = payload.variants;
        status.recordCount = payload.recordCount;
        status.truncated = payload.truncated;
      } else {
        const payload = await getJson<{ dbSnp155?: UcscDbSnpRecord[]; maxItemsLimit?: boolean; trackType?: string }>(
          `${UCSC}/getData/track?${ucscRegion(region)};track=dbSnp155;maxItemsOutput=${DBSNP_RESULT_LIMIT}`,
        );
        if (!Array.isArray(payload.dbSnp155)) throw new Error("dbSNP returned no readable track");
        const rows = payload.dbSnp155;
        variants = rows.map(parseDbSnpRecord).filter((variant): variant is GenomeVariant => variant !== null);
        status.recordCount = rows.length;
        status.truncated = payload.maxItemsLimit === true || rows.length >= DBSNP_RESULT_LIMIT;
        // bigBed storage is coordinate sorted, and UCSC's API emits its first rows.
        // Verify that order at runtime; exclude the final start-position group because
        // the cap may split several records at that coordinate. Never infer a tail for SQL tracks.
        if (status.truncated && payload.trackType === "bigDbSnp" && rows.length
          && rows.every((row, index) => index === 0 || row.chromStart >= rows[index - 1].chromStart)) {
          const lastStart = rows[rows.length - 1].chromStart;
          // A pure insertion is anchored at chromStart itself, rather than +1.
          if (lastStart > region.start) status.loadedThrough = Math.min(region.end, lastStart - 1);
        }
      }
      variants = variants.filter((variant) => variant.chromosome === region.chromosome
        && variant.position <= region.end && (variant.end ?? variant.position) >= region.start);
      status.variantCount = variants.length;
      return { variants, status };
    } catch {
      status.status = "unavailable";
      status.error = `${configuration.source} is temporarily unavailable. Retry this region.`;
      return { variants: [] as GenomeVariant[], status };
    }
  }));
  return {
    variants: mergeRegionalVariants(results[0].variants, results[1].variants),
    variantSources: results.map((result) => result.status),
  };
}

export async function fetchReferenceSequence(region: GenomeRegion): Promise<string> {
  const payload = await getJson<{ dna?: string }>(`${UCSC}/getData/sequence?${ucscRegion(region)}`);
  if (!payload.dna || payload.dna.length !== region.end - region.start + 1 || !/^[ACGTN]+$/i.test(payload.dna)) {
    throw new Error("Reference sequence was incomplete");
  }
  return payload.dna.toUpperCase();
}

/** Search fallback for Ensembl identifiers and symbols missing from the local curated index. */
export async function lookupEnsemblGene(query: string): Promise<GenomeGene | null> {
  const endpoint = /^ENSG\d+(?:\.\d+)?$/i.test(query)
    ? `/lookup/id/${encodeURIComponent(query.replace(/\.\d+$/, ""))}`
    : `/lookup/symbol/homo_sapiens/${encodeURIComponent(query.toUpperCase())}`;
  const result = await getJson<{
    id?: string; display_name?: string; description?: string; assembly_name?: string;
    seq_region_name?: string; start?: number; end?: number; strand?: number; biotype?: string;
  }>(`https://rest.ensembl.org${endpoint}?content-type=application%2Fjson`);
  if (result.assembly_name !== "GRCh38" || !result.id || !result.seq_region_name || !result.start || !result.end) return null;
  const chromosome = normalizeChromosome(result.seq_region_name);
  if (!CHROMOSOMES.some((entry) => entry.id === chromosome)) return null;
  return {
    id: result.id, symbol: result.display_name ?? query, name: result.description?.replace(/ \[Source:.*$/, "") ?? result.display_name ?? query,
    chromosome, start: result.start, end: result.end, strand: result.strand === -1 ? -1 : 1, biotype: result.biotype,
  };
}

async function lookupEnsemblRsVariant(id: string): Promise<GenomeVariant | null> {
  const result = await getJson<{
    name?: string; most_severe_consequence?: string; clinical_significance?: string[];
    mappings?: Array<{ assembly_name: string; seq_region_name: string; start: number; end: number; allele_string?: string; strand?: number }>;
  }>(`https://rest.ensembl.org/variation/homo_sapiens/${encodeURIComponent(id)}?content-type=application%2Fjson`);
  const mapping = result.mappings?.find((entry) => entry.assembly_name === "GRCh38" && entry.strand === 1 && CHROMOSOMES.some((chromosome) => chromosome.id === normalizeChromosome(entry.seq_region_name)));
  if (!mapping) return null;
  const chromosome = normalizeChromosome(mapping.seq_region_name);
  // Multiallelic rs identifiers describe a site, so avoid inventing one alternate allele.
  const alleles = mapping.allele_string?.split("/") ?? [];
  const substitutions = alleles.length >= 2 && alleles.every((allele) => /^[ACGTN]+$/.test(allele) && allele.length === alleles[0].length)
    && mapping.end - mapping.start + 1 === alleles[0].length;
  const ref = substitutions ? alleles[0] : undefined;
  const alternateAlleles = substitutions ? alleles.slice(1) : undefined;
  const alt = alternateAlleles?.length === 1 ? alternateAlleles[0] : undefined;
  return {
    id: result.name ?? id, rsId: result.name ?? id, chromosome, position: mapping.start, end: mapping.end,
    ref, alt, alternateAlleles, representation: ref && alt ? "vcf" : "site",
    coordinateId: ref && alt ? `${chromosome}-${mapping.start}-${ref}-${alt}` : undefined,
    significance: alt ? result.clinical_significance?.join(", ") : undefined, consequence: result.most_severe_consequence,
    source: "Ensembl variation · GRCh38",
  };
}

interface RefSnpResponse {
  refsnp_id?: string;
  primary_snapshot_data?: {
    placements_with_allele?: Array<{
      seq_id: string;
      placement_annot?: {
        seq_type?: string;
        is_aln_opposite_orientation?: boolean;
        seq_id_traits_by_assembly?: Array<{ assembly_name: string; is_alt?: boolean; is_patch?: boolean }>;
      };
      alleles?: Array<{ allele: { spdi: { position: number; deleted_sequence: string; inserted_sequence: string } } }>;
    }>;
  };
}

/** NCBI SPDI positions are zero-based; select only forward primary GRCh38 placement. */
export function parseRefSnp(result: RefSnpResponse): GenomeVariant | null {
  const placement = result.primary_snapshot_data?.placements_with_allele?.find((entry) =>
    entry.placement_annot?.seq_type === "refseq_chromosome"
    && entry.placement_annot.is_aln_opposite_orientation !== true
    && entry.placement_annot.seq_id_traits_by_assembly?.some((assembly) =>
      assembly.assembly_name.startsWith("GRCh38") && !assembly.is_alt && !assembly.is_patch));
  if (!placement || !result.refsnp_id) return null;
  const accessionNumber = Number(placement.seq_id.match(/^NC_0*(\d+)\./)?.[1]);
  const chromosome = accessionNumber === 23 ? "X" : accessionNumber === 24 ? "Y" : accessionNumber === 12920 ? "MT" : String(accessionNumber);
  const reference = CHROMOSOMES.find((entry) => entry.id === chromosome);
  const alleles = placement.alleles?.map((entry) => entry.allele.spdi) ?? [];
  const alternatives = alleles.filter((allele) => allele.deleted_sequence !== allele.inserted_sequence);
  const first = alternatives[0];
  if (!reference || !first || !Number.isSafeInteger(first.position) || first.position < 0
    || first.position + first.deleted_sequence.length > reference.length) return null;
  const position = first.deleted_sequence.length ? first.position + 1 : Math.max(1, first.position);
  // An rsID can describe several alleles. Only a unique explicit sequence substitution
  // provides an unambiguous chrom-pos-ref-alt identifier; SPDI indels lack VCF anchors.
  const commonContext = alternatives.every((allele) => allele.position === first.position && allele.deleted_sequence === first.deleted_sequence
    && /^[ACGTN]*$/.test(allele.deleted_sequence) && /^[ACGTN]*$/.test(allele.inserted_sequence));
  const ref = commonContext ? first.deleted_sequence : undefined;
  const alternateAlleles = commonContext ? [...new Set(alternatives.map((allele) => allele.inserted_sequence))] : undefined;
  const alt = alternateAlleles?.length === 1 ? alternateAlleles[0] : undefined;
  const substitutions = ref !== undefined && ref.length > 0 && alternateAlleles?.every((allele) => allele.length === ref.length);
  const simple = substitutions && alt !== undefined;
  return {
    id: `rs${result.refsnp_id}`, rsId: `rs${result.refsnp_id}`, chromosome, position,
    end: position + Math.max(1, first.deleted_sequence.length) - 1,
    ref, alt, alternateAlleles, representation: simple ? "vcf" : substitutions || !commonContext ? "site" : "contextual",
    coordinateId: simple ? `${chromosome}-${position}-${ref}-${alt}` : undefined,
    source: "NCBI dbSNP · GRCh38",
  };
}

export async function lookupRsVariant(id: string): Promise<GenomeVariant | null> {
  try {
    const result = await getJson<RefSnpResponse>(`https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/${id.replace(/^rs/i, "")}`);
    const variant = parseRefSnp(result);
    if (variant) return variant;
  } catch { /* Ensembl remains a second source when dbSNP is unavailable. */ }
  return lookupEnsemblRsVariant(id);
}
