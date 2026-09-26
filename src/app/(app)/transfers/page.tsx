import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingListPage } from "@/components/documents/picking-list-page";

export const metadata: Metadata = { title: "Internal transfers" };

export default async function Page({ searchParams }: PageProps<"/transfers">) {
  return (
    <PickingListPage config={PICKING_CONFIG.INTERNAL} searchParams={await searchParams} />
  );
}
