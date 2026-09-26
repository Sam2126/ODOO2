import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/card";
import { requireManager } from "@/lib/auth";
import { listCategories } from "@/server/queries/products";

import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireManager();
  const categories = await listCategories();

  return (
    <>
      <PageHeader
        title="Product categories"
        description="A category with products in it cannot be deleted until they are moved elsewhere."
      />
      <CategoriesManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          productCount: category._count.products,
        }))}
      />
    </>
  );
}
