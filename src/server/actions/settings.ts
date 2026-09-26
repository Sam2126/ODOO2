"use server";

import { LocationType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StockError } from "@/lib/errors";
import { field, formSuccess, toFormState, type FormState } from "@/lib/forms";
import { categorySchema, locationSchema, warehouseSchema } from "@/lib/validators";

// Everything in this file is manager-only. The nav hides these pages from
// staff, and `requireManager` is what actually enforces it.

// ── Categories ───────────────────────────────────────────────────────────────

export async function saveCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireManager();
    const id = field(formData, "id");
    const input = categorySchema.parse({ name: field(formData, "name") });

    if (id) {
      await prisma.category.update({ where: { id }, data: input });
    } else {
      await prisma.category.create({ data: input });
    }

    revalidatePath("/settings/categories");
    revalidatePath("/products");
    return formSuccess(id ? "Category renamed." : "Category added.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteCategoryAction(id: string): Promise<FormState> {
  try {
    await requireManager();
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new StockError(
        `${count} product${count === 1 ? " is" : "s are"} still in this category. Move them first.`,
      );
    }

    await prisma.category.delete({ where: { id } });
    revalidatePath("/settings/categories");
    revalidatePath("/products");
    return formSuccess("Category deleted.");
  } catch (error) {
    return toFormState(error);
  }
}

// ── Warehouses ───────────────────────────────────────────────────────────────

export async function saveWarehouseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireManager();
    const id = field(formData, "id");
    const input = warehouseSchema.parse({
      name: field(formData, "name"),
      code: field(formData, "code"),
      address: field(formData, "address"),
    });

    if (id) {
      await prisma.warehouse.update({
        where: { id },
        data: { name: input.name, code: input.code, address: input.address ?? null },
      });
    } else {
      // A new warehouse is useless without somewhere to put stock, so it comes
      // with a default stock location already created.
      await prisma.warehouse.create({
        data: {
          name: input.name,
          code: input.code,
          address: input.address ?? null,
          locations: {
            create: {
              name: `${input.code}/Stock`,
              code: "STOCK",
              type: LocationType.INTERNAL,
            },
          },
        },
      });
    }

    revalidatePath("/settings/warehouses");
    revalidatePath("/dashboard");
    return formSuccess(id ? "Warehouse updated." : "Warehouse created with a stock location.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteWarehouseAction(id: string): Promise<FormState> {
  try {
    await requireManager();

    const held = await prisma.stockQuant.count({
      where: { location: { warehouseId: id }, quantity: { not: 0 } },
    });
    if (held > 0) {
      throw new StockError(
        "This warehouse still holds stock. Move or write it off before deleting.",
      );
    }

    const documents = await prisma.picking.count({ where: { warehouseId: id } });
    if (documents > 0) {
      throw new StockError(
        `${documents} document${documents === 1 ? "" : "s"} reference this warehouse, so it cannot be deleted.`,
      );
    }

    await prisma.warehouse.delete({ where: { id } });
    revalidatePath("/settings/warehouses");
    return formSuccess("Warehouse deleted.");
  } catch (error) {
    return toFormState(error);
  }
}

// ── Locations ────────────────────────────────────────────────────────────────

export async function saveLocationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireManager();
    const id = field(formData, "id");
    const input = locationSchema.parse({
      warehouseId: field(formData, "warehouseId"),
      name: field(formData, "name"),
      code: field(formData, "code"),
      type: field(formData, "type"),
    });

    if (input.type !== LocationType.INTERNAL) {
      throw new StockError(
        "Locations inside a warehouse are always internal. The virtual locations are created by the system.",
      );
    }

    if (id) {
      await prisma.location.update({
        where: { id },
        data: { name: input.name, code: input.code },
      });
    } else {
      await prisma.location.create({
        data: {
          warehouseId: input.warehouseId,
          name: input.name,
          code: input.code,
          type: LocationType.INTERNAL,
        },
      });
    }

    revalidatePath("/settings/warehouses");
    return formSuccess(id ? "Location updated." : "Location added.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteLocationAction(id: string): Promise<FormState> {
  try {
    await requireManager();

    const held = await prisma.stockQuant.count({
      where: { locationId: id, quantity: { not: 0 } },
    });
    if (held > 0) {
      throw new StockError("This location still holds stock. Empty it before deleting.");
    }

    const referenced = await prisma.stockMove.count({
      where: { OR: [{ sourceLocationId: id }, { destLocationId: id }] },
    });
    if (referenced > 0) {
      throw new StockError(
        "This location appears in the stock ledger, which is never rewritten, so it cannot be deleted.",
      );
    }

    await prisma.location.delete({ where: { id } });
    revalidatePath("/settings/warehouses");
    return formSuccess("Location deleted.");
  } catch (error) {
    return toFormState(error);
  }
}
