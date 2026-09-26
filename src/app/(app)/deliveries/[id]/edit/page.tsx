import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingEditPage } from "@/components/documents/picking-pages";

export const metadata: Metadata = { title: "Edit delivery order" };

export default async function Page({ params }: PageProps<"/deliveries/[id]/edit">) {
  const { id } = await params;
  return <PickingEditPage config={PICKING_CONFIG.DELIVERY} id={id} />;
}
