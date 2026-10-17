import "server-only";

export interface PubmedPaper {
  pmid: string;
  title: string;
  published: string;
  journal: string;
  abstract: string;
  url: string;
}

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
let nextRequestAt = 0;

/** Keep this endpoint's NCBI traffic below the unauthenticated 3 requests/s limit. */
async function ncbiRequest(
  endpoint: string,
  parameters: Record<string, string>,
  signal: AbortSignal
): Promise<Response> {
  const scheduledAt = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = scheduledAt + 360;
  const wait = scheduledAt - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  signal.throwIfAborted();

  const query = new URLSearchParams({ ...parameters, tool: "thread_of_life" });
  const response = await fetch(`${EUTILS}/${endpoint}.fcgi?${query}`, {
    signal,
    next: { revalidate: 86400 },
    headers: { Accept: endpoint === "efetch" ? "application/xml" : "application/json" },
  });
  if (!response.ok) throw new Error(`PubMed returned ${response.status}`);
  return response;
}

function plainText(xml: string): string {
  return xml
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, entity: string) => {
      const code = entity.startsWith("x") || entity.startsWith("X")
        ? parseInt(entity.slice(1), 16)
        : Number(entity);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string): string {
  return xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`))?.[1] ?? "";
}

/** Parse only returned PubMed article records; no XML entities are executed. */
export function parsePubmedArticles(xml: string, requestedIds: string[]): PubmedPaper[] {
  const requested = new Set(requestedIds);
  const articles = [...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)];
  return articles.flatMap((match) => {
    const record = match[1];
    const pmid = plainText(tag(record, "PMID"));
    const title = plainText(tag(record, "ArticleTitle"));
    if (!requested.has(pmid) || !title) return [];
    const journalXml = tag(record, "Journal");
    const publication = tag(journalXml, "PubDate");
    // Prefer the electronic publication year: future print issues can already be online.
    const published = plainText(tag(tag(record, "ArticleDate"), "Year") || tag(publication, "Year") || tag(publication, "MedlineDate"));
    const abstract = [...tag(record, "Abstract").matchAll(/<AbstractText(?:\s[^>]*)?>([\s\S]*?)<\/AbstractText>/g)]
      .map((part) => plainText(part[1]))
      .join(" ")
      .slice(0, 3600);
    return [{
      pmid,
      title: title.slice(0, 650),
      published,
      journal: plainText(tag(journalXml, "Title")).slice(0, 200),
      abstract,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    }];
  });
}

/** A bounded selection of early discovery papers and recent literature, not a systematic review. */
export async function fetchPubmedHistory(gene: string): Promise<PubmedPaper[]> {
  const signal = AbortSignal.timeout(12_000);
  const year = new Date().getUTCFullYear();
  const subject = `"${gene}"[Title/Abstract]`;
  const searches = [
    {
      term: `"${gene}"[Title] AND (cloning[Title] OR identification[Title] OR discovery[Title] OR candidate[Title] OR isolation[Title] OR mapping[Title]) AND ("1900"[Date - Publication] : "2005"[Date - Publication])`,
      sort: "relevance",
      retmax: "2",
    },
    {
      term: `${subject} AND ("${year - 5}"[Date - Publication] : "${year}"[Date - Publication])`,
      sort: "pub_date",
      retmax: "3",
    },
  ];

  const outcomes = await Promise.allSettled(searches.map(async (search) => {
    const response = await ncbiRequest("esearch", {
      db: "pubmed", retmode: "json", ...search,
    }, signal);
    const data: { esearchresult?: { idlist?: string[] } } = await response.json();
    return (data.esearchresult?.idlist ?? []).filter((id) => /^\d+$/.test(id));
  }));
  const ids = [...new Set(outcomes.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  ))].slice(0, 5);
  if (!ids.length || signal.aborted) return [];

  try {
    const response = await ncbiRequest("efetch", {
      db: "pubmed", id: ids.join(","), retmode: "xml", rettype: "abstract",
    }, signal);
    return parsePubmedArticles(await response.text(), ids);
  } catch {
    return [];
  }
}
