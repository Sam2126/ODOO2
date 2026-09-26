import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";
import { listProductsNeedingReorder } from "@/server/queries/products";

export default async function AppLayout({
children,
}: LayoutProps<"/">) {
// Protect the entire application section at the server level.
const user = await requireUser();

const [needingReorder] = await Promise.all([
listProductsNeedingReorder(),
]);

const userData = {
name: user.name,
email: user.email,
role: user.role,
};

return ( <AppShell
   user={userData}
   lowStockCount={needingReorder.length}
   logoutAction={logoutAction}
 >
{children} </AppShell>
);
}
