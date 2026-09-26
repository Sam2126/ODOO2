import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";
import { listProductsNeedingReorder } from "@/server/queries/products";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Middleware already turned anonymous visitors away; this is the second gate
  // that makes every page under (app) safe on its own.
  const user = await requireUser();
  const needingReorder = await listProductsNeedingReorder();

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      lowStockCount={needingReorder.length}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
