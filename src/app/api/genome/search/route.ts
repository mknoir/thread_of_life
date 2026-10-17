import { NextResponse } from "next/server";
import { genesInRegion, searchIndexedGenes } from "@/lib/genome";
import { CHROMOSOMES, normalizeChromosome } from "@/lib/genome/reference";
import { fetchRegionalVariants, lookupEnsemblGene, lookupRsVariant } from "@/lib/genome/upstream";
import type { GenomeVariant } from "@/lib/genome/types";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 120) return NextResponse.json({ genes: [] });
  const coordinate = query.match(/^(?:chr)?([\dXYMT]+)[:-](\d[\d,]*)(?:-([ACGTN]+)-([ACGTN]+))?$/i);
  if (coordinate) {
    const chromosome = normalizeChromosome(coordinate[1]);
    const position = Number(coordinate[2].replaceAll(",", ""));
    const reference = CHROMOSOMES.find((entry) => entry.id === chromosome);
    if (!reference || position < 1 || position > reference.length || !Number.isSafeInteger(position)) {
      return NextResponse.json({ genes: [], error: "This position is outside the primary GRCh38 reference." }, { status: 400 });
    }
    const genes = genesInRegion({ chromosome, start: position, end: position });
    if (coordinate[3] && coordinate[4]) {
      const coordinateId = `${chromosome}-${position}-${coordinate[3].toUpperCase()}-${coordinate[4].toUpperCase()}`;
      try {
        const regional = await fetchRegionalVariants({ chromosome, start: position, end: position });
        const variant = regional.variants.find((record) => record.coordinateId === coordinateId);
        if (variant) return NextResponse.json({ genes, variant });
      } catch { /* Explicit user-supplied locus can still be located without claiming catalog presence. */ }
      const variant: GenomeVariant = {
        id: coordinateId, coordinateId, chromosome, position, ref: coordinate[3].toUpperCase(), alt: coordinate[4].toUpperCase(),
        gene: genes[0]?.symbol, source: "Entered coordinates · catalog membership and reference allele unverified",
      };
      return NextResponse.json({ genes, variant });
    }
    return NextResponse.json({ genes, region: { chromosome, start: position, end: position } });
  }
  const genes = searchIndexedGenes(query);
  if (genes.length) return NextResponse.json({ genes });
  if (!/^[A-Za-z0-9_.-]+$/.test(query)) return NextResponse.json({ genes: [] });
  try {
    if (/^rs\d+$/i.test(query)) {
      let variant = await lookupRsVariant(query.toLowerCase());
      if (!variant) return NextResponse.json({ genes: [], error: "No primary GRCh38 mapping was found for this variant." });
      // An rsID may contain several alleles. Clinical enrichment requires the same
      // explicit allele; never silently choose one ClinVar record for an unresolved site.
      try {
        if (variant.coordinateId) {
          const nearby = await fetchRegionalVariants({ chromosome: variant.chromosome, start: variant.position, end: variant.position });
          const clinical = nearby.variants.find((entry) => entry.coordinateId === variant?.coordinateId);
          if (clinical) variant = { ...variant, ...clinical, rsId: clinical.rsId ?? variant.rsId };
        }
      } catch { /* dbSNP mapping remains valid independently of ClinVar availability. */ }
      const overlaps = genesInRegion({ chromosome: variant.chromosome, start: variant.position, end: variant.position });
      variant.gene = overlaps[0]?.symbol;
      return NextResponse.json({ genes: overlaps, variant });
    }
    const gene = await lookupEnsemblGene(query);
    return NextResponse.json({ genes: gene ? [gene] : [] });
  } catch {
    return NextResponse.json({ genes: [], error: "No match in the local RefSeq index; live Ensembl lookup is temporarily unavailable." }, { status: 503 });
  }
}
