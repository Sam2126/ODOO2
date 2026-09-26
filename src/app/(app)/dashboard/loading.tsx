import {
  SkeletonCard,
  SkeletonFilters,
  SkeletonHeader,
  SkeletonPage,
  SkeletonTable,
  SkeletonTiles,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonFilters />
      <SkeletonTiles />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <SkeletonTable rows={8} />
        <div className="space-y-5">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-56" />
        </div>
      </div>
    </SkeletonPage>
  );
}
