"""Rebuild the bundled primary-chromosome GRCh38 RefSeq index from UCSC.
Usage: python3 src/lib/genome/build-index.py --download
   or: python3 src/lib/genome/build-index.py CURATED.txt.gz LINK.txt.gz --source-date 2025-08-13T15:30:40Z
Source downloads and retrieval date are recorded in index-metadata.json.
UCSC transcript coordinates are zero-based half-open; output is 1-based inclusive.
"""
import argparse
import collections
import datetime
import gzip
import hashlib
import json
import pathlib
import re
import tempfile
import urllib.request
from email.utils import parsedate_to_datetime

root = pathlib.Path(__file__).parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("curated", nargs="?", type=pathlib.Path)
parser.add_argument("links", nargs="?", type=pathlib.Path)
parser.add_argument("--download", action="store_true", help="Fetch official UCSC source files into a temporary directory")
parser.add_argument("--source-date", help="ISO source modification timestamp when rebuilding from local source files")
args = parser.parse_args()
source_urls = [
    "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/ncbiRefSeqCurated.txt.gz",
    "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/ncbiRefSeqLink.txt.gz",
]
source_modified = args.source_date
scratch = None
if args.download:
    scratch = tempfile.TemporaryDirectory(prefix="thread-of-life-reference-")
    downloaded = []
    for index, url in enumerate(source_urls):
        destination = pathlib.Path(scratch.name) / url.rsplit("/", 1)[-1]
        with urllib.request.urlopen(url, timeout=60) as response:
            destination.write_bytes(response.read())
            if index == 0 and response.headers.get("Last-Modified"):
                source_modified = parsedate_to_datetime(response.headers["Last-Modified"]).isoformat()
        downloaded.append(destination)
    curated, links = downloaded
elif args.curated and args.links:
    curated, links = args.curated, args.links
else:
    parser.error("Supply --download or both source .txt.gz paths")
chromosomes = [str(i) for i in range(1, 23)] + ["X", "Y", "MT"]
metadata = {}
with gzip.open(links, "rt") as handle:
    for line in handle:
        row = line.rstrip("\n").split("\t")
        metadata[row[0]] = row
loci = {}
with gzip.open(curated, "rt") as handle:
    for line in handle:
        row = line.rstrip("\n").split("\t")
        chromosome = row[2].removeprefix("chr")
        chromosome = "MT" if chromosome == "M" else chromosome
        if chromosome not in chromosomes:
            continue
        symbol, strand = row[12], 1 if row[3] == "+" else -1
        key = (chromosome, symbol, strand)
        info = metadata.get(row[1], [])
        name = re.sub(r",? transcript variant.*$", "", info[3]) if info else symbol
        biotype = info[13] if info and info[13] else ("protein_coding" if row[6] != row[7] else "non_coding")
        ncbi_id = info[6] if info and info[6] else row[1]
        start, end = int(row[4]) + 1, int(row[5])
        if key not in loci:
            loci[key] = [f"refseq:{ncbi_id}:{chromosome}", symbol, name or symbol, chromosome, start, end, strand, biotype]
        else:
            locus = loci[key]
            locus[4] = min(locus[4], start)
            locus[5] = max(locus[5], end)
            if biotype == "protein_coding":
                locus[7] = biotype
rows = sorted(loci.values(), key=lambda row: (chromosomes.index(row[3]), row[4], row[1]))
(root / "gene-index.json").write_text(json.dumps(rows, separators=(",", ":")) + "\n")
landmarks = set("MTHFR PCSK9 MUTYH LMNA F5 CFH APOB MSH2 MSH6 SCN2A TTN BARD1 VHL MLH1 SCN5A CCR5 PIK3CA HTT FGFR3 KIT SNCA APC SMN1 TERT SLC6A4 HFE HLA-A HLA-B HLA-C VEGFA CFTR FOXP2 BRAF EGFR MYC WRN NBN CDKN2A TSC1 ABO PTEN RET CYP2C19 CYP2D6 INS HBB KCNQ1 ATM FTO PAH KRAS BRCA2 RB1 FLT3 GJB2 SERPINA1 PSEN1 AKT1 FBN1 HEXA OCA2 UBE3A MC1R PKD1 PALB2 TSC2 BRCA1 TP53 MAPT NF1 ERBB2 SMAD4 TCF4 BCL2 APOE LDLR STK11 NOTCH3 PRNP JAG1 GNAS APP SOD1 TMPRSS2 COMT CHEK2 SHANK3 DMD F8 F9 MECP2 SRY DAZ1 ND1 COX1 CYTB".split())
selected = [r for r in rows if r[1] in landmarks]
(root / "landmark-genes.json").write_text(json.dumps(selected, separators=(",", ":")) + "\n")
summary = {
    "assembly": "GRCh38", "track": "ncbiRefSeqCurated", "source": "NCBI RefSeq via UCSC hg38",
    "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceLastModified": source_modified or "unrecorded",
    "coordinates": "1-based inclusive; gene bounds are the union of curated transcript bounds on the same chromosome and strand",
    "scope": "Chromosomes 1-22, X, Y and MT. Curated RefSeq annotated loci, not all predicted genes or alternate contigs.",
    "totalGenes": len(rows), "genesByChromosome": dict(collections.Counter(r[3] for r in rows)),
    "sources": source_urls,
    "sha256": {curated.name: hashlib.sha256(curated.read_bytes()).hexdigest(), links.name: hashlib.sha256(links.read_bytes()).hexdigest()},
}
(root / "index-metadata.json").write_text(json.dumps(summary, indent=2) + "\n")
print(f"Wrote {len(rows):,} curated loci, {len(selected)} landmarks across {len(summary['genesByChromosome'])} chromosomes.")

if scratch:
    scratch.cleanup()
