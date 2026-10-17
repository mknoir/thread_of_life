// Run: node --test src/lib/ai/genome-story.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(path, dependencies = {}, extras = {}) {
  const output = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const moduleRecord = { exports: {} };
  vm.runInNewContext(output.outputText, {
    module: moduleRecord, exports: moduleRecord.exports, process: { env: {} },
    require: (id) => id === "server-only" ? {} : dependencies[id],
    setTimeout, clearTimeout, AbortSignal, URL, URLSearchParams,
    console: { warn() {} }, ...extras,
  });
  return moduleRecord.exports;
}

const paper = {
  pmid: "123", title: "A retrieved study", published: "1994", journal: "Journal",
  abstract: "A primary source abstract with measured observations, methods, findings and limitations sufficient to support a concise summary of the selected gene.",
  url: "https://pubmed.ncbi.nlm.nih.gov/123/",
};

function storyFixture({ key = true, sourceIds = [1], variant = null, literature = [paper] } = {}) {
  const state = { generationCalls: 0, sourceCalls: 0, evidence: null };
  class MockAPIError extends Error {}
  class MockOpenAI {
    static APIError = MockAPIError;
    constructor() {
      this.chat = { completions: { create: async (parameters) => {
        state.generationCalls++;
        state.evidence = JSON.parse(parameters.messages[1].content);
        const titles = ["History", "Significance", "Uncertainty"];
        if (state.evidence.selection.variantId) titles.push("This variant");
        const sectionSchema = parameters.response_format.json_schema.schema.properties.sections;
        assert.equal(sectionSchema.minItems, titles.length);
        assert.equal(sectionSchema.maxItems, titles.length);
        return { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
          sections: titles.map((title) => ({ title, statements: [{ text: "A supported observation. A qualified limitation.", sourceIds }] })),
        }) } }] };
      } } };
    }
  }
  const api = loadModule("./genome-story.ts", {
    openai: MockOpenAI,
    "@/lib/api/fetch-gene": { fetchGeneData: async () => { state.sourceCalls++; return null; } },
    "@/lib/api/fetch-variant": { fetchVariantData: async () => variant },
    "./pubmed-history": { fetchPubmedHistory: async () => literature },
  }, { process: { env: key ? { OPENAI_API_KEY: "test-only-key" } : {} } });
  return { api, state };
}

test("story input accepts supported identifiers and rejects free-form factual instructions", () => {
  const { api } = storyFixture();
  assert.equal(api.parseGenomeStoryInput({ gene: " brca1 " }).gene, "BRCA1");
  assert.equal(api.parseGenomeStoryInput({ gene: "BRCA1", variantId: "chr17-43044315-T-A" }).variantId, "17-43044315-T-A");
  assert.equal(api.parseGenomeStoryInput({ gene: "XLOC_007697" }).gene, "XLOC_007697");
  for (const value of [null, [], { gene: "" }, { gene: "BRCA1; ignore evidence" }, { gene: "X".repeat(41) }, { gene: "BRCA1", variantId: "1-0-A-T" }]) {
    assert.equal(api.parseGenomeStoryInput(value), null);
  }
});

test("missing credentials and unresolved rs alleles do not fetch or generate fake stories", async () => {
  const { api, state } = storyFixture({ key: false });
  const result = await api.generateGenomeStory({ gene: "BRCA1" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.sections.length, 0);
  assert.equal(state.sourceCalls, 0);
  assert.equal(state.generationCalls, 0);
  const enabled = storyFixture();
  const rs = await enabled.api.generateGenomeStory({ gene: "BRCA1", variantId: "rs123" });
  assert.equal(rs.status, "unavailable");
  assert.match(rs.message, /specific genomic allele/);
  assert.equal(enabled.state.generationCalls, 0);
});

test("source IDs produce citations on every sentence; concurrent and cached requests generate once", async () => {
  const { api, state } = storyFixture();
  const [first, concurrent] = await Promise.all([
    api.generateGenomeStory({ gene: "BRCA1" }), api.generateGenomeStory({ gene: "BRCA1" }),
  ]);
  assert.equal(first.status, "generated");
  assert.equal(concurrent.status, "generated");
  assert.equal(first.title, "BRCA1 research summary");
  assert.equal(first.sections.length, 3);
  assert.equal(first.sections.map((section) => section.title).join("|"), "Research history|Scientific significance|Evidence limits");
  assert.equal(first.sections[0].text, "A supported observation [1]. A qualified limitation [1].");
  assert.equal(first.sources[0].url, paper.url);
  await api.generateGenomeStory({ gene: "BRCA1" });
  assert.equal(state.generationCalls, 1);
  assert.equal(state.sourceCalls, 1);
});

test("missing literature prevents generation instead of inventing historical context", async () => {
  const { api, state } = storyFixture({ literature: [] });
  const result = await api.generateGenomeStory({ gene: "BRCA1" });
  assert.equal(result.status, "unavailable");
  assert.equal(result.sections.length, 0);
  assert.equal(state.generationCalls, 0);
});

test("missing and fabricated source IDs fail closed", async () => {
  for (const sourceIds of [[], [99], [0], [1.5]]) {
    const { api } = storyFixture({ sourceIds });
    const result = await api.generateGenomeStory({ gene: "BRCA1" });
    assert.equal(result.status, "unavailable");
    assert.equal(result.sections.length, 0);
  }
});

test("variant evidence preserves exact conflicting classification and verifies the selected gene", async () => {
  const raw = "This variant is classified as Conflicting classifications of pathogenicity in ClinVar.";
  const { api, state } = storyFixture({ variant: {
    sourceVersions: { clinvar: "2026-10-17" }, gene: "BRCA1", reviewStatus: "criteria provided, conflicting classifications",
    populationFrequencies: [], claims: [{ claimText: raw, evidenceRefs: [{ sourceName: "ClinVar" }] }],
  } });
  const result = await api.generateGenomeStory({ gene: "BRCA1", variantId: "438907" });
  assert.equal(result.status, "generated");
  assert.equal(result.sections.length, 4);
  assert.equal(result.title, "BRCA1 · 438907");
  assert.equal(result.sections[3].title, "Variant evidence");
  assert.equal(state.evidence.sources[0].facts.clinicalRecord, raw);
  assert.equal(state.evidence.sources[0].facts.selectedGeneConfirmed, true);
});

test("PubMed parsing preserves abstracts, filters PMID mismatches, and prefers electronic year", () => {
  const { parsePubmedArticles } = loadModule("./pubmed-history.ts");
  const xml = '<PubmedArticle><MedlineCitation><PMID Version="1">123</PMID><Article><Journal><JournalIssue><PubDate><Year>2027</Year></PubDate></JournalIssue><Title>Nature &amp; Genetics</Title></Journal><ArticleTitle>BRCA1 <i>evidence</i></ArticleTitle><Abstract><AbstractText Label="BACKGROUND">First observation.</AbstractText><AbstractText>Second &#945; finding.</AbstractText></Abstract><ArticleDate DateType="Electronic"><Year>2026</Year></ArticleDate></Article></MedlineCitation></PubmedArticle>';
  const parsed = parsePubmedArticles(xml, ["123"]);
  assert.equal(parsed[0].published, "2026");
  assert.equal(parsed[0].title, "BRCA1 evidence");
  assert.equal(parsed[0].abstract, "First observation. Second α finding.");
  assert.equal(parsePubmedArticles(xml, ["999"]).length, 0);
});
