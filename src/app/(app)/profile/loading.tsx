import { SkeletonCard, SkeletonHeader, SkeletonPage, SkeletonTiles } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTiles count={3} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-72" />
      </div>
    </SkeletonPage>
  );
}
