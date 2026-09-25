import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("applies a page-size change immediately", () => {
    const onPageSizeChange = vi.fn();

    render(
      <Pagination
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        pagination={{
          page: 1,
          pageSize: 25,
          totalItems: 200,
          totalPages: 8,
        }}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
      target: { value: "100" },
    });

    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });
});
