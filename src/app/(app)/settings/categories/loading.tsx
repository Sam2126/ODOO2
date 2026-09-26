import { SkeletonCard, SkeletonHeader, SkeletonPage } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-56" />
      </div>
    </SkeletonPage>
  );
}
