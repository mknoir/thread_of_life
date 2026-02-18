import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generatePreRead,
  type PreReadPageType,
} from "@/lib/ai/preread";

interface PreReadCardProps {
  pageType: PreReadPageType;
  title: string;
  facts: string[];
}

export async function PreReadCard({ pageType, title, facts }: PreReadCardProps) {
  const preRead = await generatePreRead({ pageType, title, facts });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pre-read</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {preRead}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Generated from fetched page data. Narrative tone; factual constraints applied.
        </p>
      </CardContent>
    </Card>
  );
}
