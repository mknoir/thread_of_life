import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function GeneLoading() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-4 w-48" />

      {/* Gene summary skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-16 w-full max-w-2xl" />
      </div>

      <Separator />

      {/* Evidence accordion skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>

      <Separator />

      {/* Epistemic alerts skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
