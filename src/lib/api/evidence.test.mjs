// Run: node --test src/lib/api/evidence.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const loadTypeScript = createRequire(import.meta.url);
loadTypeScript.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8").replace(/^import "server-only";\s*/m, "");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};
const { fetchClinvarGene, fetchClinvarVariant, fetchClinvarVariantEvidence } = loadTypeScript("./clinvar.ts");
const { fetchGnomadVariantEvidence } = loadTypeScript("./gnomad.ts");
const { parseVariantRequest } = loadTypeScript("./variant-identifiers.ts");
const { composeVariantSummary } = loadTypeScript("./compose-variant.ts");
const { fetchGtexExpression } = loadTypeScript("./gtex.ts");

function summaryPayload(classification, legacy = false) {
  return {
    result: {
      uids: ["438907"],
      "438907": {
        uid: "438907",
        title: "NM_007294.4(BRCA1):c.*1363A>T",
        genes: [{ symbol: "BRCA1" }],
        variation_set: [{ variation_loc: [{ assembly_name: "GRCh38", chr: "17", start: "43044315" }] }],
        [legacy ? "clinical_significance" : "germline_classification"]: classification,
      },
    },
  };
}

test("a verified ClinVar zero stays zero and needs no category requests", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    calls += 1;
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ esearchresult: { count: "0" } });
  });
  assert.deepEqual(await fetchClinvarGene("NO_RECORDS"), {
    totalVariants: 0, pathogenic: 0, likelyPathogenic: 0, vus: 0,
    benign: 0, likelyBenign: 0, conflicting: 0,
  });
  assert.equal(calls, 1);
});

test("a failed category invalidates the whole breakdown instead of inventing a zero", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async (url) => {
    if (decodeURIComponent(String(url)).includes("clinsig vus")) return new Response("Rate limited", { status: 429 });
    return Response.json({ esearchresult: { count: "12" } });
  });
  assert.equal(await fetchClinvarGene("BRCA1"), null);
});

test("missing or malformed successful count responses remain unavailable", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const count of [undefined, "", "NaN", "12 variants", -1]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ esearchresult: { count } }));
    assert.equal(await fetchClinvarGene("BRCA1"), null);
    mock.mock.restore();
  }
});

test("valid category zeros survive alongside nonzero counts", async (t) => {
  const signals = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    signals.push(options.signal);
    const term = new URL(url).searchParams.get("term");
    if (term.includes(" AND ")) assert.match(term, /"clinsig [a-z ]+"\[Properties\]$/);
    return Response.json({ esearchresult: { count: term.includes(" AND ") ? "0" : "12" } });
  });
  const result = await fetchClinvarGene("BRCA1");
  assert.equal(result.totalVariants, 12);
  assert.equal(result.vus, 0);
  assert.equal(result.pathogenic, 0);
  assert.equal(new Set(signals).size, 1, "one deadline bounds the whole category workflow");
});

test("current ClinVar germline payload preserves raw classification and exact locus", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(summaryPayload({
    description: "Conflicting classifications of pathogenicity", review_status: "criteria provided, conflicting classifications",
  })));
  const result = await composeVariantSummary("438907");
  assert.equal(result.clinicalSignificance, "Conflicting classifications");
  assert.equal(result.reviewStatus, "criteria provided, conflicting classifications");
  assert.equal(result.gene, "BRCA1");
  assert.equal(result.position, 43044315);
  assert.equal(result.chromosome, "17");
  assert.match(result.claims[0].evidenceRefs[0].excerpt, /Conflicting classifications of pathogenicity/);
});

test("legacy classification works while mixed labels remain available verbatim", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(summaryPayload({
    description: "Pathogenic/Likely pathogenic", review_status: "reviewed by expert panel",
  }, true)));
  const result = await composeVariantSummary("438907");
  assert.match(result.claims[0].claimText, /Pathogenic\/Likely pathogenic/);
  assert.equal(result.reviewStatus, "reviewed by expert panel");
});

test("non-ClinVar IDs never reach ESummary and mismatched returned IDs are rejected", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(summaryPayload({ description: "Benign" })));
  assert.equal(await fetchClinvarVariant("17-43044315-T-A"), null);
  assert.equal(await fetchClinvarVariant("rs1332532415"), null);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(await fetchClinvarVariant("123"), null);
});

test("GTEx version fallback shares one bounded workflow deadline", async (t) => {
  const signals = [];
  let expressionCalls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    signals.push(options.signal);
    if (String(url).includes("/reference/gene?")) return Response.json({ data: [{ geneSymbol: "BRCA1", gencodeId: "ENSG00000012048.26" }] });
    expressionCalls += 1;
    return Response.json({ data: expressionCalls === 1 ? [] : [{ tissueSiteDetailId: "Breast_Mammary_Tissue", median: 0 }] });
  });
  const result = await fetchGtexExpression("BRCA1");
  assert.equal(result[0].tpm, 0, "verified zero expression is not missing");
  assert.equal(expressionCalls, 2);
  assert.ok(signals.every((signal) => signal instanceof AbortSignal));
  assert.equal(new Set(signals).size, 1);
});

test("identifier namespaces and chromosome bounds are validated before any fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected fetch"); });
  for (const id of ["rs913767520", "9-0-A-G", "9-999999999-A-G", "9-10-A-A", "23-10-A-G", "garbage", "9-10--G"]) {
    assert.equal(parseVariantRequest(id), null);
    await assert.rejects(composeVariantSummary(id), /numeric ClinVar/);
  }
  assert.equal(parseVariantRequest("rs913767520", "9-94955251-A-G"), null);
  assert.equal(parseVariantRequest("9-94955251-A-G", "9-94955251-A-T"), null);
  assert.equal((await fetchGnomadVariantEvidence("3127400")).status, "not_applicable");
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(parseVariantRequest("003127400", "chr9-94955251-a-g").coordinate.id, "9-94955251-A-G");
});

test("ClinVar retries a rate limit and retains a genuine upstream failure", async (t) => {
  let calls = 0;
  const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.cache, "no-store", "do not cache JSON error responses as source evidence");
    return ++calls === 1 ? new Response("rate limited", { status: 429 }) : Response.json(summaryPayload({ description: "Benign" }));
  });
  assert.equal((await fetchClinvarVariantEvidence("438907")).status, "available");
  assert.equal(calls, 2);
  fetch.mock.restore();
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "NCBI service failure" }));
  const failed = await fetchClinvarVariantEvidence("438907");
  assert.equal(failed.status, "unavailable");
  assert.match(failed.message, /NCBI service failure/);
  assert.equal(failed.data, null);
});

function frequencyPayload(id, exome = [], genome = []) {
  return { data: { variant: { variant_id: id, exome: { populations: exome }, genome: { populations: genome } } } };
}

test("empty exomes fall back to genomes; ancestry groups and measured zeros are retained", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.cache, "no-store");
    return Response.json(frequencyPayload("9-94955251-A-G", [], [
      { id: "remaining", ac: 0, an: 80 }, { id: "mid", ac: 2, an: 100, homozygote_count: 1 },
      { id: "nfe_XX", ac: 1, an: 40 }, { id: "afr", ac: null, an: 10 }, { id: "eas", ac: 0, an: 0 },
    ]));
  });
  const result = await fetchGnomadVariantEvidence("9-94955251-A-G");
  assert.equal(result.status, "available");
  assert.equal(result.dataset, "genomes");
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].alleleFrequency, 0);
  assert.equal(result.data[0].homozygoteCount, null, "missing counts are not invented zeros");
  assert.equal(result.data[1].alleleFrequency, 0.02);
});

test("gnomAD distinguishes absent alleles, GraphQL outages and mismatched records", async (t) => {
  for (const [payload, status] of [
    [{ errors: [{ message: "Variant not found" }] }, "not_found"],
    [{ errors: [{ message: "Query rate limit exceeded" }] }, "unavailable"],
    [{ data: { variant: null } }, "not_found"],
    [{ data: {} }, "unavailable"],
    [frequencyPayload("9-94955251-A-T", [{ id: "nfe", ac: 1, an: 20 }]), "unavailable"],
  ]) {
    const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(payload));
    const result = await fetchGnomadVariantEvidence("9-94955251-A-G");
    assert.equal(result.status, status);
    assert.equal(result.data, null);
    fetch.mock.restore();
  }
});

test("paired ClinVar indels verify VCF anchors against genomic SPDI, not HGVS positions", async (t) => {
  const record = summaryPayload({ description: "Pathogenic" });
  record.result["438907"].variation_set[0].canonical_spdi = "NC_000017.11:43044315:A:";
  record.result["438907"].variation_set[0].variation_loc[0].start = "43044316";
  const fetched = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    fetched.push(String(url));
    if (String(url).includes("esummary")) return Response.json(record);
    const { variables } = JSON.parse(options.body);
    return Response.json(frequencyPayload(variables.variantId, [{ id: "nfe", ac: 1, an: 100 }]));
  });
  const result = await composeVariantSummary("438907", "17-43044315-TA-T");
  assert.equal(result.sourceStatus.clinvar.status, "available");
  assert.equal(result.sourceStatus.gnomad.status, "available");
  assert.equal(result.coordinateId, "17-43044315-TA-T");
  assert.equal(result.position, 43044315);
  assert.equal(result.refAllele, "TA");
  assert.equal(result.populationFrequencies.length, 1);
  assert.equal(fetched.length, 2);
  assert.match(result.claims[1].evidenceRefs[0].link, /17-43044315-TA-T/);

  fetched.length = 0;
  const mismatch = await composeVariantSummary("438907", "17-43044315-TC-T");
  assert.equal(mismatch.sourceStatus.gnomad.status, "unavailable");
  assert.match(mismatch.sourceStatus.gnomad.message, /could not be verified/);
  assert.equal(mismatch.populationFrequencies.length, 0);
  assert.equal(fetched.length, 1, "do not fetch or attach a different allele's frequencies");
});

function isolatedTypeScript(path, dependencies, env = {}) {
  const output = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const moduleRecord = { exports: {} };
  vm.runInNewContext(output.outputText, {
    module: moduleRecord, exports: moduleRecord.exports,
    require: (id) => id === "server-only" ? {} : dependencies[id],
    process: { env }, setTimeout, clearTimeout, URL, console,
  });
  return moduleRecord.exports;
}

test("a database read/write failure falls back once and preserves the composed result", async () => {
  for (const failAfterCompose of [false, true]) {
    let calls = 0;
    const expected = { variantId: "438907", sourceStatus: { clinvar: { status: "available" }, gnomad: { status: "not_applicable" } } };
    const { fetchVariantData } = isolatedTypeScript("./fetch-variant.ts", {
      "./variant-identifiers": { parseVariantRequest },
      "./compose-variant": { composeVariantSummary: async () => { calls++; return expected; } },
      "@/lib/cache": { getCachedVariantSummary: async (_id, compose) => {
        if (failAfterCompose) await compose();
        throw new Error("Database unavailable");
      } },
    }, { DATABASE_URL: "test-database" });
    assert.equal(await fetchVariantData("438907"), expected);
    assert.equal(calls, 1);
  }
});

test("variant cache rejects old empty summaries and never stores source outages", async () => {
  const stored = [];
  let selected = 0;
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => {
      selected++;
      return [{ expiresAt: new Date(Date.now() + 60000), data: { claims: [], sourceVersions: {} } }];
    } }) }) }),
    insert: () => ({ values: (row) => ({ onConflictDoUpdate: async () => { stored.push(row); } }) }),
  };
  const { getCachedVariantSummary } = isolatedTypeScript("../cache.ts", {
    "drizzle-orm": { eq: () => true }, "./db": { db },
    "./db/schema": { variantSummaries: { key: "key" } },
  });
  const unavailable = { sourceStatus: { clinvar: { status: "unavailable" }, gnomad: { status: "not_applicable" } } };
  assert.equal(await getCachedVariantSummary("438907", async () => unavailable), unavailable);
  assert.equal(stored.length, 0);
  const available = { sourceStatus: { clinvar: { status: "available" }, gnomad: { status: "not_applicable" } } };
  assert.equal(await getCachedVariantSummary("438907", async () => available, { refresh: true, coordinateId: "17-43044315-T-A" }), available);
  assert.equal(selected, 1, "explicit refresh bypasses the database read");
  assert.equal(stored.length, 1);
  assert.match(stored[0].key, /438907:17-43044315-T-A:summary:v2$/);
});

test("gene cache failures share one composition and explicit retries reach cache refresh", async () => {
  let calls = 0;
  let seenRefresh = false;
  const expected = { symbol: "AOPEP", sourceVersions: { clinvar: "2026-10-17" } };
  const { fetchGeneData } = isolatedTypeScript("./fetch-gene.ts", {
    "./compose-gene": { composeGeneSummary: async () => { calls++; return expected; } },
    "@/lib/cache": { getCachedGeneSummary: async (_symbol, compose, options) => {
      seenRefresh = options.refresh;
      await compose();
      throw new Error("Database write failed");
    } },
  }, { DATABASE_URL: "test-database" });
  assert.equal(await fetchGeneData("aopep", { refresh: true }), expected);
  assert.equal(calls, 1);
  assert.equal(seenRefresh, true);
});

test("variant route validates namespaces and forwards combined allele and refresh", async () => {
  let calls = 0;
  let forwarded;
  const { GET } = isolatedTypeScript("../../app/api/variant/[id]/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/api/variant-identifiers": { parseVariantRequest },
    "@/lib/api/fetch-variant": { fetchVariantData: async (id, options) => {
      calls++;
      forwarded = { id, ...options };
      return { variantId: id, sourceStatus: { clinvar: { status: "available" }, gnomad: { status: "unavailable", message: "Rate limited" } } };
    } },
  });
  const invalid = await GET(new Request("http://localhost/api/variant/rs913767520"), { params: Promise.resolve({ id: "rs913767520" }) });
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);
  const response = await GET(new Request("http://localhost/api/variant/3127400?coordinateId=9-94955251-A-G&refresh=1"), { params: Promise.resolve({ id: "3127400" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(JSON.stringify(forwarded), JSON.stringify({ id: "3127400", coordinateId: "9-94955251-A-G", refresh: true }));
  assert.equal((await response.json()).sourceStatus.gnomad.status, "unavailable");
});
