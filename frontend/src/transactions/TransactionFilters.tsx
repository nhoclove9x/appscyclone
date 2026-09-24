import { useForm } from "react-hook-form";

import type {
  Exchange,
  TradeSide,
  TransactionFilters as Filters,
} from "../api/types";
import {
  apiUtcToInput,
  searchParamsFromFilters,
  utcInputToApi,
} from "./transactionFilterUtils";

interface FilterFormValues {
  readonly symbol: string;
  readonly exchange: "" | Exchange;
  readonly side: "" | TradeSide;
  readonly from: string;
  readonly to: string;
  readonly sort: "ASC" | "DESC";
  readonly pageSize: "25" | "50" | "100";
}

export function TransactionFilters({
  filters,
  symbols,
  onChange,
}: {
  readonly filters: Filters;
  readonly symbols: readonly string[];
  readonly onChange: (params: URLSearchParams) => void;
}) {
  const { handleSubmit, register, reset } = useForm<FilterFormValues>({
    values: {
      symbol: filters.symbol ?? "",
      exchange: filters.exchange ?? "",
      side: filters.side ?? "",
      from: apiUtcToInput(filters.from),
      to: apiUtcToInput(filters.to),
      sort: filters.sort,
      pageSize: String(filters.pageSize) as FilterFormValues["pageSize"],
    },
  });

  function apply(values: FilterFormValues): void {
    const from = utcInputToApi(values.from);
    const to = utcInputToApi(values.to);

    onChange(
      searchParamsFromFilters({
        ...(values.symbol.length === 0 ? {} : { symbol: values.symbol }),
        ...(values.exchange === "" ? {} : { exchange: values.exchange }),
        ...(values.side === "" ? {} : { side: values.side }),
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
        sort: values.sort,
        page: 1,
        pageSize: Number.parseInt(values.pageSize, 10),
      }),
    );
  }

  return (
    <form
      className="card grid gap-5 p-4"
      onSubmit={(event) => {
        void handleSubmit(apply)(event);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          Symbol
          <input
            className="focus-ring min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            list="transaction-symbols"
            placeholder="All symbols"
            {...register("symbol")}
          />
          <datalist id="transaction-symbols">
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol} />
            ))}
          </datalist>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          Exchange
          <select
            className="focus-ring min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            {...register("exchange")}
          >
            <option value="">All</option>
            <option value="Binance">Binance</option>
            <option value="Coinbase">Coinbase</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          Side
          <select
            className="focus-ring min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            {...register("side")}
          >
            <option value="">All</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          From UTC
          <input
            className="focus-ring min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            type="datetime-local"
            {...register("from")}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          To UTC
          <input
            className="focus-ring min-w-0 rounded-xl border border-slate-300 px-3 py-2"
            type="datetime-local"
            {...register("to")}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(12rem,16rem)_minmax(10rem,14rem)_auto] md:items-end">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Sort
          <select
            className="focus-ring rounded-xl border border-slate-300 px-3 py-2"
            {...register("sort")}
          >
            <option value="ASC">Oldest first</option>
            <option value="DESC">Newest first</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Page size
          <select
            className="focus-ring rounded-xl border border-slate-300 px-3 py-2"
            {...register("pageSize")}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button
            className="focus-ring rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            type="submit"
          >
            Apply filters
          </button>
          <button
            className="focus-ring rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              reset();
              onChange(
                searchParamsFromFilters({ sort: "ASC", page: 1, pageSize: 50 }),
              );
            }}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
