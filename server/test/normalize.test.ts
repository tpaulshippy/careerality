import { describe, expect, test } from "vitest";
import { normalizeOccupationCode } from "../src/lib/normalize";

describe("normalizeOccupationCode", () => {
  test("accepts fully-formed codes", () => {
    expect(normalizeOccupationCode("15-1252.00")).toBe("15-1252.00");
  });

  test("appends .00 to short codes", () => {
    expect(normalizeOccupationCode("15-1252")).toBe("15-1252.00");
  });

  test("expands compact codes", () => {
    expect(normalizeOccupationCode("151252")).toBe("15-1252.00");
  });

  test("rejects invalid codes", () => {
    expect(normalizeOccupationCode("nope")).toBeNull();
    expect(normalizeOccupationCode("15-1252.01")).toBeNull();
    expect(normalizeOccupationCode("")).toBeNull();
    expect(normalizeOccupationCode(null)).toBeNull();
    expect(normalizeOccupationCode(123)).toBeNull();
  });
});
