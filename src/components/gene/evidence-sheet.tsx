"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EvidenceRefCard } from "@/components/shared/evidence-ref-card";
import type { Claim } from "@/lib/types/claim";

interface EvidenceSheetProps {
  claims: Claim[];
  sourceVersions: Record<string, string>;
  triggerLabel?: string;
}

export function EvidenceSheet({
  claims,
  sourceVersions,
  triggerLabel = "Open evidence",
}: EvidenceSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Evidence Drawer</SheetTitle>
          <SheetDescription>
            Citations, sources, and raw evidence. This is where rigor lives.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-10rem)]">
          <div className="space-y-6 pr-4">
            {claims.length > 0 ? (
              claims.map((claim, i) => (
                <div key={i} className="space-y-3">
                  <p className="text-sm font-medium">{claim.claimText}</p>
                  {claim.evidenceRefs.map((ref) => (
                    <EvidenceRefCard key={ref.id} ref_={ref} />
                  ))}
                  {i < claims.length - 1 && <Separator />}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No structured evidence available yet.
              </p>
            )}

            <Separator />

            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground">
                Data versions
              </h4>
              {Object.entries(sourceVersions).map(([source, version]) => (
                <div
                  key={source}
                  className="flex justify-between font-mono text-[10px] text-muted-foreground"
                >
                  <span>{source}</span>
                  <span>{version}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
