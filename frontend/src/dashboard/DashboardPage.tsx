import { isApiError, usePortfolioQuery } from "../api/queries";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { formatUtcDateTime } from "../format/formatters";
import { HoldingsTable } from "./HoldingsTable";
import { KpiCard } from "./KpiCard";
import { AllocationChart, PnlChart } from "./PortfolioCharts";

export function DashboardPage() {
  const portfolio = usePortfolioQuery();

  if (portfolio.isLoading) {
    return <LoadingSkeleton label="Loading portfolio" />;
  }

  if (portfolio.isError) {
    return (
      <ErrorState title="Unable to load portfolio">
        {isApiError(portfolio.error)
          ? portfolio.error.message
          : "The portfolio API could not be reached."}
      </ErrorState>
    );
  }

  const data = portfolio.data;

  if (data === undefined) {
    return (
      <ErrorState title="Portfolio unavailable">
        The portfolio response was empty.
      </ErrorState>
    );
  }

  return (
    <>
      <PageHeader
        actions={<StatusBadge tone="info">{data.dataset.source}</StatusBadge>}
        description={`Price snapshot: ${formatUtcDateTime(data.priceSnapshot.asOf)} UTC · Dataset created ${formatUtcDateTime(data.dataset.createdAt)} UTC`}
        title="Portfolio dashboard"
      />

      <section
        aria-label="Portfolio key performance indicators"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
      >
        <KpiCard label="Current Value" value={data.totals.currentValue} />
        <KpiCard
          label="Remaining Cost Basis"
          value={data.totals.remainingCostBasis}
        />
        <KpiCard label="Realized P&L" signed value={data.totals.realizedPL} />
        <KpiCard
          label="Unrealized P&L"
          signed
          value={data.totals.unrealizedPL}
        />
        <KpiCard label="Total P&L" signed value={data.totals.totalPL} />
        <KpiCard label="Fees" value={data.totals.fees} />
      </section>

      {data.performance.length === 0 ? (
        <EmptyState title="No portfolio activity">
          There are no symbols to display for the active dataset.
        </EmptyState>
      ) : (
        <>
          <HoldingsTable holdings={data.holdings} />
          <div className="grid gap-6 xl:grid-cols-2">
            <AllocationChart holdings={data.holdings} />
            <PnlChart performance={data.performance} />
          </div>
        </>
      )}
    </>
  );
}
