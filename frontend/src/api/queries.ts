import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, ApiError } from "./client";
import type { TransactionFilters } from "./types";

export const queryKeys = {
  authMe: ["auth", "me"] as const,
  portfolio: ["portfolio"] as const,
  transactions: (filters: TransactionFilters) =>
    ["transactions", filters] as const,
  transactionsRoot: ["transactions"] as const,
};

export function useAuthMeQuery() {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: () => api.me(),
    retry: false,
  });
}

export function usePortfolioQuery() {
  return useQuery({
    queryKey: queryKeys.portfolio,
    queryFn: () => api.portfolio(),
  });
}

export function useTransactionsQuery(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => api.transactions(filters),
    placeholderData: (previous) => previous,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: (input: { readonly email: string; readonly password: string }) =>
      api.login(input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.authMe, data);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["auth", "logout"],
    mutationFn: () => api.logout(),
    onSettled: () => {
      queryClient.clear();
    },
  });
}

export function useImportTradesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["imports", "trades"],
    mutationFn: (file: File) => api.importTrades(file),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transactionsRoot,
        }),
      ]);
    },
  });
}

export function useResetSampleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["datasets", "reset-sample"],
    mutationFn: () => api.resetSampleData(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transactionsRoot,
        }),
      ]);
    },
  });
}

export function useClearTransactionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["datasets", "clear-transactions"],
    mutationFn: () => api.clearTransactions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.transactionsRoot,
        }),
      ]);
    },
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
