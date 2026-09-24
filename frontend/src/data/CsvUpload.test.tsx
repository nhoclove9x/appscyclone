import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CsvUpload } from "./CsvUpload";

function fileInputFrom(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("CSV upload file input was not rendered");
  }

  return input;
}

describe("CsvUpload", () => {
  it("rejects non-CSV files before upload", () => {
    const onUpload = vi.fn();
    const onValidationError = vi.fn();
    const { container } = render(
      <CsvUpload
        disabled={false}
        onUpload={onUpload}
        onValidationError={onValidationError}
      />,
    );

    fireEvent.change(fileInputFrom(container), {
      target: {
        files: [new File(["not csv"], "trades.txt", { type: "text/plain" })],
      },
    });

    expect(onValidationError).toHaveBeenCalledWith("Please choose a .csv file.");
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("rejects CSV files larger than 1 MB before upload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onValidationError = vi.fn();
    const { container } = render(
      <CsvUpload
        disabled={false}
        onUpload={onUpload}
        onValidationError={onValidationError}
      />,
    );
    const tooLargeCsv = new File(
      [new Uint8Array(1024 * 1024 + 1)],
      "trades.csv",
      { type: "text/csv" },
    );

    await user.upload(fileInputFrom(container), tooLargeCsv);

    expect(onValidationError).toHaveBeenCalledWith(
      "CSV file must be 1 MB or smaller.",
    );
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("passes a valid CSV file to the upload handler", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onValidationError = vi.fn();
    const { container } = render(
      <CsvUpload
        disabled={false}
        onUpload={onUpload}
        onValidationError={onValidationError}
      />,
    );
    const validCsv = new File(["trade_id\nT1\n"], "trades.csv", {
      type: "text/csv",
    });

    await user.upload(fileInputFrom(container), validCsv);

    expect(onValidationError).not.toHaveBeenCalled();
    expect(onUpload).toHaveBeenCalledWith(validCsv);
    expect(screen.getByText("Selected: trades.csv")).toBeInTheDocument();
  });
});
