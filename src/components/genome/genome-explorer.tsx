"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Compass, Dna, Info, Loader2, Maximize2, Minus, Pause, Play, Plus, Search, X } from "lucide-react";
import { CHROMOSOMES, GENOME_LENGTH, LANDMARK_GENES, toGlobalPosition, fromGlobalPosition } from "@/lib/genome/reference";
import { clampGenomeView as clampView, genomeIntervalToViewport, genomePositionAtFraction } from "@/lib/genome/navigation";
import type { GenomeGene, GenomeVariant, GenomeVariantSource } from "@/lib/genome/types";
import { GenomeDetailPanel } from "./detail-panel";
import { VariantTrack } from "./variant-track";
import { VariantCoverage } from "./variant-coverage";
import { variantKey } from "@/lib/genome/variant-layout";
import "./genome.css";

const DnaScene = dynamic(() => import("./dna-scene"), { ssr: false, loading: () => <div className="genome-canvas-loading"><Loader2 size={20} /> Loading genome</div> });
type View = { center: number; span: number };
type Selection = { type: "gene"; gene: GenomeGene } | { type: "variant"; variant: GenomeVariant; gene?: GenomeGene };
type RegionData = { variantSources?: GenomeVariantSource[]; genes: GenomeGene[]; totalGenes?: number; variants: GenomeVariant[]; sequence?: string; sequenceStart?: number; source: string; warnings?: string[]; truncated?: boolean };
function units(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} Gb`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(value < 1e7 ? 2 : 1)} Mb`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} kb`;
  return `${Math.round(value)} bp`;
}
const genePosition = (gene: GenomeGene) => toGlobalPosition(gene.chromosome, Math.round((gene.start + gene.end) / 2));

export function GenomeExplorer() {
  const [view, setView] = useState<View>(() => clampView({ center: GENOME_LENGTH / 2, span: GENOME_LENGTH * .6 }));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [overview, setOverview] = useState<GenomeGene[]>(LANDMARK_GENES);
  const [regionSnapshot, setRegion] = useState<(RegionData & { viewKey: string }) | null>(null);
  const viewKey = `${view.center}:${view.span}`;
  const region = regionSnapshot?.viewKey === viewKey ? regionSnapshot : null;
  const [sceneWidth, setSceneWidth] = useState(1200);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [regionRetry, setRegionRetry] = useState(0);
  const [hoveredGene, setHoveredGene] = useState<GenomeGene | null>(null);
  const [showGenes, setShowGenes] = useState(true);
  const [showVariants, setShowVariants] = useState(true);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GenomeGene[]>([]);
  const [searchedVariant, setSearchedVariant] = useState<GenomeVariant | undefined>();
  const [searchedRegion, setSearchedRegion] = useState<{chromosome: string; start: number; end: number} | undefined>();
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const viewRef = useRef(view);
  const highlightRef = useRef<{ start: number; end: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pointerDistance = useRef(0);
  const gestureDragged = useRef(false);
  const pointerStart = useRef<{ x: number; y: number; gene: GenomeGene | null } | null>(null);
  const left = view.center - (view.span - 1) / 2;
  const right = view.center + (view.span - 1) / 2;
  const locus = fromGlobalPosition(Math.floor(view.center));
  const visibleStart = fromGlobalPosition(left);
  const visibleEnd = fromGlobalPosition(right);
  const basesPerPixel = view.span / Math.max(1, sceneWidth);
  const schematicStatus = `Schematic · ${basesPerPixel.toLocaleString(undefined, { maximumFractionDigits: 2 })} bp/px`;
  const geneLoadStatus = region
    ? typeof region.totalGenes === "number"
      ? `${region.genes.length.toLocaleString()} / ${region.totalGenes.toLocaleString()} genes loaded`
      : `${region.genes.length.toLocaleString()} genes loaded · total unavailable`
    : "Sampled gene overview";
  const isWideView = view.span > 500_000;
  const scale = view.span > 3e8 ? "Genome" : view.span > 5e6 ? "Chromosome" : view.span > 500 ? "Gene" : "Base pairs";
  const isOverview = view.span > 3e8;
  const chromosomeBoundaries = useMemo(() => CHROMOSOMES
    .filter(chromosome => chromosome.offset > 0)
    .map(chromosome => ({ id: chromosome.id, fraction: (chromosome.offset - left + 1) / view.span }))
    .filter(boundary => boundary.fraction > 0 && boundary.fraction < 1), [left, view.span]);
  const chromosomeBreaks = useMemo(() => chromosomeBoundaries.map(boundary => boundary.fraction), [chromosomeBoundaries]);

  const navigate = useCallback((next: View) => { const bounded = clampView(next); viewRef.current = bounded; highlightRef.current = null; setView(bounded); setHoveredGene(null); }, []);
  const zoom = useCallback((factor: number, anchor = .5) => {
    const current = viewRef.current;
    const span = Math.max(40, Math.min(GENOME_LENGTH, current.span * factor));
    navigate({ span, center: current.center + (anchor - .5) * (current.span - span) });
  }, [navigate]);
  const selectGene = useCallback((gene: GenomeGene) => {
    setSelection({ type: "gene", gene }); setSearchOpen(false);
    navigate({ center: genePosition(gene), span: Math.max(1200, (gene.end - gene.start + 1) * 3.2) });
  }, [navigate]);
  const selectVariant = useCallback((variant: GenomeVariant) => {
    const gene = [...(region?.genes ?? []), ...overview].find(g => g.chromosome === variant.chromosome && (g.symbol === variant.gene || (g.start <= variant.position && g.end >= variant.position)));
    setSelection({ type: "variant", variant, gene }); setSearchOpen(false);
    navigate({ center: toGlobalPosition(variant.chromosome, variant.position), span: Math.min(viewRef.current.span, 1500) });
  }, [navigate, overview, region]);
  const selectChromosome = (id: string) => {
    const chromosome = CHROMOSOMES.find(c => c.id === id);
    if (chromosome) navigate({ center: chromosome.offset + (chromosome.length + 1) / 2, span: chromosome.length });
  };

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => setSceneWidth(entries[0].contentRect.width));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/genome/overview", { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (data.genes?.length) setOverview(data.genes); }).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const center = Number(params.get("position")), span = Number(params.get("span"));
    if (center > 0 && span > 0) queueMicrotask(() => navigate({ center, span }));
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("position", String(view.center));
      url.searchParams.set("span", String(Math.round(view.span)));
      window.history.replaceState(null, "", url);
    }, 600);
    return () => clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRegion(null); setDataError("");
      if (view.span > 3e8) { setLoading(false); return; }
      setLoading(true);
      const visible = CHROMOSOMES.filter(c => c.offset < right && c.offset + c.length >= left);
      try {
        const results = await Promise.all(visible.map(async c => {
          const start = Math.max(1, Math.floor(left - c.offset));
          const end = Math.min(c.length, Math.ceil(right - c.offset));
          const response = await fetch(`/api/genome/region?chromosome=${c.id}&start=${start}&end=${end}`, { signal: controller.signal, cache: "no-store" });
          if (!response.ok) throw new Error("Regional data is unavailable. Try again or explore another region.");
          return await response.json() as RegionData;
        }));
        if (!controller.signal.aborted) setRegion({ viewKey, variantSources: results.flatMap(r => r.variantSources ?? []), genes: results.flatMap(r => r.genes), totalGenes: results.every(r => typeof r.totalGenes === "number") ? results.reduce((total, r) => total + r.totalGenes!, 0) : undefined, variants: results.flatMap(r => r.variants), sequence: results.length === 1 ? results[0].sequence : undefined, sequenceStart: results.length === 1 ? results[0].sequenceStart : undefined, source: results[0]?.source ?? "UCSC / GRCh38", warnings: results.flatMap(r => r.warnings ?? []), truncated: results.some(r => r.truncated) });
      } catch (error) {
        if (!controller.signal.aborted) setDataError(error instanceof Error ? error.message : "Unable to load this region.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [view.span, left, right, viewKey, regionRetry]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInput.current?.focus();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!query.trim()) { setSearchResults([]); setSearchedVariant(undefined); setSearchedRegion(undefined); setSearchError(""); setSearchLoading(false); return; }
      setSearchLoading(true); setSearchError("");
      try {
        const response = await fetch(`/api/genome/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Search is unavailable.");
        if (!controller.signal.aborted) { setSearchResults(data.genes ?? []); setSearchedVariant(data.variant); setSearchedRegion(data.region); setSearchError(data.error ?? ""); }
      } catch (error) { if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "Search failed."); }
      finally { if (!controller.signal.aborted) setSearchLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searchOpen]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") { event.preventDefault(); setSearchOpen(open => !open); return; }
      if (event.key === "Escape") { if (searchOpen) setSearchOpen(false); else if (help) setHelp(false); else setSelection(null); return; }
      if ((event.target as HTMLElement)?.matches("input,textarea,select") || searchOpen) return;
      if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(.5); }
      if (event.key === "-") { event.preventDefault(); zoom(2); }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); const v = viewRef.current; navigate({ ...v, center: v.center + v.span * (event.key === "ArrowRight" ? .15 : -.15) });
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [navigate, zoom, searchOpen, help]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("[data-variant-controls]")) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey || event.altKey) zoom(Math.exp(event.deltaY * .008), (event.clientX - element.getBoundingClientRect().left) / element.clientWidth);
      else { const v = viewRef.current; const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY; if (v.span === GENOME_LENGTH && Math.abs(delta) > 0) navigate({ span: GENOME_LENGTH * .6, center: v.center + Math.sign(delta) * GENOME_LENGTH * .05 });
      else navigate({ ...v, center: v.center + delta * v.span / element.clientWidth * .65 }); }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [zoom, navigate]);

  const visibleGenes = useMemo(() => {
    const candidates = [...LANDMARK_GENES, ...(region?.genes ?? overview)];
    if (selection?.type === "gene") candidates.unshift(selection.gene);
    const unique = [...new Map(candidates.map(g => [g.id, g])).values()];
    const inView = unique.filter(g => {
      const start = toGlobalPosition(g.chromosome,g.start), end = toGlobalPosition(g.chromosome,g.end);
      const anchor = (Math.max(start,left) + Math.min(end,right)) / 2;
      return start <= right && end >= left && anchor > left + view.span * .02 && anchor < right - view.span * .02;
    });
    const landmarks = new Set(LANDMARK_GENES.map(g => g.symbol));
    inView.sort((a, b) => Number(selection?.type === "gene" && selection.gene.id === b.id) - Number(selection?.type === "gene" && selection.gene.id === a.id) || Number(landmarks.has(b.symbol)) - Number(landmarks.has(a.symbol)));
    const chosen: GenomeGene[] = [];
    const gap = Math.max(.12, 110 / sceneWidth);
    for (const gene of inView) if (chosen.every(g => Math.abs(Math.max(left, Math.min(right, genePosition(g))) - Math.max(left, Math.min(right, genePosition(gene)))) > view.span * gap)) chosen.push(gene);
    return chosen.sort((a,b) => genePosition(a) - genePosition(b));
  }, [region, overview, selection, left, right, view.span, sceneWidth]);
  const variants = useMemo(() => {
    const all = region?.variants ?? [];
    if (selection?.type !== "variant") return all;
    const key = variantKey(selection.variant);
    return all.some(variant => variantKey(variant) === key) ? all : [...all, selection.variant];
  }, [region, selection]);
  const markerPosition = (gene: GenomeGene) => {
    const anchor = (Math.max(left, toGlobalPosition(gene.chromosome,gene.start)) + Math.min(right, toGlobalPosition(gene.chromosome,gene.end))) / 2;
    return (anchor - left + .5) / view.span;
  };
  const projectedGeneWidth = (gene: GenomeGene) => {
    const interval = genomeIntervalToViewport(toGlobalPosition(gene.chromosome, gene.start), toGlobalPosition(gene.chromosome, gene.end), view);
    return interval ? (interval.end - interval.start) * sceneWidth : 0;
  };
  const highlightGene = (gene: GenomeGene) => {
    // Exact inclusive base edges. Subpixel genes retain their true projected width.
    highlightRef.current = genomeIntervalToViewport(toGlobalPosition(gene.chromosome, gene.start), toGlobalPosition(gene.chromosome, gene.end), viewRef.current);
  };
  const geneAtPointer = (clientX: number, clientY?: number) => {
    if (!showGenes || !viewport.current) return null;
    const rect = viewport.current.getBoundingClientRect();
    if (!rect.width || clientX < rect.left || clientX >= rect.right) return null;
    if (clientY !== undefined && (clientY < rect.top + rect.height * .18 || clientY > rect.top + rect.height * .82)) return null;
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const position = genomePositionAtFraction(t, viewRef.current);
    const candidates = [...(region?.genes ?? overview), ...(selection?.gene ? [selection.gene] : [])];
    const overlapping = candidates.filter(g => toGlobalPosition(g.chromosome,g.start) <= position && toGlobalPosition(g.chromosome,g.end) >= position);
    if (overlapping.length) return overlapping.sort((a,b) => a.end-a.start-(b.end-b.start))[0];
    return null;
  };
  const displayedGenes = hoveredGene && !visibleGenes.some(g => g.id === hoveredGene.id) ? [...visibleGenes,hoveredGene] : visibleGenes;
  const hoveredRange = showGenes && hoveredGene
    ? genomeIntervalToViewport(toGlobalPosition(hoveredGene.chromosome, hoveredGene.start), toGlobalPosition(hoveredGene.chromosome, hoveredGene.end), view)
    : null;
  const closeSelection = () => { setSelection(null); viewport.current?.focus(); };

  return <div className={`genome-app ${selection ? "has-selection" : ""}`}>
    <h1 className="sr-only">Human genome explorer</h1>
    <header className="genome-header">
      <button className="genome-brand" onClick={() => { navigate({ center: GENOME_LENGTH / 2, span: GENOME_LENGTH }); setSelection(null); }} aria-label="Thread of Life, reset to whole genome"><Dna size={27} strokeWidth={1.3} /><span>Thread of Life</span></button>
      <span className="genome-header-center">Human genome</span>
      <div className="genome-header-actions"><button aria-label="Find a gene or variant" className="genome-search-trigger" onClick={() => setSearchOpen(true)}><Search size={15}/><span>Find a gene or variant</span><kbd>⌘ K</kbd></button><button className="genome-icon-button" onClick={() => setHelp(!help)} aria-label="About this atlas" aria-expanded={help}><Info size={19}/></button></div>
    </header>
    <div className="genome-workspace">
      <div className="genome-main">
        <div className="genome-view-heading"><div className="genome-breadcrumb"><button onClick={() => navigate({ center: GENOME_LENGTH / 2, span: GENOME_LENGTH })}><Compass size={14}/> Human</button><span aria-hidden="true">/</span><span className="genome-coordinate genome-visible-range" aria-label={`Visible range: chromosome ${visibleStart.chromosome}, position ${visibleStart.position.toLocaleString()}, through chromosome ${visibleEnd.chromosome}, position ${visibleEnd.position.toLocaleString()}, inclusive`}><span>chr{visibleStart.chromosome}:{visibleStart.position.toLocaleString()}</span><span aria-hidden="true">–</span><span>chr{visibleEnd.chromosome}:{visibleEnd.position.toLocaleString()}</span></span></div><span className="genome-assembly">GRCh38 <span>·</span> REFERENCE</span></div>
        <div className="genome-stage" ref={viewport} tabIndex={0} role="region" aria-label="Interactive genome. Scroll or drag to travel, plus and minus to zoom, arrow keys to move."
          onDoubleClick={event => { if (!(event.target as HTMLElement).closest("button")) zoom(.25, (event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth); }}
          onPointerDown={event => {
            if ((event.target as HTMLElement).closest("button")) return;
            highlightRef.current = null;
            event.currentTarget.setPointerCapture(event.pointerId);
            const gene = geneAtPointer(event.clientX, event.clientY);
            if (pointers.current.size === 0) gestureDragged.current = false;
            else gestureDragged.current = true;
            pointerStart.current = { x:event.clientX, y:event.clientY, gene };
            setHoveredGene(gene); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointerStart.current && Math.hypot(event.clientX-pointerStart.current.x,event.clientY-pointerStart.current.y) > 6) gestureDragged.current = true;
            if (pointers.current.size === 2) { const [a,b] = [...pointers.current.values()]; pointerDistance.current = Math.hypot(a.x-b.x,a.y-b.y); }
          }}
          onPointerMove={event => {
            const previous = pointers.current.get(event.pointerId);
            if (!previous) {
              const button = (event.target as HTMLElement).closest("button");
              // Gene labels own their hover/focus range, including labels outside the DNA band.
              if (button?.classList.contains("genome-gene-marker")) return;
              const gene = geneAtPointer(event.clientX, event.clientY);
              if (gene) highlightGene(gene);
              else highlightRef.current = null;
              if (!button) setHoveredGene(current => current?.id === gene?.id ? current : gene);
              return;
            }
            highlightRef.current = null;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointerStart.current && Math.hypot(event.clientX-pointerStart.current.x,event.clientY-pointerStart.current.y) > 6) gestureDragged.current = true;
            if (pointers.current.size === 2) { const [a,b] = [...pointers.current.values()]; const distance = Math.hypot(a.x-b.x,a.y-b.y); if (pointerDistance.current > 0) zoom(pointerDistance.current / distance); pointerDistance.current = distance; }
            else { const v = viewRef.current; navigate({ ...v, center: v.center - (event.clientX - previous.x) / event.currentTarget.clientWidth * v.span }); }
          }}
          onPointerUp={event => {
            const start = pointerStart.current;
            const isClick = start && !gestureDragged.current && Math.hypot(event.clientX-start.x,event.clientY-start.y) < 6 && pointers.current.size === 1;
            pointers.current.delete(event.pointerId); pointerDistance.current = 0; pointerStart.current = null;
            if (isClick && start.gene) selectGene(start.gene);
          }}
          onPointerLeave={() => { highlightRef.current = null; setHoveredGene(null); }}
          onPointerCancel={event => { highlightRef.current = null; setHoveredGene(null); pointers.current.delete(event.pointerId); pointerDistance.current = 0; pointerStart.current = null; gestureDragged.current = true; }}>
          <div className="genome-stage-grid"/>
          <DnaScene center={view.center} span={view.span} paused={paused} sequence={region?.sequence} highlightRef={highlightRef} chromosomeBreaks={chromosomeBreaks}/>
          <div className="genome-axis-line"/>
          {chromosomeBoundaries.map(boundary => <div key={boundary.id} className="genome-chromosome-boundary" style={{ left: `${boundary.fraction * 100}%` }} title={`chr ${boundary.id} starts · GRCh38 position 1`} role="img" aria-label={`Chromosome ${boundary.id} starts here`} />)}
          {showGenes && displayedGenes.map((gene, index) => <button key={gene.id} className={`genome-gene-marker ${index % 2 ? "marker-below" : "marker-above"} ${hoveredGene?.id === gene.id ? "is-hovered" : ""}`} style={{ left: `${Math.max(Math.min(.5, 140 / sceneWidth), Math.min(1 - Math.min(.5, 140 / sceneWidth), markerPosition(gene))) * 100}%` }} onClick={() => selectGene(gene)} onPointerEnter={() => { highlightGene(gene); setHoveredGene(current => current?.id === gene.id ? current : gene); }} onPointerLeave={event => { if (document.activeElement !== event.currentTarget) { highlightRef.current = null; setHoveredGene(current => current?.id === gene.id ? null : current); } }} onFocus={() => { highlightGene(gene); setHoveredGene(current => current?.id === gene.id ? current : gene); }} onBlur={event => { if (!event.currentTarget.matches(":hover")) { highlightRef.current = null; setHoveredGene(current => current?.id === gene.id ? null : current); } }} aria-label={`Explore ${gene.symbol}, chromosome ${gene.chromosome}, ${gene.start.toLocaleString()} to ${gene.end.toLocaleString()}, ${(gene.end - gene.start + 1).toLocaleString()} base pairs`}><span className="genome-marker-label"><span>{gene.symbol}</span><ArrowUpRight size={12}/></span><span className="genome-marker-chr">chr{gene.chromosome}:{gene.start.toLocaleString()}–{gene.end.toLocaleString()}</span><span className="genome-marker-meta">{(gene.end - gene.start + 1).toLocaleString()} bp · {gene.id.startsWith("refseq:") ? "RefSeq" : "Ensembl"} · GRCh38</span>{projectedGeneWidth(gene) < 1 && <span className="genome-marker-resolution">Below 1 px at this zoom</span>}<span className="genome-marker-stem"/><span className="genome-marker-point"/></button>)}
          {showVariants && <VariantTrack key={viewKey} variants={variants} view={view} width={sceneWidth} sources={region?.variantSources} selected={selection?.type === "variant" ? selection.variant : undefined} onSelect={selectVariant} onZoom={navigate}/>}
          <div className="genome-ruler" aria-hidden="true">{[.1,.3,.5,.7,.9].map(fraction => { const tick = fromGlobalPosition(Math.round(left + fraction * (view.span - 1))); return <span key={fraction} style={{left:`${fraction * 100}%`}}><i/>{isOverview ? `chr${tick.chromosome}` : view.span < 100_000 ? tick.position.toLocaleString() : units(tick.position)}</span>; })}</div>
          <div className="genome-stage-edge left"/><div className="genome-stage-edge right"/>
          <div className="genome-stage-status" aria-live="polite" title={[dataError, ...(region?.warnings ?? [])].filter(Boolean).join(" ")}><span className="genome-scene-status">{loading ? <><Loader2 size={12} className="genome-spin"/> {isWideView ? schematicStatus : "Loading region"}</> : dataError ? isWideView ? `${schematicStatus} · Data unavailable` : dataError : isWideView ? schematicStatus : region?.sequence ? "Reference sequence · 5′ → 3′" : schematicStatus}</span><span className="genome-gene-coverage" title="Loaded loci / matching loci in the curated RefSeq index. Unloaded genes cannot respond to hover.">{geneLoadStatus}</span>{region?.variantSources?.length ? <VariantCoverage sources={region.variantSources} onRetry={() => setRegionRetry(value => value + 1)}/> : loading ? null : dataError ? <button type="button" onClick={() => setRegionRetry(value => value + 1)}>Retry region</button> : !isWideView ? <span>Variant coverage pending</span> : <span>Zoom to load variants</span>}</div>
        </div>
        <div className="genome-locus-track" aria-hidden="true">{hoveredRange && <div className="genome-locus-bracket" style={{ left: `${hoveredRange.start * 100}%`, width: `${(hoveredRange.end - hoveredRange.start) * 100}%` }}><i/><i/></div>}</div>
        {region?.sequence && <><div className="genome-sequence-label">Sequence readout</div><div className="genome-sequence" role="img" aria-label={`Sequence readout. Reference DNA, chromosome ${locus.chromosome}, starting at ${region.sequenceStart}: ${region.sequence}`}>{region.sequence.split("").map((base, i) => <span aria-hidden="true" className={`base-${base}`} key={i} title={`${((region.sequenceStart ?? 1) + i).toLocaleString()} bp`}>{base}</span>)}</div></>}
        <div className="genome-stage-footer"><div className="genome-layer-controls"><button className={showGenes ? "active" : ""} onClick={() => setShowGenes(!showGenes)} aria-pressed={showGenes}><span className="genome-key-gene"/> Genes {showGenes && <Check size={11}/>}</button><button className={showVariants ? "active" : ""} onClick={() => setShowVariants(!showVariants)} aria-pressed={showVariants}><span className="genome-key-variant"/> Variants {showVariants && <Check size={11}/>}</button></div><div className="genome-zoom-controls"><button onClick={() => zoom(2)} disabled={view.span >= GENOME_LENGTH} aria-label="Zoom out"><Minus size={16}/></button><span>{units(view.span)}</span><button onClick={() => zoom(.5)} disabled={view.span <= 40} aria-label="Zoom in"><Plus size={16}/></button><i/><button onClick={() => navigate({ center: GENOME_LENGTH / 2, span: GENOME_LENGTH })} aria-label="Show whole genome"><Maximize2 size={15}/></button><button type="button" onClick={() => setPaused(value => !value)} title={paused ? "Resume animation" : "Pause animation"} aria-label={paused ? "Resume animation" : "Pause animation"} aria-pressed={paused}>{paused ? <Play size={15} aria-hidden="true"/> : <Pause size={15} aria-hidden="true"/>}</button></div></div>
        <div className="genome-navigator">
          <div className="genome-nav-heading"><span>Chromosomes</span><span className="genome-scale-label">{scale} <ChevronDown size={11}/></span><select className="genome-mobile-chromosome" aria-label="Jump to chromosome" value={isOverview ? "" : locus.chromosome} onChange={event => event.target.value && selectChromosome(event.target.value)}><option value="">Choose chromosome</option>{CHROMOSOMES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="genome-chromosomes">{CHROMOSOMES.map(chromosome => <button key={chromosome.id} className={`${!isOverview && locus.chromosome === chromosome.id ? "active" : ""}`} style={{ flexGrow: Math.max(chromosome.length / 1e7, 1.3) }} onClick={() => selectChromosome(chromosome.id)} aria-label={`Explore chromosome ${chromosome.id}`} aria-pressed={!isOverview && locus.chromosome === chromosome.id}><span className="genome-chromosome-bar"><i/></span><span>{chromosome.id === "MT" ? "M" : chromosome.id}</span></button>)}</div>
          <div className="genome-position-track"><span style={{ left: `${Math.max(0,left) / GENOME_LENGTH * 100}%`, width: `${Math.min(100,view.span / GENOME_LENGTH * 100)}%` }}/></div>

        </div>

      </div>
      {selection && <GenomeDetailPanel key={selection.type === "gene" ? `gene-${selection.gene.id}` : `variant-${variantKey(selection.variant)}`} selection={selection} onClose={closeSelection} onSelectVariant={selectVariant}/>}
    </div>
    {help && <div className="genome-help" role="dialog" aria-label="About this atlas"><button className="genome-icon-button" onClick={() => setHelp(false)} aria-label="Close information"><X size={17}/></button><div className="genome-eyebrow">REFERENCE DATA</div><h2>About this genome</h2><p>Explore the GRCh38 human reference: chromosomes 1–22, X, Y, and mitochondrial DNA. These are separate molecules arranged along one navigable axis.</p><p>The 3D helix is schematic. Gene loci use reference coordinates; labels are spaced for readability. Zoom in for dbSNP and ClinVar records and, at 250 bp or closer, reference sequence. Variant ticks mark exact positions; numbered groups contain every loaded record in that interval.</p><p>{region?.warnings?.join(" ") || "Variant annotations are loaded on demand and may be sampled. This atlas is not an exhaustive catalogue of variation or a personal genome."}</p><div className="genome-help-keys"><span><kbd>←</kbd><kbd>→</kbd> Pan</span><span><kbd>+</kbd><kbd>−</kbd> Zoom</span><span><kbd>⌘ K</kbd> Search</span></div><p className="genome-help-sources">RefSeq · dbSNP · ClinVar · gnomAD · GTEx · ClinGen · PubMed</p><Link href="/manifesto">About Thread of Life <ArrowUpRight size={13}/></Link></div>}
    {searchOpen && <div className="genome-search-backdrop" onClick={() => setSearchOpen(false)}><section className="genome-search-dialog" role="dialog" aria-modal="true" aria-label="Find a gene or variant" onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const elements = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input,a[href]'); const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><div className="genome-search-input"><Search size={20}/><input ref={searchInput} value={query} onChange={event => {setSearchLoading(Boolean(event.target.value.trim())); setQuery(event.target.value); setSearchResults([]); setSearchedVariant(undefined); setSearchedRegion(undefined);}} placeholder="Search genes, variants, or coordinates" aria-label="Gene, variant, or coordinate"/><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18}/></button></div><div className="genome-search-results">{searchLoading ? <p><Loader2 className="genome-spin" size={16}/> Searching the reference</p> : searchError ? <p role="status">{searchError}</p> : query.trim() ? <>{searchedRegion && <button onClick={() => { navigate({ center: toGlobalPosition(searchedRegion.chromosome, searchedRegion.start), span: 1000 }); setSearchOpen(false); }}><span><strong>chr{searchedRegion.chromosome}:{searchedRegion.start.toLocaleString()}</strong><small>Go to reference position</small></span><ArrowRight size={16}/></button>}{searchedVariant && <button onClick={() => selectVariant(searchedVariant)}><span><strong>{searchedVariant.id}</strong><small>Chromosome {searchedVariant.chromosome} · {searchedVariant.position.toLocaleString()} bp</small></span><ArrowRight size={16}/></button>}{searchResults.map(gene => <button key={gene.id} onClick={() => selectGene(gene)}><span><strong>{gene.symbol}</strong><small>{gene.name || `Chromosome ${gene.chromosome} · ${gene.start.toLocaleString()}–${gene.end.toLocaleString()}`}</small></span><ArrowUpRight size={16}/></button>)}{!searchResults.length && !searchedVariant && !searchedRegion && <p>No matching locus. Try a gene symbol, rsID, or chr17:43044295.</p>}</> : <><div className="genome-search-label">Genes</div>{["BRCA1","TP53","HBB","CFTR","APOE"].map(symbol => LANDMARK_GENES.find(g => g.symbol === symbol)).filter((g): g is GenomeGene => Boolean(g)).map(gene => <button key={gene.id} onClick={() => selectGene(gene)}><span><strong>{gene.symbol}</strong><small>{gene.name}</small></span><ArrowUpRight size={16}/></button>)}</>}</div><div className="genome-search-foot">GRCh38 reference <span><kbd>esc</kbd> to close</span></div></section></div>}
  </div>;
}
