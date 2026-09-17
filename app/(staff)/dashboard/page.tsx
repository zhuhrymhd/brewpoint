"use client";

import { useMemo, useState } from "react";
import { PieChart } from "lucide-react";

import type { DashboardPeriod, StatDelta } from "@/lib/types";
import { useDashboardSummary, useBestSellers } from "@/hooks/use-dashboard";
import { useProducts } from "@/hooks/use-products";
import { formatUSD } from "@/lib/format-currency";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { BestSellers } from "@/components/dashboard/best-sellers";
import { LowStock } from "@/components/dashboard/low-stock";

function getPeriodBounds(period: DashboardPeriod) {
  const to = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (period === "week") from.setDate(from.getDate() - 6);
  if (period === "month") from.setDate(from.getDate() - 29);
  return { from, to };
}

function getPreviousPeriodBounds(from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - duration),
    to: new Date(from.getTime()),
  };
}

function getDateLabel(from: Date, to: Date, period: DashboardPeriod) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return period === "today" ? fmt(to) : `${fmt(from)} – ${fmt(to)}`;
}

function getDeltaNote(period: DashboardPeriod) {
  if (period === "today") return "vs yesterday";
  if (period === "week") return "vs last week";
  return "vs prev. 30 days";
}

function computeDelta(current: number, previous: number): StatDelta {
  if (previous === 0) {
    return current === 0 ? { text: "—", up: true } : { text: "↑ new", up: true };
  }
  const pct = ((current - previous) / previous) * 100;
  return {
    text: `${pct >= 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(1)}%`,
    up: pct >= 0,
  };
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  // Memoized on `period` only — computing `new Date()` fresh on every render
  // (instead of once per period change) fed a constantly-changing `to` into
  // the TanStack Query key below, which triggered an infinite refetch loop
  // (every fetch success re-rendered the component, which produced a new
  // `to`, which looked like a new query). Found via Playwright UI testing —
  // a curl-only smoke test can't catch a render-loop like this.
  const { from, to } = useMemo(() => getPeriodBounds(period), [period]);
  const { from: prevFrom, to: prevTo } = useMemo(
    () => getPreviousPeriodBounds(from, to),
    [from, to],
  );

  const { data: summary } = useDashboardSummary({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const { data: prevSummary } = useDashboardSummary({
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
  });
  const { data: bestSellers } = useBestSellers({
    from: from.toISOString(),
    to: to.toISOString(),
    limit: 5,
  });
  const { data: productsData } = useProducts({ pageSize: 1000 });

  const totalSales = Number(summary?.totalSales ?? "0");
  const transactionCount = summary?.transactionCount ?? 0;
  const avgTicket = transactionCount > 0 ? totalSales / transactionCount : 0;

  const prevTotalSales = Number(prevSummary?.totalSales ?? "0");
  const prevTransactionCount = prevSummary?.transactionCount ?? 0;
  const prevAvgTicket =
    prevTransactionCount > 0 ? prevTotalSales / prevTransactionCount : 0;

  const hasNoSales = transactionCount === 0;
  const periodLabel =
    period === "today"
      ? "today"
      : period === "week"
        ? "the last 7 days"
        : "the last 30 days";

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        period={period}
        onPeriodChange={setPeriod}
        dateLabel={getDateLabel(from, to, period)}
      />

      {hasNoSales ? (
        <div className="flex flex-1 items-center justify-center p-16">
          <EmptyState
            icon={<PieChart className="size-7" />}
            title="No sales yet"
            description={`No transactions recorded for ${periodLabel}.`}
          />
        </div>
      ) : (
        <>
          <StatsGrid
            totalSales={formatUSD(totalSales)}
            transactionCount={transactionCount}
            avgTicket={formatUSD(avgTicket)}
            deltas={{
              sales: computeDelta(totalSales, prevTotalSales),
              txns: computeDelta(transactionCount, prevTransactionCount),
              avg: computeDelta(avgTicket, prevAvgTicket),
            }}
            deltaNote={getDeltaNote(period)}
          />

          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
            <BestSellers items={bestSellers ?? []} />
            <LowStock products={productsData?.items ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
