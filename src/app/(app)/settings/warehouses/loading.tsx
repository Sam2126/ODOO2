import { SkeletonCard, SkeletonHeader, SkeletonPage } from "@/components/ui/skeleton";

export default function WarehousesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonCard className="h-72" />
      <SkeletonCard className="h-72" />
    </SkeletonPage>
  );
}
