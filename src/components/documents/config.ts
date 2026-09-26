import { PickingType } from "@prisma/client";

/**
 * Receipts, delivery orders and internal transfers are one model and one set of
 * screens. Everything that legitimately differs between them lives here, so the
 * three route folders stay thin and none of the behaviour is duplicated.
 */
export type PickingConfig = {
  type: PickingType;
  route: string;
  title: string;
  singular: string;
  description: string;
  /** Null when the document has no counterparty — an internal transfer. */
  partnerLabel: string | null;
  partnerPlaceholder?: string;
  sourceLabel: string;
  destLabel: string;
  /** Which end the user picks; the other end is the fixed virtual location. */
  sourceMode: "virtual-vendor" | "internal";
  destMode: "virtual-customer" | "internal";
  emptyTitle: string;
  emptyBody: string;
  validateLabel: string;
  doneMessage: string;
};

export const PICKING_CONFIG: Record<PickingType, PickingConfig> = {
  RECEIPT: {
    type: PickingType.RECEIPT,
    route: "/receipts",
    title: "Receipts",
    singular: "Receipt",
    description: "Goods arriving from suppliers. Validating one increases stock.",
    partnerLabel: "Supplier",
    partnerPlaceholder: "Bharat Steel Traders",
    sourceLabel: "From",
    destLabel: "Into location",
    sourceMode: "virtual-vendor",
    destMode: "internal",
    emptyTitle: "No receipts yet",
    emptyBody: "Record what arrives from a supplier and stock goes up the moment you validate.",
    validateLabel: "Validate receipt",
    doneMessage: "Stock increased at the destination location.",
  },
  DELIVERY: {
    type: PickingType.DELIVERY,
    route: "/deliveries",
    title: "Delivery orders",
    singular: "Delivery order",
    description: "Goods leaving for customers. Validating one decreases stock.",
    partnerLabel: "Customer",
    partnerPlaceholder: "Nexus Interiors",
    sourceLabel: "Pick from location",
    destLabel: "To",
    sourceMode: "internal",
    destMode: "virtual-customer",
    emptyTitle: "No delivery orders yet",
    emptyBody: "Pick, pack and validate — stock leaves the shelf and lands in the ledger.",
    validateLabel: "Validate delivery",
    doneMessage: "Stock decreased at the source location.",
  },
  INTERNAL: {
    type: PickingType.INTERNAL,
    route: "/transfers",
    title: "Internal transfers",
    singular: "Internal transfer",
    description:
      "Stock moving inside the company. Total on-hand does not change — only where it sits.",
    partnerLabel: null,
    sourceLabel: "From location",
    destLabel: "To location",
    sourceMode: "internal",
    destMode: "internal",
    emptyTitle: "No internal transfers yet",
    emptyBody: "Main Store to Production Rack, Rack A to Rack B, one warehouse to another.",
    validateLabel: "Validate transfer",
    doneMessage: "Stock moved between locations. The total is unchanged.",
  },
};
