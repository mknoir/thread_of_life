import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function GeneThreadLoading() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Separator />
      <div className="space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-full max-w-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full max-w-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-24 w-full max-w-2xl" />
        </div>
      </div>
    </div>
  );
}
