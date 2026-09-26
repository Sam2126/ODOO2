"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StockError } from "@/lib/errors";
import { field, formSuccess, toFormState, type FormState } from "@/lib/forms";
import { applyMove, virtualLocationId, VIRTUAL_LOCATION } from "@/lib/stock";
import { openingStockSchema, productSchema, reorderRuleSchema } from "@/lib/validators";

const OPENING_REFERENCE = "ADJ/OPENING";

function revalidateProduct(id?: string) {
  revalidatePath("/products");
  if (id) revalidatePath(`/products/${id}`);
  revalidatePath("/dashboard");
}

function readProductInput(formData: FormData) {
  return productSchema.parse({
    name: field(formData, "name"),
    sku: field(formData, "sku"),
    uom: field(formData, "uom"),
    categoryId: field(formData, "categoryId"),
    costPrice: field(formData, "costPrice"),
    salePrice: field(formData, "salePrice"),
    // An unchecked checkbox submits nothing at all. Treating "absent" as true
    // meant the box could be ticked but never cleared; the form always renders
    // it, so absent genuinely means unchecked.
    isActive: formData.get("isActive") === "on",
  });
}

const toDecimal = (value: number | undefined) =>
  value === undefined ? null : new Prisma.Decimal(value);

export async function createProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let destination = "";

  try {
    const user = await requireUser();
    const input = readProductInput(formData);

    // Opening stock is optional; when given it is booked as a real movement so
    // the ledger explains where the quantity came from.
    const openingLocationId = field(formData, "openingLocationId");
    const openingQtyRaw = field(formData, "openingQty");
    const opening =
      openingLocationId && openingQtyRaw
        ? openingStockSchema.parse({ locationId: openingLocationId, quantity: openingQtyRaw })
        : null;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: input.name,
          sku: input.sku,
          uom: input.uom,
          categoryId: input.categoryId ?? null,
          costPrice: toDecimal(input.costPrice),
          salePrice: toDecimal(input.salePrice),
          isActive: input.isActive,
        },
        select: { id: true },
      });

      if (opening) {
        await applyMove(tx, {
          productId: created.id,
          quantity: new Prisma.Decimal(opening.quantity),
          sourceLocationId: await virtualLocationId(tx, VIRTUAL_LOCATION.ADJUSTMENT),
          destLocationId: opening.locationId,
          reference: OPENING_REFERENCE,
          userId: user.id,
        });
      }

      return created;
    });

    revalidateProduct();
    revalidatePath("/moves");
    destination = `/products/${product.id}`;
  } catch (error) {
    return toFormState(error);
  }

  redirect(destination);
}

export async function updateProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireUser();
    const id = field(formData, "id");
    if (!id) throw new StockError("Missing product reference.");

    const input = readProductInput(formData);

    await prisma.product.update({
      where: { id },
      data: {
        name: input.name,
        sku: input.sku,
        uom: input.uom,
        categoryId: input.categoryId ?? null,
        costPrice: toDecimal(input.costPrice),
        salePrice: toDecimal(input.salePrice),
        isActive: input.isActive,
      },
    });

    revalidateProduct(id);
    return formSuccess("Product updated.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function saveReorderRuleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireUser();
    const input = reorderRuleSchema.parse({
      productId: field(formData, "productId"),
      warehouseId: field(formData, "warehouseId"),
      minQty: field(formData, "minQty") ?? "0",
      maxQty: field(formData, "maxQty") ?? "0",
    });

    await prisma.reorderRule.upsert({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      update: {
        minQty: new Prisma.Decimal(input.minQty),
        maxQty: new Prisma.Decimal(input.maxQty),
      },
      create: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        minQty: new Prisma.Decimal(input.minQty),
        maxQty: new Prisma.Decimal(input.maxQty),
      },
    });

    revalidateProduct(input.productId);
    revalidatePath("/", "layout");
    return formSuccess("Reordering rule saved.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteReorderRuleAction(ruleId: string): Promise<FormState> {
  try {
    await requireUser();
    const rule = await prisma.reorderRule.delete({
      where: { id: ruleId },
      select: { productId: true },
    });

    revalidateProduct(rule.productId);
    revalidatePath("/", "layout");
    return formSuccess("Reordering rule removed.");
  } catch (error) {
    return toFormState(error);
  }
}

/**
 * Products are archived rather than deleted: their SKU appears on validated
 * documents, and the ledger must keep naming something real.
 */
export async function toggleProductActiveAction(id: string): Promise<FormState> {
  try {
    await requireUser();
    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
      select: { isActive: true },
    });

    await prisma.product.update({ where: { id }, data: { isActive: !product.isActive } });
    revalidateProduct(id);
    return formSuccess(product.isActive ? "Product archived." : "Product restored.");
  } catch (error) {
    return toFormState(error);
  }
}
