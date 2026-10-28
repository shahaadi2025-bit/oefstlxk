import { describe, expect, it } from "vitest";
import { fmt } from "./api.js";

describe("fmt", () => {
  it("rounds and groups thousands", () => expect(fmt(12345.6)).toBe((12346).toLocaleString()));
  it("shows a dash for missing values", () => {
    expect(fmt(null)).toBe("–");
    expect(fmt(undefined)).toBe("–");
    expect(fmt(NaN)).toBe("–");
  });
});
