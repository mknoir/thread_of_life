"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { layoutVariants, variantKey } from "@/lib/genome/variant-layout";
import { CHROMOSOMES, toGlobalPosition } from "@/lib/genome/reference";
import type { GenomeVariant, GenomeVariantSource } from "@/lib/genome/types";

type Props = {
  variants: GenomeVariant[];
  view: { center: number; span: number };
  width: number;
  selected?: GenomeVariant;
  sources?: GenomeVariantSource[];
  onSelect: (variant: GenomeVariant) => void;
  onZoom: (view: { center: number; span: number }) => void;
};

const label = (variant: GenomeVariant) => variant.rsId || (variant.clinvarId ? `ClinVar ${variant.clinvarId}` : variant.id);

export function VariantTrack({ variants, view, width, selected, sources, onSelect, onZoom }: Props) {
  const layout = useMemo(() => layoutVariants(variants, view, width), [variants, view, width]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const group = layout.groups.find(entry => entry.key === openKey);
  const close = () => { setOpenKey(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!openKey) return;
    closeButton.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenKey(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [openKey]);
  if (!layout.points.length) return null;
  const selectedKey = selected ? variantKey(selected) : null;
  const left = view.center - (view.span - 1) / 2;
  const incomplete = (sources ?? []).flatMap(source => {
    const chromosome = CHROMOSOMES.find(entry => entry.id === source.chromosome);
    if (!source.truncated || source.loadedThrough === undefined || !chromosome) return [];
    const start = Math.max(0, Math.min(1, (chromosome.offset + source.loadedThrough + 1 - left) / view.span));
    const end = Math.max(0, Math.min(1, (chromosome.offset + chromosome.length + 1 - left) / view.span));
    return end > start ? [{ source: source.source, start, end }] : [];
  });
  return <div className="genome-variant-track" ref={root} data-variant-controls="true"
    onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === "Escape" && group) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    {incomplete.map((entry, index) => <div key={index} className="genome-variant-unloaded" style={{ left: `${entry.start * 100}%`, width: `${(entry.end - entry.start) * 100}%` }} role="img" aria-label={`${entry.source} coverage incomplete in this interval; zoom in to load more records`} title={`${entry.source} coverage incomplete · zoom in`}>{(entry.end - entry.start) * width > 160 && <span>{entry.source} incomplete · zoom in</span>}</div>)}
    <svg viewBox="0 0 10000 18" preserveAspectRatio="none" aria-hidden="true" className="genome-variant-ticks">
      {layout.points.map(({ variant, fraction }) => <path key={variantKey(variant)} d={`M${fraction * 10000} 16V${variant.clinvarId ? 0 : 7}`} vectorEffect="non-scaling-stroke" className={`${variant.clinvarId ? "is-clinvar" : ""} ${selectedKey === variantKey(variant) ? "is-selected" : ""}`} />)}
    </svg>
    {layout.groups.map(entry => {
      const first = entry.points[0].variant;
      const last = entry.points[entry.points.length - 1].variant;
      const count = entry.points.length;
      return <button type="button" key={entry.key} className={`genome-variant-group ${entry.points.some(point => point.variant.clinvarId) ? "has-clinvar" : ""} ${entry.key === openKey ? "is-open" : ""}`}
        style={{ left: `${entry.column / layout.columns * 100}%`, width: `${100 / layout.columns}%` }}
        aria-label={count === 1 ? `Explore variant ${label(first)}, chromosome ${first.chromosome}, position ${first.position}` : `${count} variants, chromosome ${first.chromosome}, positions ${first.position} to ${last.position}`}
        aria-expanded={count > 1 ? entry.key === openKey : undefined}
        aria-haspopup={count > 1 ? "dialog" : undefined}
        title={count === 1 ? `${label(first)} · chr${first.chromosome}:${first.position.toLocaleString()}` : `${count} variant records · click to inspect every record`}
        onClick={event => {
          trigger.current = event.currentTarget;
          if (count === 1) onSelect(first);
          else setOpenKey(current => current === entry.key ? null : entry.key);
        }}><span>{count > 1 ? count : "·"}</span></button>;
    })}
    {group && <section role="dialog" aria-label="Variants in this interval" className="genome-variant-popover" style={{ left: `${Math.min(Math.max((group.column + .5) / layout.columns * width - 155, 8), Math.max(8, width - 318))}px` }}>
      <header><div><strong>{group.points.length.toLocaleString()} variants</strong><small>chr{group.points[0].variant.chromosome}:{group.points[0].variant.position.toLocaleString()}–{group.points[group.points.length - 1].variant.position.toLocaleString()}</small></div><button type="button" onClick={close} ref={closeButton} aria-label="Close variant list"><X size={15}/></button></header>
      <div className="genome-variant-records">
        {group.points.map(({ variant }) => <button type="button" key={variantKey(variant)} onClick={() => { setOpenKey(null); onSelect(variant); }}>
          <span><strong>{label(variant)}</strong><small>{variant.position.toLocaleString()} · {variant.ref && variant.alt ? `${variant.ref} → ${variant.alt}` : variant.alternateAlleles?.length ? `${variant.ref || "∅"} → ${variant.alternateAlleles.map(allele => allele || "∅").join(" / ")}` : "Alleles in source record"}</small><small>{variant.clinvarId ? `ClinVar · ${variant.significance || "Classification not returned"}` : `${variant.source.startsWith("NCBI") ? "dbSNP" : variant.source.split(" · ")[0]} · ${variant.representation === "contextual" ? "Contextual indel" : "No clinical classification loaded"}`}</small></span><ArrowUpRight size={13}/>
        </button>)}
      </div>
      <button type="button" className="genome-variant-zoom" onClick={() => {
        const start = toGlobalPosition(group.points[0].variant.chromosome, group.points[0].variant.position);
        const end = toGlobalPosition(group.points[group.points.length - 1].variant.chromosome, group.points[group.points.length - 1].variant.position);
        onZoom({ center: (start + end) / 2, span: Math.max(40, (end - start + 1) * 1.5) });
      }}>Zoom to interval <ArrowUpRight size={13}/></button>
    </section>}
  </div>;
}
