import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ValidationErrorTable } from "./ValidationErrorTable";

describe("ValidationErrorTable", () => {
  it("shows row, field, trade ID, and validation message", () => {
    render(
      <ValidationErrorTable
        issues={[
          {
            code: "INVALID_QUANTITY",
            field: "quantity",
            message: "quantity must be greater than zero",
            rowNumber: 2,
            tradeId: "BAD-001",
          },
        ]}
      />,
    );

    expect(screen.getByText("INVALID_QUANTITY")).toBeInTheDocument();
    expect(screen.getByText("quantity")).toBeInTheDocument();
    expect(screen.getByText("BAD-001")).toBeInTheDocument();
    expect(
      screen.getByText("quantity must be greater than zero"),
    ).toBeInTheDocument();
  });
});
