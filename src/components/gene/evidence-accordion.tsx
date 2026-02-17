import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { GeneSummary } from "@/lib/types/gene";

interface EvidenceAccordionProps {
  gene: GeneSummary;
}

export function EvidenceAccordion({ gene }: EvidenceAccordionProps) {
  return (
    <Accordion type="multiple" className="w-full">
      {/* ClinVar section */}
      <AccordionItem value="clinvar">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            ClinVar
            {gene.clinvarSummary && (
              <Badge variant="outline" className="text-[10px]">
                {gene.clinvarSummary.totalVariants} variants
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {gene.clinvarSummary ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                ClinVar contains {gene.clinvarSummary.totalVariants} submitted
                variants for {gene.symbol}.
                {gene.clinvarSummary.conflicting > 0 && (
                  <span>
                    {" "}
                    Of these, {gene.clinvarSummary.conflicting} have conflicting
                    interpretations.
                  </span>
                )}
              </p>
              <p className="text-xs">
                Source version: {gene.sourceVersions.clinvar || "Unknown"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No ClinVar data available for this gene.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* ClinGen section */}
      <AccordionItem value="clingen">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            ClinGen
            {gene.clingenValidity && (
              <Badge variant="secondary" className="text-[10px]">
                {gene.clingenValidity}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {gene.clingenValidity ? (
            <p className="text-sm text-muted-foreground">
              ClinGen classifies the gene-disease validity for {gene.symbol} as:{" "}
              <strong>{gene.clingenValidity}</strong>.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No ClinGen validity classification available for this gene.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* gnomAD section */}
      <AccordionItem value="gnomad">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            gnomAD
            {gene.constraint && (
              <Badge variant="outline" className="text-[10px]">
                Constraint data available
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {gene.constraint ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                gnomAD constraint metrics for {gene.symbol}:
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                {gene.constraint.pLI !== null && (
                  <li>pLI: {gene.constraint.pLI.toFixed(4)}</li>
                )}
                {gene.constraint.loeufScore !== null && (
                  <li>LOEUF: {gene.constraint.loeufScore.toFixed(4)}</li>
                )}
                {gene.constraint.misZScore !== null && (
                  <li>Missense Z: {gene.constraint.misZScore.toFixed(2)}</li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No gnomAD constraint data available.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* GTEx section */}
      <AccordionItem value="gtex">
        <AccordionTrigger>
          <div className="flex items-center gap-2">
            GTEx Expression
            {gene.topExpressions.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {gene.topExpressions.length} tissues
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {gene.topExpressions.length > 0 ? (
            <div className="space-y-2">
              {gene.topExpressions.slice(0, 5).map((expr) => (
                <div key={expr.tissue} className="flex items-center gap-3">
                  <span className="w-32 truncate text-xs">
                    {expr.tissue}
                  </span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/30"
                      style={{
                        width: `${Math.min(100, (expr.tpm / (gene.topExpressions[0]?.tpm || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {expr.tpm.toFixed(1)} TPM
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No GTEx expression data available.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
