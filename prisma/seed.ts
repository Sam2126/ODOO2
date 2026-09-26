/**
 * Idempotent seed: safe to run repeatedly.
 *
 * Opening balances are booked through `applyMove` rather than written straight
 * into StockQuant, so the ledger is correct from the very first row and the
 * seed exercises the same code path the app does.
 *
 * Run with: npm run db:seed
 */
import { LocationType, PickingType, Prisma, Role, Uom } from "@prisma/client";

import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/db";
import { pickingPrefix, nextReference } from "../src/lib/refs";
import { applyMove, VIRTUAL_LOCATION } from "../src/lib/stock";

const OPENING_REFERENCE = "ADJ/OPENING";
const DEMO_PASSWORD = "stocksense123";

const dec = (value: number) => new Prisma.Decimal(value);

async function ensureVirtualLocation(name: string, code: string, type: LocationType) {
  const existing = await prisma.location.findFirst({ where: { code, warehouseId: null } });
  if (existing) return existing;
  // Postgres treats NULLs as distinct, so @@unique([warehouseId, code]) cannot
  // enforce this for warehouse-less rows — hence find-then-create.
  return prisma.location.create({ data: { name, code, type, warehouseId: null } });
}

async function main() {
  console.info("Seeding StockSense…");

  // ── People ────────────────────────────────────────────────────────────────
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const manager = await prisma.user.upsert({
    where: { email: "manager@stocksense.app" },
    update: {},
    create: {
      name: "Priya Nair",
      email: "manager@stocksense.app",
      passwordHash,
      role: Role.MANAGER,
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@stocksense.app" },
    update: {},
    create: {
      name: "Arjun Mehta",
      email: "staff@stocksense.app",
      passwordHash,
      role: Role.STAFF,
    },
  });

  // ── Warehouses and their real locations ───────────────────────────────────
  const main = await prisma.warehouse.upsert({
    where: { code: "WH" },
    update: {},
    create: { name: "Main Warehouse", code: "WH", address: "Plot 14, Sector 34, Gurugram" },
  });

  const second = await prisma.warehouse.upsert({
    where: { code: "WH2" },
    update: {},
    create: { name: "Secondary Warehouse", code: "WH2", address: "Sitapura Industrial Area, Jaipur" },
  });

  const locationSpecs = [
    { warehouse: main, code: "STOCK", name: "WH/Stock" },
    { warehouse: main, code: "PROD", name: "WH/Production" },
    { warehouse: main, code: "RACK-A", name: "WH/Rack-A" },
    { warehouse: main, code: "RACK-B", name: "WH/Rack-B" },
    { warehouse: second, code: "STOCK", name: "WH2/Stock" },
    { warehouse: second, code: "RACK-A", name: "WH2/Rack-A" },
  ];

  const locations = new Map<string, string>();
  for (const spec of locationSpecs) {
    const location = await prisma.location.upsert({
      where: { warehouseId_code: { warehouseId: spec.warehouse.id, code: spec.code } },
      update: { name: spec.name },
      create: {
        warehouseId: spec.warehouse.id,
        code: spec.code,
        name: spec.name,
        type: LocationType.INTERNAL,
      },
    });
    locations.set(`${spec.warehouse.code}/${spec.code}`, location.id);
  }

  // ── Virtual locations: the counterparties every move needs ────────────────
  const vendors = await ensureVirtualLocation(
    "Partners/Vendors",
    VIRTUAL_LOCATION.VENDORS,
    LocationType.VENDOR,
  );
  const customers = await ensureVirtualLocation(
    "Partners/Customers",
    VIRTUAL_LOCATION.CUSTOMERS,
    LocationType.CUSTOMER,
  );
  await ensureVirtualLocation(
    "Virtual/Adjustment",
    VIRTUAL_LOCATION.ADJUSTMENT,
    LocationType.ADJUSTMENT,
  );

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const categoryNames = ["Raw Material", "Hardware", "Furniture", "Packaging"];
  const categories = new Map<string, string>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories.set(name, category.id);
  }

  const productSpecs = [
    { sku: "STL-ROD-12", name: "Steel Rod 12mm", category: "Raw Material", uom: Uom.KG, cost: 62, sale: 88 },
    { sku: "STL-SHT-2", name: "Steel Sheet 2mm", category: "Raw Material", uom: Uom.KG, cost: 74, sale: 105 },
    { sku: "ALU-ING-01", name: "Aluminium Ingot", category: "Raw Material", uom: Uom.KG, cost: 218, sale: 280 },
    { sku: "BLT-M8-50", name: "Hex Bolt M8 x 50", category: "Hardware", uom: Uom.UNIT, cost: 4.5, sale: 9 },
    { sku: "NUT-M8", name: "Hex Nut M8", category: "Hardware", uom: Uom.UNIT, cost: 1.8, sale: 4 },
    { sku: "WSH-M8", name: "Washer M8", category: "Hardware", uom: Uom.UNIT, cost: 0.9, sale: 2.5 },
    { sku: "HNG-SS-4", name: "Stainless Hinge 4in", category: "Hardware", uom: Uom.UNIT, cost: 96, sale: 149 },
    { sku: "CHR-OAK-01", name: "Oak Office Chair", category: "Furniture", uom: Uom.UNIT, cost: 4200, sale: 6500 },
    { sku: "TBL-OAK-180", name: "Oak Desk 180cm", category: "Furniture", uom: Uom.UNIT, cost: 9800, sale: 14500 },
    { sku: "CAB-STL-3D", name: "Steel Cabinet 3-Drawer", category: "Furniture", uom: Uom.UNIT, cost: 7300, sale: 10900 },
    { sku: "BOX-C5-L", name: "Corrugated Box Large", category: "Packaging", uom: Uom.BOX, cost: 28, sale: 45 },
    { sku: "WRP-STR-500", name: "Stretch Wrap 500mm", category: "Packaging", uom: Uom.UNIT, cost: 340, sale: 520 },
  ];

  const products = new Map<string, string>();
  for (const spec of productSpecs) {
    const product = await prisma.product.upsert({
      where: { sku: spec.sku },
      update: {},
      create: {
        sku: spec.sku,
        name: spec.name,
        uom: spec.uom,
        categoryId: categories.get(spec.category)!,
        costPrice: dec(spec.cost),
        salePrice: dec(spec.sale),
      },
    });
    products.set(spec.sku, product.id);
  }

  // ── Opening balances, booked through the real stock engine ────────────────
  const alreadyOpened = await prisma.stockMove.findFirst({
    where: { reference: OPENING_REFERENCE },
    select: { id: true },
  });

  if (!alreadyOpened) {
    const adjustmentLocationId = (await prisma.location.findFirstOrThrow({
      where: { code: VIRTUAL_LOCATION.ADJUSTMENT, warehouseId: null },
      select: { id: true },
    })).id;

    // Deliberately uneven: some products sit below their reorder minimum and
    // two are out of stock entirely, so the dashboard has something to say.
    const openingBalances: Array<{ sku: string; location: string; qty: number }> = [
      { sku: "STL-ROD-12", location: "WH/STOCK", qty: 420 },
      { sku: "STL-SHT-2", location: "WH/STOCK", qty: 1150 },
      { sku: "ALU-ING-01", location: "WH/RACK-A", qty: 260 },
      { sku: "NUT-M8", location: "WH/RACK-B", qty: 4800 },
      { sku: "HNG-SS-4", location: "WH/RACK-B", qty: 340 },
      { sku: "CHR-OAK-01", location: "WH/STOCK", qty: 38 },
      { sku: "TBL-OAK-180", location: "WH/STOCK", qty: 12 },
      { sku: "CAB-STL-3D", location: "WH2/STOCK", qty: 24 },
      { sku: "BOX-C5-L", location: "WH/STOCK", qty: 60 },
      { sku: "WRP-STR-500", location: "WH2/RACK-A", qty: 85 },
      // BLT-M8-50 and WSH-M8 are intentionally left at zero.
    ];

    await prisma.$transaction(async (tx) => {
      for (const balance of openingBalances) {
        await applyMove(tx, {
          productId: products.get(balance.sku)!,
          quantity: dec(balance.qty),
          sourceLocationId: adjustmentLocationId,
          destLocationId: locations.get(balance.location)!,
          reference: OPENING_REFERENCE,
          userId: manager.id,
        });
      }
    });
    console.info(`  · booked ${openingBalances.length} opening balances`);
  }

  // ── Reordering rules ──────────────────────────────────────────────────────
  const rules = [
    { sku: "STL-ROD-12", warehouse: main, min: 500, max: 2000 },
    { sku: "BLT-M8-50", warehouse: main, min: 1000, max: 5000 },
    { sku: "WSH-M8", warehouse: main, min: 800, max: 4000 },
    { sku: "BOX-C5-L", warehouse: main, min: 100, max: 500 },
    { sku: "CHR-OAK-01", warehouse: main, min: 25, max: 120 },
  ];

  for (const rule of rules) {
    await prisma.reorderRule.upsert({
      where: {
        productId_warehouseId: {
          productId: products.get(rule.sku)!,
          warehouseId: rule.warehouse.id,
        },
      },
      update: { minQty: dec(rule.min), maxQty: dec(rule.max) },
      create: {
        productId: products.get(rule.sku)!,
        warehouseId: rule.warehouse.id,
        minQty: dec(rule.min),
        maxQty: dec(rule.max),
      },
    });
  }

  // ── A few open documents, so the dashboard counters are not all zero ──────
  const existingDrafts = await prisma.picking.count();
  if (existingDrafts === 0) {
    const drafts = [
      {
        type: PickingType.RECEIPT,
        partnerName: "Bharat Steel Traders",
        source: vendors.id,
        dest: locations.get("WH/STOCK")!,
        warehouseId: main.id,
        lines: [
          { sku: "STL-ROD-12", qty: 800 },
          { sku: "STL-SHT-2", qty: 400 },
        ],
      },
      {
        type: PickingType.RECEIPT,
        partnerName: "Precision Fasteners Pvt Ltd",
        source: vendors.id,
        dest: locations.get("WH/RACK-B")!,
        warehouseId: main.id,
        lines: [
          { sku: "BLT-M8-50", qty: 5000 },
          { sku: "WSH-M8", qty: 5000 },
        ],
      },
      {
        type: PickingType.DELIVERY,
        partnerName: "Nexus Interiors",
        source: locations.get("WH/STOCK")!,
        dest: customers.id,
        warehouseId: main.id,
        lines: [{ sku: "CHR-OAK-01", qty: 10 }],
      },
      {
        type: PickingType.INTERNAL,
        partnerName: undefined,
        source: locations.get("WH/STOCK")!,
        dest: locations.get("WH/PROD")!,
        warehouseId: main.id,
        lines: [{ sku: "STL-ROD-12", qty: 120 }],
      },
    ];

    for (const draft of drafts) {
      await prisma.$transaction(async (tx) => {
        const warehouseCode = draft.warehouseId === main.id ? main.code : second.code;
        const reference = await nextReference(tx, pickingPrefix(draft.type, warehouseCode));
        await tx.picking.create({
          data: {
            reference,
            type: draft.type,
            partnerName: draft.partnerName,
            sourceLocationId: draft.source,
            destLocationId: draft.dest,
            warehouseId: draft.warehouseId,
            createdById: manager.id,
            lines: {
              create: draft.lines.map((line) => ({
                productId: products.get(line.sku)!,
                demandQty: dec(line.qty),
              })),
            },
          },
        });
      });
    }
    console.info(`  · created ${drafts.length} draft documents`);
  }

  console.info("\nSeed complete.");
  console.info("  Manager  manager@stocksense.app  /  " + DEMO_PASSWORD);
  console.info("  Staff    staff@stocksense.app    /  " + DEMO_PASSWORD);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
