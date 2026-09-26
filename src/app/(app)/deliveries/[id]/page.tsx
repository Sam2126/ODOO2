import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingDetailPage } from "@/components/documents/picking-detail-page";

export const metadata: Metadata = { title: "Delivery order" };

export default async function Page({ params }: PageProps<"/deliveries/[id]">) {
  const { id } = await params;
  return <PickingDetailPage config={PICKING_CONFIG.DELIVERY} id={id} />;
}
