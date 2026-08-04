import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import FeedbackWidget from "../src/components/FeedbackWidget.vue";

vi.mock("../src/analytics", () => ({ track: vi.fn() }));
import { track } from "../src/analytics";

describe("FeedbackWidget", () => {
  beforeEach(() => {
    (track as ReturnType<typeof vi.fn>).mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 204 })));
  });

  const props = {
    apiBase: "http://api.test",
    term: "personal information",
    summary: "They differ in scope.",
    differences: [{ act_title: "Privacy Act 1988", quote: "an identified individual", note: "scope" }],
  };

  it("posts to /feedback and tracks feedback_given on thumbs up", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(FeedbackWidget, { props });
    await wrapper.find('[data-testid="feedback-up"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/feedback",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual({
      term: "personal information",
      vote: "up",
      summary: "They differ in scope.",
      differences: props.differences,
    });
    expect(track).toHaveBeenCalledWith("feedback_given", { term: "personal information", vote: "up" });
  });

  it("shows a thanks message and disables both buttons after voting", async () => {
    const wrapper = mount(FeedbackWidget, { props });
    await wrapper.find('[data-testid="feedback-down"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="feedback-thanks"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="feedback-up"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find('[data-testid="feedback-down"]').attributes("disabled")).toBeDefined();
  });

  it("does not throw and still tracks the vote when the POST fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network error"); }));
    const wrapper = mount(FeedbackWidget, { props });

    await wrapper.find('[data-testid="feedback-up"]').trigger("click");
    await flushPromises();

    expect(track).toHaveBeenCalledWith("feedback_given", { term: "personal information", vote: "up" });
  });
});
