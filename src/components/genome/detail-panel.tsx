"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Dna, LoaderCircle, Sparkles, X } from "lucide-react";
import type { GenomeGene, GenomeRegionResponse, GenomeVariant } from "@/lib/genome/types";
import type { GeneSummary } from "@/lib/types/gene";
import type { VariantSummary } from "@/lib/types/variant";

export type GenomeSelection =
  | { type: "gene"; gene: GenomeGene }
  | { type: "variant"; variant: GenomeVariant; gene?: GenomeGene };

interface GenomeDetailPanelProps {
  selection: GenomeSelection;
  onClose: () => void;
  onSelectVariant: (variant: GenomeVariant) => void;
}

interface GeneStory {
  status: "generated" | "unavailable";
  title: string;
  sections: { title: string; text: string }[];
  sources: { label: string; url: string }[];
  message?: string;
}

interface RemoteState<T> {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error?: string;
}

function useEvidence<T>(url: string | null) {
  const [state, setState] = useState<RemoteState<T> & { url: string | null }>({
    url,
    status: url ? "loading" : "idle",
    data: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);

    async function load() {
      let requestError = "The evidence request could not connect. Try again.";
      try {
        const requestUrl = attempt > 0 ? `${url}${url!.includes("?") ? "&" : "?"}refresh=1` : url!;
        const response = await fetch(requestUrl, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          requestError = typeof data?.error === "string" ? data.error : `The evidence request failed (HTTP ${response.status}).`;
          throw new Error(requestError);
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          requestError = "The evidence source returned an incomplete response. Try again.";
          throw new Error(requestError);
        }
        if (active) setState({ url, status: "ready", data });
      } catch {
        if (active) {
          setState((previous) => ({
            url,
            status: "error",
            data: previous.url === url ? previous.data : null,
            error: timedOut
              ? "The evidence request timed out. Try again."
              : requestError,
          }));
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [url, attempt]);

  return {
    ...(state.url === url ? state : { status: url ? "loading" as const : "idle" as const, data: null, error: undefined }),
    retry: () => {
      setState((previous) => ({ url, status: "loading", data: previous.url === url ? previous.data : null }));
      setAttempt((value) => value + 1);
    },
  };
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//.test(href)) return <span className="genome-evidence-source">{children}</span>;
  return (
    <a className="genome-evidence-source" href={href} target="_blank" rel="noreferrer">
      {children}<ArrowUpRight size={12} aria-hidden="true" />
    </a>
  );
}

function EvidenceSection({ title, source, href, children }: {
  title: string;
  source: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <section className="genome-evidence-section">
      <div className="genome-evidence-heading">
        <h3>{title}</h3>
        <SourceLink href={href}>{source}</SourceLink>
      </div>
      {children}
    </section>
  );
}

function EvidenceRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="genome-evidence-row">
      <span className="genome-evidence-label">{label}</span>
      <span className="genome-evidence-value">{value}</span>
    </div>
  );
}

function EmptyEvidence({ loading = false, children }: { loading?: boolean; children?: ReactNode }) {
  return (
    <p className="genome-detail-empty">
      {loading ? "Loading source…" : children ?? "No record returned for this lookup. Open the source or refresh below."}
    </p>
  );
}

function SourceRefresh({ label, loading, error, retry, hasData }: {
  label: string;
  loading: boolean;
  error?: string;
  retry: () => void;
  hasData: boolean;
}) {
  return <div className="genome-detail-error" role={error ? "status" : undefined}>
    {error && <p>{error}{hasData ? " Loaded evidence remains shown." : ""}</p>}
    <button type="button" onClick={retry} disabled={loading}>
      {loading ? <><LoaderCircle size={12} className="genome-story-spinner" aria-hidden="true" /> Refreshing {label}</> : <>{error ? "Retry" : "Refresh"} {label} <ArrowRight size={12} aria-hidden="true" /></>}
    </button>
  </div>;
}

function getClinvarClassification(data: VariantSummary | null): string | null {
  if (!data || !(data.sourceStatus?.clinvar.status === "available" || data.sourceVersions?.clinvar)) return null;
  const raw = data.claims.flatMap((claim) => claim.evidenceRefs)
    .find((ref) => ref.sourceName === "ClinVar")?.excerpt?.match(/^Classification: (.*), Review status:/)?.[1];
  return raw === "Unknown" ? null : raw || data.clinicalSignificance;
}

function VariantAlleles({ variant, onSelectVariant }: { variant: GenomeVariant; onSelectVariant: (variant: GenomeVariant) => void }) {
  const displayAllele = (value: string | undefined) => value === undefined ? "Not selected" : value === "" ? "∅" : value;
  const selectableAlleles = variant.representation === "site" && variant.ref && /^[ACGT]+$/.test(variant.ref)
    ? (variant.alternateAlleles ?? []).filter((allele) => /^[ACGT]+$/.test(allele) && allele.length === variant.ref!.length && allele !== variant.ref)
    : [];
  return <>
    {(variant.ref !== undefined || variant.alt !== undefined || variant.alternateAlleles?.length) && <div className="genome-detail-alleles">
      <span title="Reference allele">{displayAllele(variant.ref)}</span><ArrowRight size={22} aria-label="changes to" /><span title={variant.alternateAlleles ? "Alternate alleles" : "Alternate allele"}>{variant.alternateAlleles?.map(displayAllele).join(" / ") || displayAllele(variant.alt)}</span>
    </div>}
    {variant.representation === "contextual" && <p className="genome-story-note">Source alleles include repeat context; these are not a normalized VCF allele. ∅ denotes an empty allele.{variant.rsId && <> <SourceLink href={`https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(variant.rsId)}`}>View dbSNP record</SourceLink></>}</p>}
    {selectableAlleles.length > 0 && <section className="genome-evidence-section">
      <div className="genome-evidence-heading"><h3>Select an alternate allele</h3></div>
      <div className="genome-evidence-variant-list">{selectableAlleles.map((allele) => <button className="genome-evidence-variant" type="button" key={allele} onClick={() => {
        const coordinateId = `${variant.chromosome}-${variant.position}-${variant.ref}-${allele}`;
        onSelectVariant({ ...variant, id: coordinateId, coordinateId, alt: allele, alternateAlleles: undefined, representation: "vcf", clinvarId: undefined, significance: undefined });
      }}><span><strong>{variant.ref} → {allele}</strong><small>Look up population frequency</small></span><ArrowRight size={14} aria-hidden="true" /></button>)}</div>
    </section>}
  </>;
}

function GeneEvidence({ data, loading, symbol }: { data: GeneSummary | null; loading: boolean; symbol: string }) {
  const clinvar = data?.clinvarSummary;
  const constraint = data?.constraint;
  const expressions = data?.topExpressions ?? [];
  const maxExpression = Math.max(1, ...expressions.map((entry) => entry.tpm));
  return (
    <>
      <EvidenceSection title="Clinical variation" source="ClinVar" href={`https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(`${symbol}[gene]`)}`}>
        {clinvar ? (
          <>
            <EvidenceRow label="Total submitted variant records" value={clinvar.totalVariants.toLocaleString()} />
            <div className="genome-evidence-rows">
              <EvidenceRow label="Pathogenic" value={clinvar.pathogenic.toLocaleString()} />
              <EvidenceRow label="Likely pathogenic" value={clinvar.likelyPathogenic.toLocaleString()} />
              <EvidenceRow label="Uncertain significance" value={clinvar.vus.toLocaleString()} />
              <EvidenceRow label="Likely benign / benign" value={`${clinvar.likelyBenign.toLocaleString()} / ${clinvar.benign.toLocaleString()}`} />
              <EvidenceRow label="Conflicting classifications" value={clinvar.conflicting.toLocaleString()} />
            </div>
            <p className="genome-story-note">Reported category counts may overlap. Classification depends on condition and review status.</p>
          </>
        ) : <EmptyEvidence loading={loading} />}
      </EvidenceSection>
      <EvidenceSection title="Population constraint" source="gnomAD" href={`https://gnomad.broadinstitute.org/gene/${encodeURIComponent(symbol)}?dataset=gnomad_r4`}>
        {constraint ? (
          <>
            <EvidenceRow label="Loss-of-function · LOEUF" value={constraint.loeufScore == null ? "Not available" : constraint.loeufScore.toFixed(3)} />
            <EvidenceRow label="pLI" value={constraint.pLI == null ? "Not available" : constraint.pLI.toFixed(3)} />
            <EvidenceRow label="Missense Z score" value={constraint.misZScore == null ? "Not available" : constraint.misZScore.toFixed(2)} />
            <p className="genome-story-note">Lower LOEUF suggests stronger depletion of predicted loss-of-function variation. It is a gene-level measure.</p>
          </>
        ) : <EmptyEvidence loading={loading} />}
      </EvidenceSection>
      <EvidenceSection title="Tissue expression" source="GTEx" href={`https://gtexportal.org/home/gene/${encodeURIComponent(symbol)}`}>
        {expressions.length > 0 ? (
          <div className="genome-evidence-expression">
            {expressions.slice(0, 5).map((entry) => (
              <div className="genome-evidence-expression-row" key={entry.tissue}>
                <EvidenceRow label={entry.tissue} value={`${entry.tpm.toFixed(1)} TPM`} />
                <div className="genome-evidence-bar" aria-hidden="true"><span style={{ width: `${(entry.tpm / maxExpression) * 100}%` }} /></div>
              </div>
            ))}
            <p className="genome-story-note">Median expression in sampled adult tissues; TPM = transcripts per million.</p>
          </div>
        ) : <EmptyEvidence loading={loading}>Expression data was not returned. This does not mean the gene is not expressed.</EmptyEvidence>}
      </EvidenceSection>
      <EvidenceSection title="Gene–disease evidence" source="ClinGen" href={`https://search.clinicalgenome.org/kb/genes/${encodeURIComponent(symbol)}`}>
        {data?.clingenValidity ? (
          <>
            <EvidenceRow label="Strongest returned validity" value={data.clingenValidity} />
            <p className="genome-story-note">Validity applies to individual gene–disease relationships. Open the curation for its condition and inheritance pattern.</p>
          </>
        ) : <EmptyEvidence loading={loading}>No gene–disease curation was returned.</EmptyEvidence>}
      </EvidenceSection>
    </>
  );
}

function VariantEvidence({ data, loading, variant, requested }: {
  data: VariantSummary | null;
  loading: boolean;
  variant: GenomeVariant;
  requested: boolean;
}) {
  const frequencies = data?.populationFrequencies ?? [];
  const clinvarStatus = data?.sourceStatus?.clinvar;
  const frequencyStatus = data?.sourceStatus?.gnomad;
  const hasClinvar = clinvarStatus?.status === "available" || Boolean(data?.sourceVersions?.clinvar);
  const classification = getClinvarClassification(data);
  const catalogClassification = variant.significance?.replace(/_/g, " ");
  const clinvarId = variant.clinvarId || (/^\d+$/.test(variant.id) ? variant.id : undefined);
  const coordinateId = data?.coordinateId || variant.coordinateId;
  const clinvarLink = clinvarStatus?.url || (clinvarId
    ? `https://www.ncbi.nlm.nih.gov/clinvar/variation/${clinvarId}/`
    : `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(variant.rsId || variant.id)}`);
  return (
    <>
      <EvidenceSection title="Variant classification" source="ClinVar" href={clinvarLink}>
        <div className="genome-evidence-rows">
          {clinvarId && <EvidenceRow label="Variation ID" value={clinvarId} />}
          {(classification || catalogClassification) && <EvidenceRow label={classification ? "Germline classification" : "Catalog classification"} value={classification || catalogClassification} />}
          {hasClinvar && data && <EvidenceRow label="Review status" value={data.reviewStatus} />}
        </div>
        {data && hasClinvar ? (
          <>
            {data.submissions.slice(0, 3).map((submission, index) => (
              <div className="genome-evidence-submission" key={`${submission.submitter}-${index}`}>
                <strong>{submission.condition}</strong>
                <p>{submission.classification} · {submission.submitter}</p>
              </div>
            ))}
            {!classification && <p className="genome-story-note">The live record does not include a germline classification.</p>}
            <p className="genome-story-note">Classification and review status from the live ClinVar record. Classifications apply to the reported conditions.</p>
          </>
        ) : (
          <>
            {catalogClassification && <p className="genome-story-note">Classification from {variant.source}. Live review details are loaded separately.</p>}
            {loading ? <EmptyEvidence loading /> : (
              <EmptyEvidence>{clinvarStatus?.message || (clinvarId
                ? "This ClinVar record is indexed in the catalog. Its live review details have not loaded."
                : "No ClinVar variation ID is linked to this catalog record. dbSNP registration alone is not a clinical classification.")}</EmptyEvidence>
            )}
          </>
        )}
      </EvidenceSection>
      <EvidenceSection title="Population frequency" source="gnomAD" href={frequencyStatus?.url || (coordinateId ? `https://gnomad.broadinstitute.org/variant/${encodeURIComponent(coordinateId)}?dataset=gnomad_r4` : "https://gnomad.broadinstitute.org/")}>
        {frequencies.length > 0 ? (
          <>
            {frequencies.map((entry) => (
              <EvidenceRow key={entry.population} label={entry.population} value={<span title={`${entry.alleleCount.toLocaleString()} alternate alleles / ${entry.alleleNumber.toLocaleString()} observed alleles`}>{entry.alleleFrequency === 0 ? "0 observed" : entry.alleleFrequency.toExponential(2)}</span>} />
            ))}
            <p className="genome-story-note">Allele frequency within each sampled population{frequencyStatus?.dataset ? ` · ${frequencyStatus.dataset}` : ""}. Zero observed is different from missing data.</p>
          </>
        ) : <EmptyEvidence loading={loading}>{frequencyStatus?.message || (!requested
          ? "Select a specific normalized allele to look up its population frequency."
          : "Population frequencies have not loaded for this allele.")}</EmptyEvidence>}
      </EvidenceSection>
    </>
  );
}

export function GenomeDetailPanel(props: GenomeDetailPanelProps) {
  const key = props.selection.type === "gene" ? props.selection.gene.id : props.selection.variant.coordinateId || `${props.selection.variant.id}-${props.selection.variant.chromosome}-${props.selection.variant.position}`;
  return <DetailPanelContents key={`${props.selection.type}-${key}-${props.selection.gene?.id ?? ""}`} {...props} />;
}

function StoryText({ text, sources }: { text: string; sources: GeneStory["sources"] }) {
  return <>{text.split(/(\[\d+\])/g).map((part, index) => {
    const match = /^\[(\d+)\]$/.exec(part);
    const source = match ? sources[Number(match[1]) - 1] : null;
    return source && /^https?:\/\//.test(source.url)
      ? <a className="genome-story-citation" href={source.url} target="_blank" rel="noreferrer" key={index}>{part}</a>
      : part;
  })}</>;
}

function DetailPanelContents({ selection, onClose, onSelectVariant }: GenomeDetailPanelProps) {
  const gene = selection.gene;
  const variant = selection.type === "variant" ? selection.variant : null;
  const chromosome = variant?.chromosome || gene?.chromosome || "";
  const start = variant?.position ?? gene?.start ?? 0;
  const end = variant ? variant.end ?? variant.position + Math.max(1, variant.ref?.length ?? 1) - 1 : gene?.end ?? start;
  const coordinateId = variant?.coordinateId;
  const variantId = variant?.clinvarId || coordinateId || (variant && /^\d+$/.test(variant.id) ? variant.id : undefined);
  const variantUrl = variantId ? `/api/variant/${encodeURIComponent(variantId)}${coordinateId && coordinateId !== variantId ? `?coordinateId=${encodeURIComponent(coordinateId)}` : ""}` : null;
  const variantEvidence = useEvidence<VariantSummary>(variantUrl);
  const reportedSymbols = (variant?.gene || variantEvidence.data?.gene || "").split(/[,;]/).map((value) => value.trim()).filter(Boolean);
  const symbol = gene?.symbol || (reportedSymbols.length === 1 ? reportedSymbols[0] : "");
  const storyVariantId = variant?.clinvarId || coordinateId || variant?.id;
  const geneEvidence = useEvidence<GeneSummary>(symbol ? `/api/gene/${encodeURIComponent(symbol)}` : null);
  const regionUrl = selection.type === "gene" && gene && gene.end - gene.start < 500000
    ? `/api/genome/region?chromosome=${encodeURIComponent(gene.chromosome)}&start=${gene.start}&end=${gene.end}`
    : null;
  const nearby = useEvidence<GenomeRegionResponse>(regionUrl);
  const [nearbyLimit, setNearbyLimit] = useState(4);
  const [tab, setTab] = useState<"overview" | "evidence" | "story">("overview");
  const [story, setStory] = useState<GeneStory | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const storyController = useRef<AbortController | null>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const titleElement = useRef<HTMLHeadingElement | null>(null);
  const title = variant ? variant.rsId || (variant.clinvarId ? `ClinVar ${variant.clinvarId}` : variant.id) : gene?.symbol;
  const subtitle = variant
    ? `${symbol ? `${symbol} · ` : ""}${variant.consequence?.replace(/_/g, " ") || "Genomic variant"}`
    : gene?.name && gene.name !== gene.symbol ? gene.name : "Human gene";
  const loading = geneEvidence.status === "loading" || variantEvidence.status === "loading";
  const variantSourcesToRetry = Object.entries(variantEvidence.data?.sourceStatus ?? {}).filter(([, value]) => value.status === "unavailable").map(([name]) => name === "clinvar" ? "ClinVar" : "gnomAD");
  const variantError = variantEvidence.error || (variantSourcesToRetry.length ? `${variantSourcesToRetry.join(" and ")} did not respond successfully.` : undefined);
  const geneHasEvidence = Boolean(geneEvidence.data?.clinvarSummary || geneEvidence.data?.constraint || geneEvidence.data?.clingenValidity || geneEvidence.data?.topExpressions.length);
  const variantHasEvidence = Boolean(variantEvidence.data?.sourceVersions?.clinvar || variantEvidence.data?.populationFrequencies.length);
  const classification = getClinvarClassification(variantEvidence.data) || variant?.significance?.replace(/_/g, " ");

  useEffect(() => {
    titleElement.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => () => {
    const controller = storyController.current;
    storyController.current = null;
    controller?.abort();
  }, []);

  async function tellMeMore() {
    setTab("story");
    // The action is removed when Summary opens; keep keyboard focus in the panel.
    tabButtons.current[2]?.focus({ preventScroll: true });
    if (!symbol || storyLoading || story?.status === "generated") return;
    storyController.current?.abort();
    const controller = new AbortController();
    storyController.current = controller;
    setStoryLoading(true);
    setStory(null);
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/genome/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gene: symbol, ...(storyVariantId ? { variantId: storyVariantId } : {}) }),
        signal: controller.signal,
      });
      const result = await response.json() as GeneStory & { error?: string };
      if (!response.ok && result.error) {
        if (storyController.current === controller) setStory({ status: "unavailable", title: "Summary unavailable", sections: [], sources: [], message: result.error });
        return;
      }
      if (!result.status || !Array.isArray(result.sections) || !Array.isArray(result.sources)) throw new Error("Invalid story response");
      if (storyController.current === controller) setStory(result);
    } catch {
      if (storyController.current === controller) setStory({
        status: "unavailable",
        title: "Summary unavailable",
        sections: [],
        sources: [],
        message: "The summary could not be generated. Try again or review the evidence.",
      });
    } finally {
      window.clearTimeout(timeout);
      if (storyController.current === controller) setStoryLoading(false);
    }
  }

  return (
    <aside className="genome-detail-panel" aria-labelledby="genome-detail-heading" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      // Reading details or switching tabs must not also pan or zoom the genome.
      if (["ArrowLeft", "ArrowRight", "+", "-", "="].includes(event.key)) event.stopPropagation();
    }}>
      <div className="genome-detail-header">
        <div className="genome-detail-kicker"><Dna size={14} aria-hidden="true" /> {variant ? "VARIANT" : "GENE"} <span>·</span> GRCh38</div>
        <button className="genome-detail-close" type="button" onClick={onClose} aria-label="Close details"><X size={18} /></button>
        <h2 id="genome-detail-heading" ref={titleElement} tabIndex={-1} className={`genome-detail-title${variant ? " genome-detail-title-variant" : ""}`}>{title}</h2>
        <p className="genome-detail-subtitle">{subtitle}</p>
        <div className="genome-detail-locus">chr{chromosome}:{start.toLocaleString()}{end !== start ? `–${end.toLocaleString()}` : ""}</div>
      </div>

      <div className="genome-detail-tabs" role="tablist" aria-label="Selected locus information">
        {(["overview", "evidence", "story"] as const).map((value, index, values) => (
          <button
            className={`genome-detail-tab${tab === value ? " is-active" : ""}`}
            type="button"
            role="tab"
            id={`genome-detail-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="genome-detail-content"
            tabIndex={tab === value ? 0 : -1}
            key={value}
            ref={(element) => { tabButtons.current[index] = element; }}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
              if (next >= 0) {
                event.preventDefault();
                event.stopPropagation();
                setTab(values[next]);
                tabButtons.current[next]?.focus();
              }
            }}
          >{value === "story" && <Sparkles size={12} aria-hidden="true" />}{value === "story" ? "Summary" : value[0].toUpperCase() + value.slice(1)}</button>
        ))}
      </div>

      <div className="genome-detail-body" role="tabpanel" id="genome-detail-content" aria-labelledby={`genome-detail-tab-${tab}`} tabIndex={0}>
        {tab === "overview" && (
          <>
            {variant ? (
              <>
                <VariantAlleles variant={variant} onSelectVariant={onSelectVariant} />
                <p className="genome-detail-description">{variant.consequence ? `${variant.consequence.replace(/_/g, " ")}. ` : ""}{symbol ? `Located in the ${symbol} region.` : "A variant mapped to the human reference genome."}</p>
                <div className="genome-detail-stats">
                  <div className="genome-detail-stat"><span>{getClinvarClassification(variantEvidence.data) ? "Live ClinVar classification" : "Catalog classification"}</span><strong>{classification || "No classification in this record"}</strong></div>
                  <div className="genome-detail-stat"><span>Source</span><strong>{variant.source}</strong></div>
                </div>
                <div className="genome-evidence-rows">
                  {variant.rsId && <EvidenceRow label="dbSNP" value={<SourceLink href={`https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(variant.rsId)}`}>{variant.rsId}</SourceLink>} />}
                  {variant.clinvarId && <EvidenceRow label="ClinVar" value={<SourceLink href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${encodeURIComponent(variant.clinvarId)}/`}>{variant.clinvarId}</SourceLink>} />}
                  {(coordinateId || variantEvidence.data?.coordinateId) && <EvidenceRow label="GRCh38 allele" value={coordinateId || variantEvidence.data?.coordinateId} />}
                </div>
                {variantEvidence.status === "loading" && <p className="genome-detail-status" role="status"><LoaderCircle size={12} className="genome-story-spinner" aria-hidden="true" /> Loading variant evidence</p>}
                {variantHasEvidence && <button className="genome-evidence-variant" type="button" onClick={() => { setTab("evidence"); tabButtons.current[1]?.focus({ preventScroll: true }); }}><span>View loaded evidence</span><ArrowRight size={14} aria-hidden="true" /></button>}
                <p className="genome-story-note">Annotation is source-specific; review the underlying condition and evidence before interpreting a variant.</p>
              </>
            ) : gene && (
              <>
                <p className="genome-detail-description">{gene.biotype ? gene.biotype.replace(/_/g, " ") : "Gene"} on chromosome {gene.chromosome}, spanning {(gene.end - gene.start + 1).toLocaleString()} base pairs.</p>
                <div className="genome-detail-stats">
                  <div className="genome-detail-stat"><span>Gene length</span><strong>{(gene.end - gene.start + 1).toLocaleString()}<small> bp</small></strong></div>
                  <div className="genome-detail-stat"><span>Strand</span><strong>{gene.strand === 1 ? "Forward +" : "Reverse −"}</strong></div>
                  <div className="genome-detail-stat"><span>ClinVar records</span><strong>{geneEvidence.data?.clinvarSummary?.totalVariants.toLocaleString() ?? "—"}</strong></div>
                  <div className="genome-detail-stat"><span>Constraint · LOEUF</span><strong>{geneEvidence.data?.constraint?.loeufScore?.toFixed(3) ?? "—"}</strong></div>
                </div>
                {geneEvidence.status === "loading" && <p className="genome-detail-status" role="status"><LoaderCircle size={12} className="genome-story-spinner" aria-hidden="true" /> Loading evidence</p>}
              </>
            )}


            {selection.type === "gene" && (
              <section className="genome-evidence-section">
                <div className="genome-evidence-heading"><h3>Variants at this locus</h3><span className="genome-detail-kicker">CATALOG RECORDS</span></div>
                {nearby.status === "loading" ? <EmptyEvidence loading /> : nearby.data?.variants.length ? (
                  <>
                    <div className="genome-evidence-variant-list">
                      {nearby.data.variants.slice(0, nearbyLimit).map((item) => (
                        <button className="genome-evidence-variant" type="button" key={item.coordinateId || `${item.id}-${item.position}`} onClick={() => onSelectVariant(item)}>
                          <span><strong>{item.rsId || (item.ref && item.alt ? `${item.ref} → ${item.alt}` : `Variant ${item.id}`)}</strong><small>{item.significance?.replace(/_/g, " ") || `chr${item.chromosome}:${item.position.toLocaleString()}`}</small></span><ArrowUpRight size={15} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <p className="genome-story-note">{Math.min(nearbyLimit, nearby.data.variants.length).toLocaleString()} of {nearby.data.variants.length.toLocaleString()} loaded records shown.{nearby.data.variantSources?.some((source) => source.truncated) ? " The source response is capped." : ""}</p>
                    {nearbyLimit < nearby.data.variants.length && <button className="genome-evidence-variant" type="button" onClick={() => setNearbyLimit((limit) => limit + 20)}><span>Show {Math.min(20, nearby.data.variants.length - nearbyLimit)} more</span><ArrowRight size={14} aria-hidden="true" /></button>}
                  </>
                ) : <EmptyEvidence>{regionUrl ? "No variant records have loaded for this region." : "Zoom into this gene to load variants in a smaller region."}</EmptyEvidence>}
                {(nearby.error || nearby.data?.variantSources?.some((source) => source.status === "unavailable")) && <SourceRefresh label="regional variants" loading={nearby.status === "loading"} error={nearby.error || "A regional variant source did not respond successfully."} retry={nearby.retry} hasData={Boolean(nearby.data?.variants.length)} />}
              </section>
            )}
          </>
        )}

        {tab === "evidence" && (
          <>
            {loading && <p className="genome-detail-status" role="status"><LoaderCircle size={13} className="genome-story-spinner" aria-hidden="true" /> Loading datasets…</p>}
            {variant && !variantUrl && <VariantAlleles variant={variant} onSelectVariant={onSelectVariant} />}
            {variant && <VariantEvidence data={variantEvidence.data} loading={variantEvidence.status === "loading"} variant={variant} requested={Boolean(variantUrl)} />}
            {variantUrl && <SourceRefresh label="variant sources" loading={variantEvidence.status === "loading"} error={variantError} retry={variantEvidence.retry} hasData={variantHasEvidence} />}
            {symbol && <><div className="genome-detail-kicker genome-evidence-gene-label">{variant ? `${symbol} · GENE EVIDENCE` : "GENE EVIDENCE"}</div><GeneEvidence data={geneEvidence.data} loading={geneEvidence.status === "loading"} symbol={symbol} /></>}
            {symbol && <SourceRefresh label="gene sources" loading={geneEvidence.status === "loading"} error={geneEvidence.error} retry={geneEvidence.retry} hasData={geneHasEvidence} />}
            <p className="genome-story-note">Research context, not a diagnosis. A gene-level association alone does not establish the effect of an individual variant.</p>
          </>
        )}

        {tab === "story" && (
          <div className="genome-story-content" aria-live="polite">
            {storyLoading ? (
              <div className="genome-story-loading" role="status"><LoaderCircle size={27} className="genome-story-spinner" aria-hidden="true" /><h3>Generating summary</h3><p>Reviewing research on {symbol}{variant ? " and this variant" : ""}.</p></div>
            ) : story?.status === "generated" ? (
              <>
                <div className="genome-detail-kicker"><Sparkles size={12} aria-hidden="true" /> AI-GENERATED SUMMARY</div>
                <h3 className="genome-story-title">{story.title}</h3>
                {story.sections.map((section, index) => <section className="genome-story-section" key={index}><h4>{section.title}</h4>{section.text.split(/\n+/).filter(Boolean).map((paragraph, paragraphIndex) => <p key={paragraphIndex}><StoryText text={paragraph} sources={story.sources} /></p>)}</section>)}
                <section className="genome-story-sources"><h4><BookOpen size={14} aria-hidden="true" /> Sources</h4><ol>{story.sources.map((source, index) => <li key={`${source.url}-${index}`}><SourceLink href={source.url}>{source.label}</SourceLink></li>)}</ol></section>
                <p className="genome-story-note">AI summaries may contain errors. Verify claims against the linked sources.</p>
              </>
            ) : (
              <div className="genome-story-intro">
                <Sparkles size={26} aria-hidden="true" />
                <h3>{story ? "Summary unavailable" : `${symbol || "Locus"} summary`}</h3>
                <p>{story?.message || "Generate a summary of its discovery history, biological function, and scientific significance."}</p>
                <button className="genome-story-button" type="button" onClick={() => void tellMeMore()} disabled={!symbol}><Sparkles size={15} aria-hidden="true" />{story ? "Try again" : "Tell me more"}<ArrowUpRight size={15} aria-hidden="true" /></button>
                {!symbol && <p className="genome-story-note">Select a gene or a variant associated with a gene to generate a summary.</p>}
              </div>
            )}
          </div>
        )}

        {tab === "overview" && variantError && <SourceRefresh label="variant sources" loading={variantEvidence.status === "loading"} error={variantError} retry={variantEvidence.retry} hasData={variantHasEvidence} />}
        {tab === "overview" && geneEvidence.error && <SourceRefresh label="gene sources" loading={geneEvidence.status === "loading"} error={geneEvidence.error} retry={geneEvidence.retry} hasData={geneHasEvidence} />}
      </div>
      {tab !== "story" && <div className="genome-detail-story-action">
        <button className="genome-story-button" type="button" onClick={() => void tellMeMore()} disabled={!symbol || storyLoading}>
          {storyLoading ? <LoaderCircle size={15} className="genome-story-spinner" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
          {storyLoading ? "Generating summary…" : "Tell me more"}<ArrowUpRight size={15} aria-hidden="true" />
        </button>
        <span className="genome-story-caption">{symbol ? "AI summary with linked sources" : "Select a gene-associated variant to generate a summary."}</span>
      </div>}
      <div className="genome-detail-footer"><span className="genome-detail-live-dot" />{geneHasEvidence || variantHasEvidence ? "Source evidence loaded" : "GRCh38 catalog annotation"}<span>1-based coordinates</span></div>
    </aside>
  );
}
