import { describe, it, expect, beforeEach, vi } from "vitest";
import { startTour, hasSeenTour, TOUR_SEEN_KEY } from "../src/tour";

// Uses the real driver.js (not mocked) to prove startTour()'s MutationObserver
// actually reacts to the popover leaving the DOM, regardless of which of
// driver.js's own close paths (Done button, X button, Escape, overlay click)
// removed it — see tour.ts's comment for why the library's own onDestroyed/
// onCloseClick hooks can't be trusted for this.
describe("tour dismissal", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <input id="term-search" />
      <nav class="flagship-nav"></nav>
      <button class="term-browser-toggle"></button>
      <div class="results-block"></div>
      <button class="help-btn"></button>
    `;
  });

  it("marks the tour seen once the popover is removed from the DOM, by any means", async () => {
    startTour();
    expect(document.querySelector(".driver-popover")).not.toBeNull();
    expect(hasSeenTour()).toBe(false);

    document.querySelector(".driver-popover")?.remove();

    await vi.waitFor(() => {
      expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    });
  });

  it("does not mark the tour seen while the popover is still present", () => {
    startTour();
    expect(document.querySelector(".driver-popover")).not.toBeNull();
    expect(hasSeenTour()).toBe(false);
  });

  it("calls onCancel, not onComplete, when dismissed on the first step", async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    startTour(onComplete, onCancel);

    document.querySelector(".driver-popover")?.remove();

    await vi.waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onComplete, not onCancel, when dismissed on the final step", async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const tour = startTour(onComplete, onCancel);

    // Advance through all 5 steps (#term-search, .flagship-nav,
    // .term-browser-toggle, .results-block, .help-btn) via driver.js's own
    // real navigation, then dismiss.
    tour.moveNext();
    tour.moveNext();
    tour.moveNext();
    tour.moveNext();

    document.querySelector(".driver-popover")?.remove();

    await vi.waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
