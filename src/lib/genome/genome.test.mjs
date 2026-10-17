// Run: node --test src/lib/genome/genome.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";
const loadTypeScript = createRequire(import.meta.url);
// A tiny test-only loader runs these dependency-free TypeScript helpers using the project's compiler.
loadTypeScript.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};
const { CHROMOSOMES, GENOME_LENGTH, LANDMARK_GENES, toGlobalPosition, fromGlobalPosition } = loadTypeScript("./reference.ts");
const { genesInRegion, sampleGenes, searchIndexedGenes, overviewGenes, GENOME_INDEX_METADATA } = loadTypeScript("./index.ts");
const { parseClinvarRecord, parseRefSnp, parseDbSnpRecord, mergeRegionalVariants, fetchRegionalVariantSources, DBSNP_RESULT_LIMIT } = loadTypeScript("./upstream.ts");

test("GRCh38 primary axis is contiguous and round trips both boundaries of every chromosome", () => {
  assert.equal(CHROMOSOMES.length, 25);
  assert.equal(GENOME_LENGTH, 3088286401);
  let previousEnd = 0;
  for (const chromosome of CHROMOSOMES) {
    assert.equal(chromosome.offset, previousEnd);
    for (const position of [1, Math.floor(chromosome.length / 2), chromosome.length]) {
      assert.deepEqual(fromGlobalPosition(toGlobalPosition(chromosome.id, position)), { chromosome: chromosome.id, position });
    }
    assert.equal(toGlobalPosition(chromosome.id, 1), previousEnd + 1);
    previousEnd += chromosome.length;
  }
});

test("reference boundaries reject invalid loci and safely clamp camera positions", () => {
  assert.equal(toGlobalPosition("chrM", 1), toGlobalPosition("MT", 1));
  assert.throws(() => toGlobalPosition("1", 0), RangeError);
  assert.throws(() => toGlobalPosition("1", 1.5), RangeError);
  assert.throws(() => toGlobalPosition("1", 248956423), RangeError);
  assert.throws(() => toGlobalPosition("23", 1), RangeError);
  assert.throws(() => fromGlobalPosition(NaN), RangeError);
  assert.deepEqual(fromGlobalPosition(-200), { chromosome: "1", position: 1 });
  assert.deepEqual(fromGlobalPosition(GENOME_LENGTH + 100), { chromosome: "MT", position: 16569 });
});

test("all curated loci fit their chromosome and every primary chromosome has data", () => {
  let total = 0;
  for (const chromosome of CHROMOSOMES) {
    const genes = genesInRegion({ chromosome: chromosome.id, start: 1, end: chromosome.length });
    assert.ok(genes.length > 0);
    for (const gene of genes) {
      assert.ok(gene.start >= 1 && gene.end >= gene.start && gene.end <= chromosome.length, gene.symbol);
      assert.ok(gene.strand === 1 || gene.strand === -1);
    }
    total += genes.length;
  }
  assert.equal(total, GENOME_INDEX_METADATA.totalGenes);
  assert.equal(new Set(overviewGenes().map((gene) => gene.chromosome)).size, 25);
  assert.ok(LANDMARK_GENES.length > 50);
});

test("gene search prioritizes exact symbols and inclusive overlap includes endpoint bases", () => {
  const brca1 = searchIndexedGenes("brca1")[0];
  assert.equal(brca1.symbol, "BRCA1");
  assert.equal(brca1.start, 43044295);
  assert.equal(brca1.end, 43170327);
  assert.ok(genesInRegion({ chromosome: "17", start: brca1.end, end: brca1.end }).some((gene) => gene.id === brca1.id));
  assert.ok(!genesInRegion({ chromosome: "17", start: brca1.end + 1, end: brca1.end + 1 }).some((gene) => gene.id === brca1.id));
  const chromosome = genesInRegion({ chromosome: "1", start: 1, end: CHROMOSOMES[0].length });
  const sample = sampleGenes(chromosome, 180);
  assert.equal(sample.length, 180);
  assert.equal(new Set(sample.map((gene) => gene.id)).size, 180);
  assert.equal(sample[0], chromosome[0]);
  assert.equal(sample.at(-1), chromosome.at(-1));
});

test("ClinVar parser preserves GRCh38 genomic orientation and numeric identifier", () => {
  const variant = parseClinvarRecord({
    chrom: "chr17", chromStart: 43044314, chromEnd: 43044315, name: "VCV000438907",
    origName: "438907|VCV000438907 : NM_007294.4(BRCA1):c.*1363A>T", assembly: "GRCh38",
    vcfDesc: "chr17:43044315:T>A", geneId: "672|BRCA1", snpId: "rs1332532415", clinSign: "Uncertain significance",
  });
  assert.equal(variant.id, "438907");
  assert.equal(variant.position, 43044315);
  assert.equal(variant.ref, "T"); // Never copy the transcript-oriented A>T above.
  assert.equal(variant.alt, "A");
  assert.equal(variant.coordinateId, "17-43044315-T-A");
  assert.equal(variant.gene, "BRCA1");
  assert.equal(variant.rsId, "rs1332532415");
  assert.equal(parseClinvarRecord({ chrom: "chr17", chromStart: 1, chromEnd: 2, name: "VCV000001", assembly: "GRCh37" }), null);
});

test("indels use VCF anchor coordinate and absent alleles remain unknown", () => {
  const deletion = parseClinvarRecord({ chrom: "chr17", chromStart: 100, chromEnd: 102, name: "VCV000001", vcfDesc: "chr17:100:ATC>A" });
  assert.equal(deletion.position, 100);
  assert.equal(deletion.coordinateId, "17-100-ATC-A");
  const unknown = parseClinvarRecord({ chrom: "chr17", chromStart: 100, chromEnd: 102, name: "VCV000001" });
  assert.equal(unknown.position, 101);
  assert.equal(unknown.ref, undefined);
  assert.equal(unknown.coordinateId, undefined);
});


test("NCBI SPDI uses primary GRCh38 forward placement and converts zero-based positions", () => {
  const makeRecord = (alternatives) => ({ refsnp_id: "429358", primary_snapshot_data: { placements_with_allele: [{
    seq_id: "NC_000019.10", placement_annot: { seq_type: "refseq_chromosome", is_aln_opposite_orientation: false,
      seq_id_traits_by_assembly: [{ assembly_name: "GRCh38.p14", is_alt: false, is_patch: false }] },
    alleles: ["T", ...alternatives].map((alt) => ({ allele: { spdi: { position: 44908683, deleted_sequence: "T", inserted_sequence: alt } } })),
  }] } });
  const variant = parseRefSnp(makeRecord(["C"]));
  assert.equal(variant.position, 44908684);
  assert.equal(variant.chromosome, "19");
  assert.equal(variant.coordinateId, "19-44908684-T-C");
  assert.equal(variant.id, "rs429358");
  const multiallelic = parseRefSnp(makeRecord(["C", "A"]));
  assert.equal(multiallelic.coordinateId, undefined);
  assert.equal(multiallelic.ref, "T");
  assert.equal(multiallelic.alt, undefined);
  assert.deepEqual(multiallelic.alternateAlleles, ["C", "A"]);
  assert.equal(multiallelic.representation, "site");
  const deleted = parseRefSnp(makeRecord([""]));
  assert.equal(deleted.ref, "T");
  assert.equal(deleted.alt, "");
  assert.equal(deleted.coordinateId, undefined);
  assert.equal(deleted.representation, "contextual");
  const differentContexts = makeRecord(["C", "A"]);
  differentContexts.primary_snapshot_data.placements_with_allele[0].alleles[2].allele.spdi.position++;
  assert.equal(parseRefSnp(differentContexts).alternateAlleles, undefined, "Alleles at different SPDI contexts cannot share one chooser coordinate");
});

const dbSnpRow = (overrides = {}) => ({ chrom: "chr9", chromStart: 94955250, chromEnd: 94955251,
  name: "rs913767520", ref: "A", altCount: 1, alts: "G,", shiftBases: 0, ...overrides });

test("dbSNP distinguishes exact substitutions, multiallelic sites and contextual indels", () => {
  const snv = parseDbSnpRecord(dbSnpRow());
  assert.equal(snv.position, 94955251);
  assert.equal(snv.coordinateId, "9-94955251-A-G");
  assert.equal(snv.representation, "vcf");
  const site = parseDbSnpRecord(dbSnpRow({ altCount: 2, alts: "G,T," }));
  assert.equal(site.ref, "A");
  assert.deepEqual(site.alternateAlleles, ["G", "T"]);
  assert.equal(site.alt, undefined);
  assert.equal(site.coordinateId, undefined);
  assert.equal(site.representation, "site");
  const deletion = parseDbSnpRecord(dbSnpRow({ chromStart: 100, chromEnd: 102, ref: "AA", alts: "," }));
  assert.equal(deletion.alt, "", "An empty alternate is a real deletion, not a missing value");
  assert.equal(deletion.coordinateId, undefined, "Contextual deletion lacks a VCF anchor");
  assert.equal(deletion.representation, "contextual");
  const shifted = parseDbSnpRecord(dbSnpRow({ chromStart: 100, chromEnd: 103, ref: "TTT", alts: "TT,", shiftBases: 2 }));
  assert.equal(shifted.position, 101);
  assert.equal(shifted.end, 103);
  assert.equal(shifted.coordinateId, undefined);
  const insertion = parseDbSnpRecord(dbSnpRow({ chromStart: 100, chromEnd: 100, ref: "", alts: "A," }));
  assert.equal(insertion.position, 100, "Insertion marker denotes the preceding base, without claiming VCF alleles");
  assert.equal(insertion.coordinateId, undefined);
  assert.equal(parseDbSnpRecord(dbSnpRow({ chrom: "chr9_KI270717v1_random" })), null);
  assert.equal(parseDbSnpRecord(dbSnpRow({ chromStart: -1 })), null);
  assert.equal(parseDbSnpRecord(dbSnpRow({ ref: "AA" })), null, "Reference length must match the source interval");
});

test("ClinVar enrichment merges identical alleles without transferring clinical significance across an rs site", () => {
  const snv = parseDbSnpRecord(dbSnpRow());
  const clinical = parseClinvarRecord({ chrom: "chr9", chromStart: 94955250, chromEnd: 94955251,
    name: "VCV003127400", snpId: "rs913767520", vcfDesc: "chr9:94955251:A>G", clinSign: "Uncertain significance" });
  const merged = mergeRegionalVariants([snv], [clinical]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "3127400");
  assert.equal(merged[0].rsId, "rs913767520");
  assert.match(merged[0].source, /ClinVar \+ dbSNP/);
  const otherAllele = parseDbSnpRecord(dbSnpRow({ alts: "T," }));
  const different = mergeRegionalVariants([otherAllele], [clinical]);
  assert.equal(different.length, 2);
  assert.equal(different.find((variant) => variant.alt === "T").significance, undefined);
  const site = parseDbSnpRecord(dbSnpRow({ altCount: 2, alts: "G,T," }));
  const multi = mergeRegionalVariants([site], [clinical]);
  assert.equal(multi.length, 2);
  assert.equal(multi.find((variant) => variant.id === site.id).significance, undefined);
  const unknownClinical = { ...clinical, coordinateId: undefined };
  assert.equal(mergeRegionalVariants([snv], [unknownClinical]).length, 2, "An rsID alone never proves allele identity");
});

test("regional sources distinguish failures, empty catalogs and zoom limits independently", async (t) => {
  const requested = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    requested.push(url);
    return url.includes("track=dbSnp155")
      ? { ok: false, status: 503 }
      : { ok: true, json: async () => ({ clinvarMain: [] }) };
  });
  const small = await fetchRegionalVariantSources({ chromosome: "9", start: 100, end: 200 });
  assert.deepEqual(small.variants, []);
  assert.equal(small.variantSources[0].status, "unavailable");
  assert.match(small.variantSources[0].error, /temporarily unavailable/);
  assert.equal(small.variantSources[1].status, "loaded");
  assert.equal(small.variantSources[1].recordCount, 0);
  assert.ok(requested.every((url) => url.includes("start=99;end=200")));
  requested.length = 0;
  const broad = await fetchRegionalVariantSources({ chromosome: "9", start: 1, end: 500001 });
  assert.equal(requested.length, 0);
  assert.deepEqual(broad.variantSources.map((source) => source.status), ["zoom_required", "zoom_required"]);
  const intermediate = await fetchRegionalVariantSources({ chromosome: "9", start: 1, end: 50001 });
  assert.equal(requested.length, 1);
  assert.deepEqual(intermediate.variantSources.map((source) => source.status), ["zoom_required", "loaded"]);
});

test("capped dbSNP coverage reports source rows and a conservative cutoff only for sorted bigDbSnp", async (t) => {
  const rows = Array.from({ length: DBSNP_RESULT_LIMIT }, (_, index) => dbSnpRow({
    chromStart: 100 + index, chromEnd: 101 + index, name: `rs${index + 1}`,
  }));
  t.mock.method(globalThis, "fetch", async (url) => ({ ok: true, json: async () => url.includes("track=dbSnp155")
    ? { dbSnp155: rows, trackType: "bigDbSnp", maxItemsLimit: true }
    : { clinvarMain: [] } }));
  const result = await fetchRegionalVariantSources({ chromosome: "9", start: 100, end: 10000 });
  const status = result.variantSources[0];
  assert.equal(status.recordCount, DBSNP_RESULT_LIMIT);
  assert.equal(status.variantCount, DBSNP_RESULT_LIMIT);
  assert.equal(status.truncated, true);
  assert.equal(status.loadedThrough, rows.at(-1).chromStart - 1, "The last coordinate group may have been cut mid-group");
  rows.reverse();
  const unordered = await fetchRegionalVariantSources({ chromosome: "9", start: 100, end: 10000 });
  assert.equal(unordered.variantSources[0].loadedThrough, undefined);
});

const { clampGenomeView, genomeIntervalToViewport, genomePositionAtFraction } = loadTypeScript("./navigation.ts");
test("camera windows preserve inclusive spans and exact URL round trips at every reference edge", () => {
  for (const span of [40, 250, 251, 1000, GENOME_LENGTH]) {
    for (const center of [-100, 1, 43044315, GENOME_LENGTH, GENOME_LENGTH + 100]) {
      const view = clampGenomeView({ center, span });
      const start = view.center - (view.span - 1) / 2;
      const end = view.center + (view.span - 1) / 2;
      assert.equal(end - start + 1, span);
      assert.ok(Number.isInteger(start) && Number.isInteger(end));
      assert.ok(start >= 1 && end <= GENOME_LENGTH);
      const params = new URLSearchParams({ position: String(view.center), span: String(view.span) });
      assert.deepEqual(clampGenomeView({ center: Number(params.get("position")), span: Number(params.get("span")) }), view);
    }
  }
  assert.deepEqual(clampGenomeView({ center: NaN, span: Infinity }), { center: (GENOME_LENGTH + 1) / 2, span: GENOME_LENGTH });
});


test("FBP1 has its true subpixel width at the audited chromosome-scale viewport", () => {
  const view = { center: 1623449975, span: 133275309 };
  const gene = searchIndexedGenes("FBP1")[0];
  assert.equal(gene.start, 94603133);
  assert.equal(gene.end, 94640263);
  assert.equal(gene.end - gene.start + 1, 37131);
  const start = toGlobalPosition(gene.chromosome, gene.start);
  const end = toGlobalPosition(gene.chromosome, gene.end);
  assert.equal(start, 1631092045);
  assert.equal(end, 1631129175);
  const projected = genomeIntervalToViewport(start, end, view);
  const width = (projected.end - projected.start) * 904;
  assert.ok(Math.abs(width - 0.25185778410012916) < 1e-10);
  assert.ok(width < 1, "A chromosome-scale gene must not become a wide illuminated segment");
  assert.ok(36 / width > 142, "The former 36px minimum exaggerated this locus by more than 142x");
  assert.ok(Math.abs(projected.start * 904 - 503.83578923835023) < 1e-9);
  assert.equal(genomePositionAtFraction((projected.start + projected.end) / 2, view), 1631110610);
});

test("the audited viewport crosses chr9 to chr10 and is not inferred from its span", () => {
  const view = { center: 1623449975, span: 133275309 };
  const first = genomePositionAtFraction(0, view);
  const last = genomePositionAtFraction(1, view);
  assert.equal(first, 1556812321);
  assert.equal(last, 1690087629);
  assert.equal(last - first + 1, view.span);
  assert.deepEqual(fromGlobalPosition(first), { chromosome: "9", position: 20323409 });
  assert.deepEqual(fromGlobalPosition(last), { chromosome: "10", position: 15204000 });
  assert.deepEqual(fromGlobalPosition(genomePositionAtFraction(0.5, view)), { chromosome: "9", position: 86961063 });
  const chromosome9 = genomeIntervalToViewport(toGlobalPosition("9", 1), toGlobalPosition("9", 138394717), view);
  const chromosome10 = genomeIntervalToViewport(toGlobalPosition("10", 1), toGlobalPosition("10", 133797422), view);
  assert.equal(chromosome9.start, 0);
  assert.equal(chromosome10.end, 1);
  assert.equal(chromosome9.end, chromosome10.start, "Adjacent chromosomes share an edge without gaps or overlap");
  assert.ok(Math.abs((chromosome9.end - chromosome9.start) * view.span - 118071309) < 1e-7);
  assert.ok(Math.abs((chromosome10.end - chromosome10.start) * view.span - 15204000) < 1e-7);
});

test("viewport edge projection clips inclusively and round trips first, middle and last bases", () => {
  for (const span of [40, 250, 251, 133275309, GENOME_LENGTH]) {
    for (const center of [1, 1623449975, GENOME_LENGTH]) {
      const view = clampGenomeView({ center, span });
      const first = view.center - (view.span - 1) / 2;
      const last = first + view.span - 1;
      assert.deepEqual(genomeIntervalToViewport(first, last, view), { start: 0, end: 1 });
      assert.equal(genomePositionAtFraction(-0.1, view), first);
      assert.equal(genomePositionAtFraction(1.1, view), last);
      assert.equal(genomePositionAtFraction(0.5, view), first + Math.floor(view.span / 2));
      for (const position of [first, Math.floor(view.center), last]) {
        const range = genomeIntervalToViewport(position, position, view);
        assert.ok(range && range.end > range.start);
        assert.ok(Math.abs((range.end - range.start) * view.span - 1) < 1e-6);
        assert.equal(genomePositionAtFraction((range.start + range.end) / 2, view), position);
      }
      assert.deepEqual(genomeIntervalToViewport(first - 10, first, view), { start: 0, end: 1 / view.span });
      assert.deepEqual(genomeIntervalToViewport(last, last + 10, view), { start: (view.span - 1) / view.span, end: 1 });
      assert.equal(genomeIntervalToViewport(first - 10, first - 1, view), null);
      assert.equal(genomeIntervalToViewport(last + 1, last + 10, view), null);
    }
  }
  const view = { center: 100, span: 40 };
  assert.equal(genomeIntervalToViewport(100, 99, view), null);
  assert.equal(genomeIntervalToViewport(NaN, 100, view), null);
});
