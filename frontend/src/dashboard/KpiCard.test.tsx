import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("renders signed gain/loss values with visible signs", () => {
    render(<KpiCard label="Total P&L" signed value="-4401.31" />);

    expect(screen.getByText("Total P&L")).toBeInTheDocument();
    expect(screen.getByText("-$4,401.31")).toBeInTheDocument();
  });
});
