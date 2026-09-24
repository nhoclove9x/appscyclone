import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthMeQuery } from "../api/queries";
import { LoadingSkeleton } from "../components/LoadingSkeleton";

export function AuthenticatedRoute() {
  const auth = useAuthMeQuery();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <LoadingSkeleton label="Checking authentication" />
      </div>
    );
  }

  if (auth.isError) {
    return (
      <Navigate
        replace
        state={{ reason: "session-expired", from: location.pathname }}
        to="/login"
      />
    );
  }

  return <Outlet />;
}
