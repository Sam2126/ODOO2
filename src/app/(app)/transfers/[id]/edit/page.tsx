import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingEditPage } from "@/components/documents/picking-pages";

export const metadata: Metadata = { title: "Edit internal transfer" };

export default async function Page({ params }: PageProps<"/transfers/[id]/edit">) {
  const { id } = await params;
  return <PickingEditPage config={PICKING_CONFIG.INTERNAL} id={id} />;
}
