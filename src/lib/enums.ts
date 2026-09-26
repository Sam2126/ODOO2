import type { DocStatus, LocationType, PickingType, Role, Uom } from "@prisma/client";

/**
 * Plain copies of the Prisma enums for client components.
 *
 * Importing the enum objects from `@prisma/client` pulls the generated client's
 * metadata — around 46 KB of field names and model descriptions — into the
 * browser bundle for what is, in the end, a handful of string constants.
 *
 * `satisfies Record<T, T>` ties each object to the generated type in both
 * directions: adding a member to the schema without adding it here is a type
 * error, and so is a member here that the schema does not have. They cannot
 * silently drift apart.
 */

export const DOC_STATUS = {
  DRAFT: "DRAFT",
  WAITING: "WAITING",
  READY: "READY",
  DONE: "DONE",
  CANCELED: "CANCELED",
} as const satisfies Record<DocStatus, DocStatus>;

export const LOCATION_TYPE = {
  INTERNAL: "INTERNAL",
  VENDOR: "VENDOR",
  CUSTOMER: "CUSTOMER",
  ADJUSTMENT: "ADJUSTMENT",
  TRANSIT: "TRANSIT",
} as const satisfies Record<LocationType, LocationType>;

export const PICKING_TYPE = {
  RECEIPT: "RECEIPT",
  DELIVERY: "DELIVERY",
  INTERNAL: "INTERNAL",
} as const satisfies Record<PickingType, PickingType>;

export const ROLE = {
  MANAGER: "MANAGER",
  STAFF: "STAFF",
} as const satisfies Record<Role, Role>;

export const UOM = {
  UNIT: "UNIT",
  KG: "KG",
  LITRE: "LITRE",
  METRE: "METRE",
  BOX: "BOX",
  PACK: "PACK",
} as const satisfies Record<Uom, Uom>;

/** Ordered for dropdowns — most common unit first. */
export const UOM_VALUES: Uom[] = [
  UOM.UNIT,
  UOM.KG,
  UOM.LITRE,
  UOM.METRE,
  UOM.BOX,
  UOM.PACK,
];
