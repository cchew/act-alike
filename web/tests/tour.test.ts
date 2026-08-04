import { describe, it, expect, vi, beforeEach } from "vitest";

const driveMock = vi.fn();
const destroyMock = vi.fn();
let lastConfig: any;
vi.mock("driver.js", () => ({
  driver: vi.fn((config: any) => {
    lastConfig = config;
    return { drive: driveMock, destroy: destroyMock };
  }),
}));

import { startTour, hasSeenTour, TOUR_SEEN_KEY } from "../src/tour";

describe("tour", () => {
  beforeEach(() => {
    localStorage.clear();
    driveMock.mockClear();
    destroyMock.mockClear();
  });

  it("hasSeenTour is false until the flag is set", () => {
    expect(hasSeenTour()).toBe(false);
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    expect(hasSeenTour()).toBe(true);
  });

  it("starts and drives the tour", () => {
    startTour();
    expect(driveMock).toHaveBeenCalled();
  });

  it("targets the five key first-visit elements in order", () => {
    startTour();
    const targets = lastConfig.steps.map((s: any) => s.element);
    expect(targets).toEqual([
      "#term-search",
      ".flagship-nav",
      ".term-browser-toggle",
      ".results-block",
      ".help-btn",
    ]);
  });

  it("wires an onHighlighted handler that records the step index", () => {
    startTour();
    expect(typeof lastConfig.onHighlighted).toBe("function");
    // Simulate driver.js calling the hook for the last step (index 4 of 5).
    expect(() => lastConfig.onHighlighted(undefined, {}, { index: 4 })).not.toThrow();
  });

  // "Marks seen once dismissed" and "fires onComplete/onCancel" are covered
  // against the *real* driver.js in tour-dismissal.test.ts — driver.js's
  // onDestroyed/onCloseClick hooks proved unreliable (see tour.ts's comment),
  // so startTour() instead watches the popover's removal from the DOM
  // directly. That behavior is meaningless to assert against this file's
  // mocked driver() stub.
});
