import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { track } from "../src/analytics";

describe("track", () => {
  afterEach(() => {
    // @ts-expect-error - test-only cleanup of a global stubbed per-test
    delete window.umami;
  });

  it("calls window.umami.track with the event name and data", () => {
    const umamiTrack = vi.fn();
    // @ts-expect-error - test stub
    window.umami = { track: umamiTrack };

    track("about_opened", { foo: "bar" });

    expect(umamiTrack).toHaveBeenCalledWith("about_opened", { foo: "bar" });
  });

  it("does not throw when window.umami is undefined (script blocked/missing)", () => {
    expect(() => track("about_opened")).not.toThrow();
  });

  it("does not throw when window.umami.track itself throws", () => {
    // @ts-expect-error - test stub
    window.umami = { track: () => { throw new Error("blocked"); } };

    expect(() => track("about_opened")).not.toThrow();
  });
});
