import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingListPage } from "@/components/documents/picking-list-page";

export const metadata: Metadata = { title: "Delivery orders" };

export default async function Page({ searchParams }: PageProps<"/deliveries">) {
  return (
    <PickingListPage config={PICKING_CONFIG.DELIVERY} searchParams={await searchParams} />
  );
}
