import type { Metadata } from "next";

import { ProductForm } from "@/components/products/product-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { listWarehousesWithLocations } from "@/server/queries/documents";
import { listCategories } from "@/server/queries/products";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const [categories, warehouses] = await Promise.all([
    listCategories(),
    listWarehousesWithLocations(),
  ]);

  const locations = warehouses.flatMap((warehouse) =>
    warehouse.locations.map((location) => ({
      id: location.id,
      name: location.name,
      warehouseName: warehouse.name,
    })),
  );

  return (
    <>
      <PageHeader
        title="New product"
        description="Name, SKU, unit of measure and category. Opening stock is optional."
        actions={
          <ButtonLink href="/products" variant="ghost">
            Cancel
          </ButtonLink>
        }
      />
      <ProductForm categories={categories} locations={locations} />
    </>
  );
}
