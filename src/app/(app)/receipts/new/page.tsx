import type { Metadata } from "next";

import { PICKING_CONFIG } from "@/components/documents/config";
import { PickingNewPage } from "@/components/documents/picking-pages";

export const metadata: Metadata = { title: "New receipt" };

export default function Page() {
  return <PickingNewPage config={PICKING_CONFIG.RECEIPT} />;
}
