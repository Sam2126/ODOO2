/**
 * End-to-end check of the inventory flow from the problem statement.
 *
 *   1. Receive 100 kg of steel from a vendor      → stock +100
 *   2. Transfer it to the production rack          → total unchanged, location moves
 *   3. Deliver 20 to a customer                    → stock −20
 *   4. Count the rack and find 77 (3 damaged)      → stock −3
 *
 * It drives the real services — the same code the server actions call — so a
 * pass means the engine behind the UI is correct, not just that the pages
 * render. It works on a throwaway product and cleans up after itself, so it is
 * safe to run against the demo database.
 *
 * Run with: npm run verify
 */
import { LocationType, PickingType } from "@prisma/client";

import { prisma } from "../src/lib/db";
import { StockError } from "../src/lib/errors";
import { VIRTUAL_LOCATION } from "../src/lib/stock";
import * as adjustments from "../src/server/services/adjustments";
import * as pickings from "../src/server/services/pickings";

const SKU = "ZZ-VERIFY-STEEL";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (expected ${expected}, got ${actual})`}`);
}

async function onHand(productId: string, locationId: string) {
  const quant = await prisma.stockQuant.findUnique({
    where: { productId_locationId: { productId, locationId } },
    select: { quantity: true },
  });
  return quant?.quantity.toNumber() ?? 0;
}

async function main() {
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { code: "WH" } });

  const stock = await prisma.location.findUniqueOrThrow({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "STOCK" } },
  });
  const production = await prisma.location.findUniqueOrThrow({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "PROD" } },
  });
  const vendors = await prisma.location.findFirstOrThrow({
    where: { code: VIRTUAL_LOCATION.VENDORS, warehouseId: null },
  });
  const customers = await prisma.location.findFirstOrThrow({
    where: { code: VIRTUAL_LOCATION.CUSTOMERS, warehouseId: null },
  });

  // Throwaway product, so the seeded demo figures are left alone.
  await prisma.product.deleteMany({ where: { sku: SKU } });
  const product = await prisma.product.create({
    data: { sku: SKU, name: "Verification Steel", uom: "KG" },
    select: { id: true },
  });

  const createdPickings: string[] = [];
  const createdAdjustments: string[] = [];

  try {
    console.log("\nStep 1 — receive 100 kg from a vendor");
    const receipt = await pickings.createPicking(
      user.id,
      {
        type: PickingType.RECEIPT,
        warehouseId: warehouse.id,
        sourceLocationId: vendors.id,
        destLocationId: stock.id,
        partnerName: "Verification Vendor",
        scheduledAt: new Date(),
      },
      [{ productId: product.id, demandQty: 100 }],
    );
    createdPickings.push(receipt.id);
    check("reference follows WH/IN/#####", /^WH\/IN\/\d{5}$/.test(receipt.reference), true);

    await pickings.validatePicking(user.id, receipt.id);
    check("WH/Stock holds 100", await onHand(product.id, stock.id), 100);
    check("vendor location shows -100", await onHand(product.id, vendors.id), -100);

    console.log("\nStep 2 — transfer all 100 to the production rack");
    const transfer = await pickings.createPicking(
      user.id,
      {
        type: PickingType.INTERNAL,
        warehouseId: warehouse.id,
        sourceLocationId: stock.id,
        destLocationId: production.id,
        scheduledAt: new Date(),
      },
      [{ productId: product.id, demandQty: 100 }],
    );
    createdPickings.push(transfer.id);

    const availability = await pickings.checkAvailability(transfer.id);
    check("availability check marks it READY", availability.status, "READY");

    await pickings.validatePicking(user.id, transfer.id);
    check("WH/Stock is empty", await onHand(product.id, stock.id), 0);
    check("WH/Production holds 100", await onHand(product.id, production.id), 100);

    console.log("\nStep 3 — deliver 20 to a customer");
    const delivery = await pickings.createPicking(
      user.id,
      {
        type: PickingType.DELIVERY,
        warehouseId: warehouse.id,
        sourceLocationId: production.id,
        destLocationId: customers.id,
        partnerName: "Verification Customer",
        scheduledAt: new Date(),
      },
      [{ productId: product.id, demandQty: 20 }],
    );
    createdPickings.push(delivery.id);

    // The problem statement's delivery flow: pick, then pack, then validate.
    await pickings.markPickingStage(delivery.id, "picked");
    let staged = await prisma.picking.findUniqueOrThrow({ where: { id: delivery.id } });
    check("marking picked records a timestamp", staged.pickedAt !== null, true);
    check("packing has not happened yet", staged.packedAt, null);

    await pickings.markPickingStage(delivery.id, "packed");
    staged = await prisma.picking.findUniqueOrThrow({ where: { id: delivery.id } });
    check("marking packed records a timestamp", staged.packedAt !== null, true);

    check("no stock moved during pick or pack", await onHand(product.id, production.id), 100);

    await pickings.validatePicking(user.id, delivery.id);
    check("WH/Production holds 80", await onHand(product.id, production.id), 80);
    check("customer location shows 20", await onHand(product.id, customers.id), 20);

    console.log("\nStep 4 — count the rack and find 77 (3 damaged)");
    const count = await adjustments.createAdjustment(
      user.id,
      { locationId: production.id, note: "3 kg damaged in handling" },
      [{ productId: product.id, countedQty: 77 }],
    );
    createdAdjustments.push(count.id);
    check("reference follows ADJ/#####", /^ADJ\/\d{5}$/.test(count.reference), true);

    const applied = await adjustments.validateAdjustment(user.id, count.id);
    check("one product corrected", applied.corrected, 1);
    check("WH/Production holds 77", await onHand(product.id, production.id), 77);

    console.log("\nLedger");
    const moves = await prisma.stockMove.findMany({
      where: { productId: product.id },
      orderBy: { movedAt: "asc" },
      include: {
        sourceLocation: { select: { name: true } },
        destLocation: { select: { name: true } },
      },
    });
    for (const move of moves) {
      console.log(
        `  ${move.reference.padEnd(14)} ${String(move.quantity).padStart(6)} kg  ` +
          `${move.sourceLocation.name} -> ${move.destLocation.name}`,
      );
    }
    // One per document: receipt, transfer, delivery, adjustment.
    check("four movements recorded", moves.length, 4);

    console.log("\nGuard rails");

    // Over-delivering must be refused, and must leave nothing behind.
    const tooMuch = await pickings.createPicking(
      user.id,
      {
        type: PickingType.DELIVERY,
        warehouseId: warehouse.id,
        sourceLocationId: production.id,
        destLocationId: customers.id,
        partnerName: "Greedy Customer",
        scheduledAt: new Date(),
      },
      [{ productId: product.id, demandQty: 500 }],
    );
    createdPickings.push(tooMuch.id);

    let refused = false;
    try {
      await pickings.validatePicking(user.id, tooMuch.id);
    } catch (error) {
      refused = error instanceof StockError;
    }
    check("delivering more than available is refused", refused, true);
    check("stock is untouched after the refusal", await onHand(product.id, production.id), 77);
    check(
      "no partial movements were written",
      (await prisma.stockMove.count({ where: { pickingId: tooMuch.id } })),
      0,
    );
    check(
      "the rejected document is still unvalidated",
      (await prisma.picking.findUniqueOrThrow({ where: { id: tooMuch.id } })).status,
      "DRAFT",
    );

    const shortage = await pickings.checkAvailability(tooMuch.id);
    check("availability check marks it WAITING", shortage.status, "WAITING");

    // A validated document is history and must stay that way.
    let reValidateRefused = false;
    try {
      await pickings.validatePicking(user.id, receipt.id);
    } catch (error) {
      reValidateRefused = error instanceof StockError;
    }
    check("validating twice is refused", reValidateRefused, true);

    let cancelRefused = false;
    try {
      await pickings.cancelPicking(receipt.id);
    } catch (error) {
      cancelRefused = error instanceof StockError;
    }
    check("canceling a validated document is refused", cancelRefused, true);

    // A receipt must come from the vendor location, not off a real shelf.
    let badRouteRefused = false;
    try {
      await pickings.createPicking(
        user.id,
        {
          type: PickingType.RECEIPT,
          warehouseId: warehouse.id,
          sourceLocationId: stock.id,
          destLocationId: production.id,
          scheduledAt: new Date(),
        },
        [{ productId: product.id, demandQty: 1 }],
      );
    } catch (error) {
      badRouteRefused = error instanceof StockError;
    }
    check("a receipt from a real location is refused", badRouteRefused, true);

    // Pick and pack belong to deliveries only.
    let pickOnReceiptRefused = false;
    try {
      await pickings.markPickingStage(receipt.id, "picked");
    } catch (error) {
      pickOnReceiptRefused = error instanceof StockError;
    }
    check("picking a receipt is refused", pickOnReceiptRefused, true);

    // Counting a virtual location makes no physical sense.
    let virtualCountRefused = false;
    try {
      await adjustments.assertCountableLocation(vendors.id);
    } catch (error) {
      virtualCountRefused = error instanceof StockError;
    }
    check("counting a virtual location is refused", virtualCountRefused, true);

    console.log("\nAccounting identity");
    const all = await prisma.stockQuant.findMany({
      where: { productId: product.id },
      include: { location: { select: { type: true } } },
    });
    const net = all.reduce((sum, quant) => sum + quant.quantity.toNumber(), 0);
    const real = all
      .filter((quant) => quant.location.type === LocationType.INTERNAL)
      .reduce((sum, quant) => sum + quant.quantity.toNumber(), 0);
    check("every location sums to zero", net, 0);
    check("real locations hold 77", real, 77);
  } finally {
    await prisma.adjustment.deleteMany({ where: { id: { in: createdAdjustments } } });
    await prisma.picking.deleteMany({ where: { id: { in: createdPickings } } });
    await prisma.product.deleteMany({ where: { sku: SKU } });
  }

  console.log(
    `\n${failures === 0 ? "All checks passed" : `${failures} CHECK(S) FAILED`} — ${checks - failures}/${checks}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
