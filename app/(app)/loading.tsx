import { CardGridSkeleton, TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a page's server component is fetching. */
export default function AppLoading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <CardGridSkeleton count={4} />
      <div className="mt-5 rounded-xl border">
        <TableSkeleton rows={6} columns={6} />
      </div>
    </div>
  );
}
