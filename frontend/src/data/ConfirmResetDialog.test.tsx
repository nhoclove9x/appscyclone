import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmResetDialog } from "./ConfirmResetDialog";

describe("ConfirmResetDialog", () => {
  it("is accessible as a dialog and confirms destructive reset", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmResetDialog
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open
        pending={false}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Reset sample data?",
    );

    await user.click(screen.getByRole("button", { name: "Reset sample data" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
