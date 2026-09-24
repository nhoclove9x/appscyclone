import { describe, expect, it } from "vitest";

import {
  chartNumber,
  formatCurrency,
  formatPercent,
  signedTone,
} from "./formatters";

describe("formatters", () => {
  it("formats backend decimal strings for display without changing source values", () => {
    expect(formatCurrency("60620.89123")).toBe("$60,620.89");
    expect(formatCurrency("-4401.31", { signDisplay: "always" })).toBe(
      "-$4,401.31",
    );
    expect(formatPercent("0.125")).toBe("12.50%");
  });

  it("converts decimals to numbers only for chart coordinates", () => {
    expect(chartNumber("12.34")).toBe(12.34);
  });

  it("classifies signed tones for gain and loss display", () => {
    expect(signedTone("1.00")).toBe("positive");
    expect(signedTone("-1.00")).toBe("negative");
    expect(signedTone("0")).toBe("neutral");
  });
});
