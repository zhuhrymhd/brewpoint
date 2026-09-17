import type { ReactNode } from "react";
import { SidebarShell } from "@/components/shared/sidebar-shell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <SidebarShell />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
