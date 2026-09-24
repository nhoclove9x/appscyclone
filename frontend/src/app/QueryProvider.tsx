import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../api/client";

function createQueryClient(onProtectedUnauthorized: () => void): QueryClient {
  const clientRef: { current?: QueryClient } = {};
  const handleProtectedUnauthorized = (error: unknown): void => {
    if (error instanceof ApiError && error.status === 401) {
      clientRef.current?.removeQueries({ queryKey: ["auth", "me"] });
      onProtectedUnauthorized();
    }
  };
  const queryCache = new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] !== "auth") {
        handleProtectedUnauthorized(error);
      }
    },
  });
  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.mutationKey?.[0] === "auth") {
        return;
      }

      handleProtectedUnauthorized(error);
    },
  });

  const client = new QueryClient({
    mutationCache,
    queryCache,
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) {
            return false;
          }

          return failureCount < 1;
        },
      },
    },
  });
  clientRef.current = client;

  return client;
}

export function QueryProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const [queryClient] = useState(() =>
    createQueryClient(() => {
      void navigate("/login", {
        replace: true,
        state: { reason: "session-expired" },
      });
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
