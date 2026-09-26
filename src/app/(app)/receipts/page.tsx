import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingListPage } from "@/components/documents/picking-list-page";

export const metadata: Metadata = { title: "Receipts" };

export default async function Page({ searchParams }: PageProps<"/receipts">) {
  return (
    <PickingListPage config={PICKING_CONFIG.RECEIPT} searchParams={await searchParams} />
  );
}
