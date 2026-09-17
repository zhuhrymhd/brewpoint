import { AlertTriangle } from "lucide-react";

import type { Product } from "@/lib/types";
import { getStockStatus } from "@/lib/product-status";
import { cn } from "@/lib/utils";

export function LowStock({ products }: { products: Product[] }) {
  const lowStockProducts = [...products]
    .filter((p) => getStockStatus(p.stockQuantity) !== "in-stock")
    .sort((a, b) => a.stockQuantity - b.stockQuantity);

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <AlertTriangle className="size-4 text-warning" />
        <h3 className="font-display text-base font-semibold text-primary">
          Low stock
        </h3>
      </div>
      <div className="flex flex-col">
        {lowStockProducts.map((product, i) => {
          const isOut =
            getStockStatus(product.stockQuantity) === "out-of-stock";
          return (
            <div
              key={product.id}
              className={cn(
                "flex items-center justify-between py-2.5",
                i < lowStockProducts.length - 1 && "border-b border-[#F1F0EC]",
              )}
            >
              <span className="text-[13.5px] font-medium text-foreground">
                {product.name}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  isOut
                    ? "bg-destructive-subtle text-destructive-subtle-foreground"
                    : "bg-warning-subtle text-warning-subtle-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isOut ? "bg-destructive" : "bg-warning",
                  )}
                />
                {isOut ? "Out of stock" : `${product.stockQuantity} left`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
