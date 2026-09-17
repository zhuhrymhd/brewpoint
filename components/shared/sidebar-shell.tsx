"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Coffee } from "lucide-react";

import { cn } from "@/lib/utils";
import { StaffUserPanel } from "@/components/shared/staff-user-panel";

const STORAGE_KEY = "brewpoint-sidebar-collapsed";

export function SidebarShell() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      setCollapsed(true);
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-[11px] pt-5 pb-4",
          collapsed ? "justify-center px-0" : "px-[18px]",
        )}
      >
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-primary">
          <Coffee className="size-[19px] text-secondary" strokeWidth={1.6} />
        </div>
        {!collapsed && (
          <div className="flex flex-col gap-px">
            <span className="font-display text-base font-semibold tracking-tight text-primary">
              BrewPoint
            </span>
            <span className="text-[11px] text-muted-foreground">
              Maple &amp; Vine Coffee
            </span>
          </div>
        )}
      </div>

      <StaffUserPanel collapsed={collapsed} />

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-6 -right-3 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
      >
        <ChevronLeft
          className={cn(
            "size-3.5 transition-transform duration-200",
            collapsed && "rotate-180",
          )}
        />
      </button>
    </aside>
  );
}
