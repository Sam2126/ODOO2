import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Package,
  Tags,
  User,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@prisma/client";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from warehouse staff; the matching actions re-check server-side. */
  managerOnly?: boolean;
};

export type NavGroup = {
  group: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    group: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Products",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/settings/categories", label: "Categories", icon: Tags, managerOnly: true },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/receipts", label: "Receipts", icon: ArrowDownToLine },
      { href: "/deliveries", label: "Delivery Orders", icon: ArrowUpFromLine },
      { href: "/transfers", label: "Internal Transfers", icon: ArrowLeftRight },
      { href: "/adjustments", label: "Adjustments", icon: ClipboardCheck },
      { href: "/moves", label: "Move History", icon: History },
    ],
  },
  {
    group: "Settings",
    items: [
      { href: "/settings/warehouses", label: "Warehouses", icon: Warehouse, managerOnly: true },
      { href: "/profile", label: "My Profile", icon: User },
    ],
  },
];

export function navFor(role: Role): NavGroup[] {
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.managerOnly || role === "MANAGER"),
  })).filter((group) => group.items.length > 0);
}
