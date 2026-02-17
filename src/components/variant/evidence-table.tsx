import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClinvarSubmission } from "@/lib/types/variant";

interface EvidenceTableProps {
  submissions: ClinvarSubmission[];
}

export function EvidenceTable({ submissions }: EvidenceTableProps) {
  if (submissions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No submissions found.</p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Submitter</TableHead>
            <TableHead>Classification</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead className="text-right">Last evaluated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub, i) => (
            <TableRow key={`${sub.submitter}-${i}`}>
              <TableCell className="max-w-[200px] truncate text-sm">
                {sub.submitter}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">
                  {sub.classification}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                {sub.condition}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {sub.dateLastEvaluated || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
