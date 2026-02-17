import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ClinicalSignificance, ReviewStatus } from "@/lib/types/variant";

interface ClaimHeaderProps {
  hgvs: string;
  gene: string;
  clinicalSignificance: ClinicalSignificance;
  reviewStatus: ReviewStatus;
}

const SIGNIFICANCE_VARIANT: Record<
  ClinicalSignificance,
  "default" | "secondary" | "destructive" | "outline"
> = {
  Pathogenic: "destructive",
  "Likely pathogenic": "destructive",
  "Uncertain significance": "outline",
  "Likely benign": "secondary",
  Benign: "secondary",
  "Conflicting classifications": "default",
  Other: "outline",
};

const REVIEW_STARS: Record<ReviewStatus, number> = {
  "practice guideline": 4,
  "reviewed by expert panel": 3,
  "criteria provided, multiple submitters, no conflicts": 3,
  "criteria provided, conflicting classifications": 2,
  "criteria provided, single submitter": 1,
  "no assertion criteria provided": 0,
  "no classification provided": 0,
};

export function ClaimHeader({
  hgvs,
  gene,
  clinicalSignificance,
  reviewStatus,
}: ClaimHeaderProps) {
  const stars = REVIEW_STARS[reviewStatus];

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">
            {gene}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">{hgvs}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <Badge
              variant={SIGNIFICANCE_VARIANT[clinicalSignificance]}
              className="cursor-help"
            >
              {clinicalSignificance}
            </Badge>
          </HoverCardTrigger>
          <HoverCardContent className="w-72 text-sm">
            <p className="font-medium">Clinical significance</p>
            <p className="mt-1 text-muted-foreground">
              This classification reflects the aggregate interpretation from
              ClinVar submitters. It can change as new evidence emerges.
            </p>
          </HoverCardContent>
        </HoverCard>

        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-help">
              {"★".repeat(stars)}
              {"☆".repeat(4 - stars)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{reviewStatus}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
