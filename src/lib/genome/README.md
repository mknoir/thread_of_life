# GRCh38 reference data

The explorer axis concatenates chromosomes 1–22, X, Y and MT, in that order: 3,088,286,401 reference bases. Chromosome lengths were checked against [Ensembl's human assembly endpoint](https://rest.ensembl.org/info/assembly/homo_sapiens?content-type=application/json), reporting GRCh38.p14 on 2026-10-17. It excludes alternate loci, patches, unlocalized and unplaced scaffolds. The drawn helix is a navigation schematic, not the measured 3D structure or a literal continuous chromosome molecule.

All exported chromosome and global positions are **1-based inclusive**. `offset` is the count of bases preceding a chromosome. Therefore `global = offset + chromosomePosition`, and chromosome 2 begins at global position 248,956,423. The UCSC services use zero-based half-open intervals; adapters subtract one from the requested start and preserve the inclusive end.

`gene-index.json` contains 29,949 curated RefSeq loci from UCSC hg38. Multiple curated transcripts with the same symbol, chromosome and strand are combined into one locus with the union of their transcript bounds. These are annotation-dependent gene boundaries, not one canonical transcript. The set includes coding and noncoding loci, but is **not an exhaustive set of predicted genes or other genomic features**. It is kept server-side. The client starts with 96 real landmark genes and requests progressively sampled regional data.

`index-metadata.json` records the source URLs, retrieval timestamp, source modification date, checksums and per-chromosome counts. To refresh from the official UCSC downloads (stored in a temporary directory and removed afterward), run:

```sh
python3 src/lib/genome/build-index.py --download
```

The downloader records the actual source Last-Modified header and SHA-256 hashes. For an offline rebuild, pass the two `.txt.gz` paths and `--source-date` with the verified source modification timestamp.

## Endpoints

- `GET /api/genome/overview`: up to 24 sampled loci per chromosome; total index count and sampling disclosure.
- `GET /api/genome/region?chromosome=17&start=43044295&end=43170327`: real genes at every zoom, sampled to 180 when needed. At 500 kb or closer, fetches up to 250 ClinVar records through UCSC. At 50 kb or closer, independently fetches up to 2,500 dbSNP build 155 site records. A capped response contains the first source records, not a uniform sample or complete regional count. At 250 bp or closer, returns actual forward reference sequence and `sequenceStart`.
- `GET /api/genome/search?q=BRCA1`: local exact/prefix/name gene search; Ensembl symbol/id lookup for local misses. Also supports `chr17:43044315`, `17-43044315-T-A` and live dbSNP rsID lookup with Ensembl fallback. User-entered variant alleles without a matching ClinVar record are clearly marked unverified.

ClinVar is a clinically submitted variation catalog, **not every known human variant**. Returned `id`/`clinvarId` values identify ClinVar records. `coordinateId` is a separate GRCh38 genomic-forward `chrom-pos-ref-alt` identifier for gnomAD. The `vcfDesc` field supplies verified genomic alleles: transcript HGVS can describe the reverse complement and must never be used as genomic alleles. Unknown or structural alleles remain unset. rsID fallback results remain rsIDs and must not be passed into ClinVar's numeric-ID lookup.

[UCSC dbSNP build 155](https://genome.ucsc.edu/cgi-bin/hgTrackUi?db=hg38&g=dbSnp155Composite) supplies broader catalog coverage, not all human variation and not a person's genotype. One site record may contain several alternate alleles. `alternateAlleles` preserves these without choosing one; an empty allele represents a deletion. An unshifted substitution can supply an exact `coordinateId`. UCSC expands some indels across repeat-equivalent placements, so these retain `representation: "contextual"` and do not claim a normalized VCF identifier. A pure insertion's marker is the preceding base. Records merge across sources only when their explicit coordinate-and-allele identifiers match; an rsID alone never transfers a clinical classification.

`variantSources` reports each source's `status` (`loaded`, `unavailable`, or `zoom_required`), chromosome, source version, raw `recordCount`, parsed overlapping `variantCount`, request `limit`, `truncated` flag, and `windowLimit`. Counts precede cross-source merging and are source records, not distinct alternate alleles or estimates of all regional variants. For capped, verified coordinate-sorted `bigDbSnp` responses, `loadedThrough` conservatively excludes the final start-position group because the cap can split that group. It is omitted for ClinVar, whose VCF anchors can differ from track coordinates. A region with `loaded` and zero records is distinct from an upstream failure or an unrequested source.

Remote failures preserve local gene coordinates and return explicit warnings. Successful data is cached, partial failures are not. The UI should distinguish a missing catalog response from an absence of biological variation, and keep warnings visible.

## Verification

```sh
node --test src/lib/genome/genome.test.mjs
npx eslint src/lib/genome src/app/api/genome
```

Tests cover chromosome boundaries and coordinate round trips, index bounds, exact subpixel projection, inclusive overlap, deterministic sampling, exact symbol ranking, forward-strand ClinVar SNP alleles, VCF indel anchoring, dbSNP contextual/multiallelic representations, allele-safe merging, independent source failures, zoom limits, and conservative truncation coverage.
