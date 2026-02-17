import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EvidenceRef } from "@/lib/types/claim";

interface EvidenceRefCardProps {
  ref_: EvidenceRef;
}

/**
 * Renders a single evidence reference inside the evidence Sheet.
 * Shows source name, date, link, and short excerpt.
 */
export function EvidenceRefCard({ ref_ }: EvidenceRefCardProps) {
  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">
          {ref_.sourceName}
        </Badge>
        <span className="font-mono text-[10px] text-muted-foreground">
          {ref_.date}
        </span>
      </div>
      <p className="text-sm text-foreground/80">{ref_.excerpt}</p>
      <a
        href={ref_.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        View source
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
