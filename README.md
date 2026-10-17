# Thread of Life

An interactive Three.js atlas of the human reference genome. Scroll or drag along the horizontal double helix; zoom from the genome to chromosome, gene, variant, and reference-base detail. Hover over a gene to reveal its exact RefSeq interval, or use keyboard focus. The highlight uses that interval at the current scale; genes smaller than one pixel are identified as unresolved at that zoom, never widened to imply a larger locus. Select a locus for connected evidence and choose **Tell me more** for a cited AI summary of its history and scientific significance. The interface uses a black background, neutral controls, and a gold particle helix with subtle idle motion.

## Run locally

```sh
npm run dev -- --port 3001
```

Open http://localhost:3001. Dependencies use the existing pnpm lockfile (pnpm 10). Production: `npm run build`, then `npm start`.

## Navigation

- Scroll / drag: move along the genomic axis. Pinch or Ctrl/⌘ + scroll: zoom.
- `+` / `−`: zoom; arrow keys: travel; double-click the strand: zoom toward a position.
- Chromosome map (or the phone picker): jump to a chromosome.
- Search / `⌘K`: find a gene, rsID, GRCh38 coordinate, or explicit allele.
- Click a gene or variant: open Overview, Evidence, and Summary. Touch users can tap a gene directly.
- Pause / Resume animation: the icon beside the zoom controls toggles idle motion. The scene respects the system's reduced-motion preference.
- Current location and scale are retained in the URL. Idle motion is decorative; genomic coordinates change only during navigation. Search and evidence remain usable without WebGL.

## Reference and evidence

The axis covers 3,088,286,401 coordinate positions, including reference gaps, across GRCh38 primary chromosomes 1–22, X, Y and MT. Separate chromosomes are concatenated for navigation; the helix is schematic, not a literal continuous molecule or measured chromatin structure. All displayed positions are 1-based inclusive. This is not a gapless assembly or the full set of alternate, patch, unlocalized, and unplaced sequences. The displayed start/end range and chromosome dividers expose the exact viewport.

The bundled index contains 29,949 curated RefSeq loci. The whole genome is navigable, but this index does not include every predicted gene, alternate contig, or annotation. Labels are thinned to avoid collisions. dbSNP build 155 sites load at 50 kb or closer (up to 2,500 source records), alongside ClinVar at 500 kb or closer (up to 250 source records). Every loaded in-window variant has an exact-position tick; counted groups open the full record list instead of discarding nearby markers. Per-source counts, failed requests, zoom thresholds, and caps are visible. These are catalogues of observations across people, not one person’s variants or an exhaustive catalogue of human variation. Multiallelic sites preserve their alternative alleles; clinical labels are merged only for exact allele matches. Exact forward reference sequence loads at 250 bp or closer in single-chromosome windows. The scrolling sequence readout is separate from the spatial ruler. Decorative rungs at wider scales do not stand for individual nucleotides. See [source metadata, scope, and refresh instructions](src/lib/genome/README.md).

The detail drawer reuses ClinVar, gnomAD, GTEx, and ClinGen adapters. Variant classification and population frequency load through one request with separate source statuses and retry. Known source metadata remains visible while live evidence loads. Unavailable evidence stays unavailable; failed requests are not turned into zero counts or cached as successful empty responses. ClinVar classifications retain their raw wording and condition-dependent context. Existing gene, variant, and narrative routes remain available.

## AI stories

Set `OPENAI_API_KEY` in `.env.local` to enable the server-side story endpoint. Optional `OPENAI_GENOME_STORY_MODEL` overrides the default `gpt-4.1-mini`. Keys never enter the client bundle.

Stories retrieve source data plus a small selection of early and recent PubMed papers. Every generated statement links to numbered sources. This is a selected, bounded synthesis, not an exhaustive history or a clinical recommendation. Missing literature, unresolved variant alleles, and service errors produce explicit unavailable states. Generation is on demand, deduplicated and cached; no-key deployments retain the complete navigator and evidence panels.

## Check

```sh
npm test
npm run lint
npm run build
```

Tests cover chromosome boundaries, inclusive viewports, URL round trips, index bounds, sequence orientation, clinical classification, missing-vs-zero counts, bounded source calls, and AI citation handling. The UI is responsive, keyboard navigable, and renders its 3D geometry with bounded instanced meshes rather than allocating billions of base objects.

## Coordinate rendering

The orthographic x axis is linear in reference coordinates. Surface cross-sections carry their true curve-sampled locus coordinate; idle rotation is restricted to the x axis, so it cannot move a locus horizontally. Gene highlighting has no minimum pixel width, nearby-gene snapping, or outward shader feather. A separate exact-boundary bracket remains the coordinate cue; lighting and the 3D molecular shape are schematic.
