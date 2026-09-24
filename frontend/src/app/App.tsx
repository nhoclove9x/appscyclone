import { Route, Routes } from "react-router-dom";

import { AppShell } from "./AppShell";
import { AuthenticatedRoute } from "../auth/AuthenticatedRoute";
import { LoginPage } from "../auth/LoginPage";
import { DashboardPage } from "../dashboard/DashboardPage";
import { DataPage } from "../data/DataPage";
import { TransactionsPage } from "../transactions/TransactionsPage";

export function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<AuthenticatedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<DashboardPage />} index />
          <Route element={<TransactionsPage />} path="transactions" />
          <Route element={<DataPage />} path="data" />
        </Route>
      </Route>
    </Routes>
  );
}
