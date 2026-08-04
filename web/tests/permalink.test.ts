import { describe, it, expect } from "vitest";
import { termToPath, termFromPath } from "../src/permalink";

describe("permalink", () => {
  it("termToPath encodes the term into a /term/ path", () => {
    expect(termToPath("personal information")).toBe("/term/personal%20information");
  });

  it("termFromPath decodes a /term/ path back to the term", () => {
    expect(termFromPath("/term/personal%20information")).toBe("personal information");
  });

  it("termFromPath round-trips a term with special characters", () => {
    const term = "civil penalty provision";
    expect(termFromPath(termToPath(term))).toBe(term);
  });

  it("termFromPath returns null for a path with no term", () => {
    expect(termFromPath("/")).toBeNull();
  });
});
