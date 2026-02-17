import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { GeneConstraint } from "@/lib/types/gene"

interface GnomadConstraintCardsProps {
  constraint: GeneConstraint | null
}

export function GnomadConstraintCards({ constraint }: GnomadConstraintCardsProps) {
  if (!constraint) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>gnomAD constraint</CardTitle>
          <CardDescription>No gnomAD constraint data available.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const pLI = constraint.pLI
  const loeuf = constraint.loeufScore
  const misZ = constraint.misZScore

  return (
    <Card>
      <CardHeader>
        <CardTitle>gnomAD constraint profile</CardTitle>
        <CardDescription>
          Evolutionary tolerance estimates from population variation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MetricRow
          label="pLI"
          value={pLI}
          normalized={pLI == null ? null : Math.max(0, Math.min(100, pLI * 100))}
          note="Higher suggests stronger LoF intolerance"
        />
        <MetricRow
          label="LOEUF"
          value={loeuf}
          normalized={
            loeuf == null ? null : Math.max(0, Math.min(100, (1 - Math.min(loeuf, 1.5) / 1.5) * 100))
          }
          note="Lower indicates stronger LoF constraint"
          precision={3}
        />
        <MetricRow
          label="Mis-Z"
          value={misZ}
          normalized={misZ == null ? null : Math.max(0, Math.min(100, ((misZ + 2) / 7) * 100))}
          note="Higher can suggest missense depletion"
          precision={2}
        />
      </CardContent>
    </Card>
  )
}

function MetricRow({
  label,
  value,
  normalized,
  note,
  precision = 2,
}: {
  label: string
  value: number | null
  normalized: number | null
  note: string
  precision?: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          {value == null ? "N/A" : value.toFixed(precision)}
        </span>
      </div>
      <Progress value={normalized ?? 0} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  )
}
