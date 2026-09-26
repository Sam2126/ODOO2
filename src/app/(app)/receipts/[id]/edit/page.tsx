import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingEditPage } from "@/components/documents/picking-pages";

export const metadata: Metadata = { title: "Edit receipt" };

export default async function Page({ params }: PageProps<"/receipts/[id]/edit">) {
  const { id } = await params;
  return <PickingEditPage config={PICKING_CONFIG.RECEIPT} id={id} />;
}
