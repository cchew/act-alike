// tests/DivergentTerms.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import DivergentTerms from "../src/components/DivergentTerms.vue";

describe("DivergentTerms", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { term: "child", difference_count: 2, act_count: 2 },
        { term: "quarter", difference_count: 2, act_count: 6 },
      ],
    })));
  });

  it("fetches /terms/divergent on mount and renders each term as a button", async () => {
    const wrapper = mount(DivergentTerms);
    await flushPromises();
    const buttons = wrapper.findAll(".divergent-term-btn");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.text()).toContain("child");
    expect(buttons[1]!.text()).toContain("quarter");
  });

  it("emits select with the term when a button is clicked", async () => {
    const wrapper = mount(DivergentTerms);
    await flushPromises();
    await wrapper.get(".divergent-term-btn").trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["child"]);
  });

  it("renders nothing when the list is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
    const wrapper = mount(DivergentTerms);
    await flushPromises();
    expect(wrapper.find(".divergent-terms").exists()).toBe(false);
  });

  it("renders nothing when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network error"); }));
    const wrapper = mount(DivergentTerms);
    await flushPromises();
    expect(wrapper.find(".divergent-terms").exists()).toBe(false);
  });
});
