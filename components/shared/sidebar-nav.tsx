"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  Package,
  Tag,
  Receipt,
  LayoutDashboard,
  Users,
  Coffee,
} from "lucide-react";

import { ROUTE_ROLES } from "@/lib/route-roles";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ROUTE_ROLES["/dashboard"],
  },
  {
    href: "/checkout",
    label: "Checkout",
    icon: ShoppingCart,
    roles: ROUTE_ROLES["/checkout"],
  },
  {
    href: "/products",
    label: "Products",
    icon: Coffee,
    roles: ROUTE_ROLES["/products"],
  },
  {
    href: "/categories",
    label: "Categories",
    icon: Tag,
    roles: ROUTE_ROLES["/categories"],
  },
  { href: "/users", label: "Users", icon: Users, roles: ROUTE_ROLES["/users"] },
  {
    href: "/stock",
    label: "Stock",
    icon: Package,
    roles: ROUTE_ROLES["/stock"],
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: Receipt,
    roles: ROUTE_ROLES["/transactions"],
  },
];

export function SidebarNav({
  role,
  collapsed,
}: {
  role: "admin" | "cashier";
  collapsed: boolean;
}) {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const pathname = usePathname();

  return (
    <>
      {!collapsed && (
        <div className="px-3 pt-1 pb-1.5">
          <span className="pl-3 text-[10.5px] font-semibold tracking-[.09em] text-[#9AA1AB]">
            MENU
          </span>
        </div>
      )}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-auto px-3",
          collapsed && "items-center px-2",
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-[11px] rounded-md px-3 py-[9px] text-sm",
                collapsed && "justify-center px-2.5",
                pathname === item.href
                  ? "bg-icon-chip-background font-semibold text-primary"
                  : "font-medium text-muted-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
