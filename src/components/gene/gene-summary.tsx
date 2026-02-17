import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { GeneSummary } from "@/lib/types/gene";

interface GeneSummaryCardProps {
  gene: GeneSummary;
}

export function GeneSummaryCard({ gene }: GeneSummaryCardProps) {
  const constraint = gene.constraint;
  const pLI = constraint?.pLI;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{gene.symbol}</h1>
        <p className="text-lg text-muted-foreground">{gene.name}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Chr {gene.chromosome}</Badge>
        {gene.clingenValidity && (
          <Badge variant="secondary">{gene.clingenValidity}</Badge>
        )}
        {pLI !== null && pLI !== undefined && (
          <Badge variant={pLI > 0.9 ? "destructive" : "outline"}>
            pLI: {pLI.toFixed(2)}
          </Badge>
        )}
      </div>

      {gene.clinvarSummary && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            ClinVar variant classifications
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              {
                label: "Pathogenic",
                count: gene.clinvarSummary.pathogenic,
              },
              {
                label: "Likely path.",
                count: gene.clinvarSummary.likelyPathogenic,
              },
              { label: "VUS", count: gene.clinvarSummary.vus },
              {
                label: "Likely benign",
                count: gene.clinvarSummary.likelyBenign,
              },
              { label: "Benign", count: gene.clinvarSummary.benign },
              {
                label: "Conflicting",
                count: gene.clinvarSummary.conflicting,
              },
            ].map(({ label, count }) => (
              <div key={label} className="text-center">
                <div className="text-xl font-semibold">{count}</div>
                <div className="text-[10px] text-muted-foreground">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {constraint?.loeufScore !== null &&
        constraint?.loeufScore !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Loss-of-function constraint (LOEUF)
              </span>
              <span className="font-mono text-xs">
                {constraint.loeufScore.toFixed(3)}
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, (1 - constraint.loeufScore) * 100))}
              className="h-1.5"
            />
            <p className="text-[10px] text-muted-foreground">
              Lower = more intolerant to loss-of-function variants
            </p>
          </div>
        )}
    </div>
  );
}
