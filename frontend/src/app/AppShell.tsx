import clsx from "clsx";
import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useLogoutMutation } from "../api/queries";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/data", label: "Data" },
] as const;

function NavItems({ mobile = false }: { readonly mobile?: boolean }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            clsx(
              "focus-ring rounded-xl px-3 py-2 text-sm font-medium",
              mobile ? "flex-1 text-center" : "block",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            )
          }
          end={item.to === "/"}
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function AppShell({ children }: { readonly children?: ReactNode }) {
  const logout = useLogoutMutation();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout.mutateAsync();
    void navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white px-4 py-6 xl:block">
        <div className="text-lg font-semibold text-slate-950">AppsCyclone</div>
        <p className="mt-1 text-xs text-slate-500">Portfolio analytics</p>
        <nav className="mt-8 grid gap-1" aria-label="Primary navigation">
          <NavItems />
        </nav>
        <button
          className="focus-ring absolute bottom-6 left-4 right-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            void handleLogout();
          }}
          type="button"
        >
          Log out
        </button>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">AppsCyclone</div>
            <div className="text-xs text-slate-500">Portfolio analytics</div>
          </div>
          <button
            className="focus-ring rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
            onClick={() => {
              void handleLogout();
            }}
            type="button"
          >
            Log out
          </button>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="mt-3 flex gap-2 overflow-x-auto"
        >
          <NavItems mobile />
        </nav>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 xl:ml-64">
        <div className="mx-auto grid max-w-7xl gap-6">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
