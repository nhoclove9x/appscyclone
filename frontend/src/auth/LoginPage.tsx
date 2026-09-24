import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { isApiError, useAuthMeQuery, useLoginMutation } from "../api/queries";

interface LoginFormValues {
  readonly email: string;
  readonly password: string;
}

function sessionExpired(locationState: unknown): boolean {
  return (
    typeof locationState === "object" &&
    locationState !== null &&
    "reason" in locationState &&
    locationState.reason === "session-expired"
  );
}

export function LoginPage() {
  const auth = useAuthMeQuery();
  const login = useLoginMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  if (auth.isSuccess) {
    return <Navigate replace to="/" />;
  }

  const loginError =
    login.error === null
      ? undefined
      : isApiError(login.error)
        ? login.error.message
        : "Unable to sign in.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="card w-full max-w-md p-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-700">
            AppsCyclone
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Sign in to portfolio analytics
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use the evaluator account provisioned for this assessment.
          </p>
        </div>

        {sessionExpired(location.state) ? (
          <div
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            role="status"
          >
            Your session expired. Please sign in again.
          </div>
        ) : null}

        {loginError === undefined ? null : (
          <div
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
            role="alert"
          >
            {loginError}
          </div>
        )}

        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            void handleSubmit((values) => {
              login.mutate(values, {
                onSuccess: () => {
                  void navigate("/", { replace: true });
                },
              });
            })(event);
          }}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Email
            <input
              autoComplete="email"
              className="focus-ring rounded-xl border border-slate-300 px-3 py-2 text-slate-950"
              type="email"
              {...register("email", { required: "Email is required" })}
            />
            {errors.email === undefined ? null : (
              <span className="text-xs text-rose-700">
                {errors.email.message}
              </span>
            )}
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Password
            <input
              autoComplete="current-password"
              className="focus-ring rounded-xl border border-slate-300 px-3 py-2 text-slate-950"
              type="password"
              {...register("password", { required: "Password is required" })}
            />
            {errors.password === undefined ? null : (
              <span className="text-xs text-rose-700">
                {errors.password.message}
              </span>
            )}
          </label>

          <button
            className="focus-ring mt-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={login.isPending}
            type="submit"
          >
            {login.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
