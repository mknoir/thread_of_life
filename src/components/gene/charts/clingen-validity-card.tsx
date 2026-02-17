import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ClingenValidityCardProps {
  validity: string | null
}

const VALIDITY_ORDER: Record<string, number> = {
  Definitive: 5,
  Strong: 4,
  Moderate: 3,
  Limited: 2,
  Disputed: 1,
  Refuted: 0,
}

export function ClingenValidityCard({ validity }: ClingenValidityCardProps) {
  if (!validity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ClinGen validity</CardTitle>
          <CardDescription>No ClinGen validity assertion available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const score = VALIDITY_ORDER[validity] ?? 0
  const percent = Math.round((score / 5) * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle>ClinGen gene-disease validity</CardTitle>
        <CardDescription>
          Evidence strength assigned by ClinGen curation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant={score >= 4 ? "secondary" : "outline"}>{validity}</Badge>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Evidence strength</span>
            <span className="font-mono tabular-nums">{percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
