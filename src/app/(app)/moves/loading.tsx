import {
  SkeletonFilters,
  SkeletonHeader,
  SkeletonPage,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function MovesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonFilters />
      <SkeletonTable rows={12} />
    </SkeletonPage>
  );
}
