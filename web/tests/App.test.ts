import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import { TOUR_SEEN_KEY } from "../src/tour";

vi.mock("../src/analytics", () => ({ track: vi.fn() }));
import { track } from "../src/analytics";

const RESPONSE = {
  term: "personal information",
  definitions: [
    {
      display_term: "personal information",
      definition_text: "personal information means information about an identified individual.",
      act_title: "Privacy Act 1988",
      act_frbr_uri: "/akn/au/act/1988/119",
      section_eid: "sec-6",
    },
  ],
  difference_summary: null,
};

describe("App", () => {
  beforeEach(() => {
    // Most tests aren't exercising the first-visit tour — mark it seen so
    // driver.js's overlay doesn't appear underfoot in unrelated assertions.
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      if (url.includes("/stats")) return { ok: true, status: 200, json: async () => ({ acts: 0, defined_terms: 0, multi_act_terms: 0 }) };
      return { ok: true, status: 200, json: async () => RESPONSE };
    }));
  });

  it("renders the flagship term quick-select buttons", () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain("personal information");
    expect(wrapper.text()).toContain("Australian resident");
    expect(wrapper.text()).toContain("constitutional corporation");
    expect(wrapper.text()).toContain("civil penalty provision");
  });

  it("searching a flagship term renders its definitions", async () => {
    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Privacy Act 1988");
  });

  it("shows a not-found message on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    const wrapper = mount(App);
    await wrapper.find(".search-input").setValue("not a real term");
    await wrapper.find(".search-row").trigger("submit.prevent");
    await flushPromises();
    expect(wrapper.text()).toContain("No Commonwealth Act defines");
  });

  it("shows the difference summary when present", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ...RESPONSE, difference_summary: "The Acts differ in scope." }),
    })));
    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The Acts differ in scope.");
  });

  it("renders the term browser and searching a browsed term reuses the same search flow", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ term: "income support payment", display_term: "income support payment", act_count: 3 }],
        };
      }
      return { ok: true, status: 200, json: async () => RESPONSE };
    }));
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.text()).toContain("income support payment");

    await wrapper.get(".term-chip").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Privacy Act 1988");
  });

  it("passes the differences from the response through to DefinitionPanel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...RESPONSE,
          differences: [
            {
              act_title: "Privacy Act 1988",
              quote: "information about an identified individual",
              note: "narrower",
            },
          ],
        }),
      };
    }));
    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();
    expect(wrapper.findAll("mark")).toHaveLength(1);
  });

  it("hides the term browser by default", () => {
    const wrapper = mount(App, { attachTo: document.body });
    expect(wrapper.find("#term-browser-panel").isVisible()).toBe(false);
    expect(wrapper.find(".term-browser-toggle").attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });

  it("lets the toggle button expand and hide the term browser", async () => {
    const wrapper = mount(App, { attachTo: document.body });

    await wrapper.get(".term-browser-toggle").trigger("click");
    expect(wrapper.find("#term-browser-panel").isVisible()).toBe(true);
    expect(wrapper.find(".term-browser-toggle").attributes("aria-expanded")).toBe("true");

    await wrapper.get(".term-browser-toggle").trigger("click");
    expect(wrapper.find("#term-browser-panel").isVisible()).toBe(false);
    wrapper.unmount();
  });

  it("does not change the term browser's expanded state when a search runs", async () => {
    const wrapper = mount(App, { attachTo: document.body });

    await wrapper.get(".term-browser-toggle").trigger("click");
    expect(wrapper.find("#term-browser-panel").isVisible()).toBe(true);

    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();

    expect(wrapper.find("#term-browser-panel").isVisible()).toBe(true);
    expect(wrapper.find(".term-browser-toggle").attributes("aria-expanded")).toBe("true");
    wrapper.unmount();
  });

  it("renders no difference-summary paragraph when the API sends a null summary", async () => {
    // Contract note: the real backend (see api.py's _fallback_summary) now always
    // sends a non-null string when 2+ definitions exist. This test only guards
    // against the frontend crashing/rendering stale filler text if that contract
    // is ever violated (e.g. deploy skew) — it is not a designed UX state.
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ...RESPONSE,
          definitions: [...RESPONSE.definitions, { ...RESPONSE.definitions[0], act_title: "Crimes Act 1914" }],
          difference_summary: null,
        }),
      };
    }));
    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();
    expect(wrapper.find(".difference-summary").exists()).toBe(false);
  });

  it("renders CorpusStats near the header", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/stats")) {
        return { ok: true, status: 200, json: async () => ({ acts: 24, defined_terms: 1893, multi_act_terms: 105 }) };
      }
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => RESPONSE };
    }));
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.find(".corpus-stats").exists()).toBe(true);
  });

  it("shows the disclaimer footer on load, with no interaction required", () => {
    const wrapper = mount(App);
    expect(wrapper.find(".disclaimer").exists()).toBe(true);
    expect(wrapper.find(".disclaimer").text()).toContain("Not an official government service");
  });

  it("opens and closes the About modal from the help button", async () => {
    const wrapper = mount(App);
    expect(wrapper.find('[data-testid="about-modal"]').exists()).toBe(false);

    await wrapper.find(".help-btn").trigger("click");
    expect(wrapper.find('[data-testid="about-modal"]').exists()).toBe(true);

    await wrapper.find('[data-testid="about-close"]').trigger("click");
    expect(wrapper.find('[data-testid="about-modal"]').exists()).toBe(false);
  });

  it("renders the panel-style legend above results once definitions arrive", async () => {
    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();
    expect(wrapper.find(".results-legend").exists()).toBe(true);
  });

  it("renders quick-endpoint definitions before the full summary resolves, then fills in the summary", async () => {
    let resolveFullFetch: () => void = () => {};
    const fullFetchGate = new Promise<void>((resolve) => { resolveFullFetch = resolve; });
    const twoActResponse = {
      ...RESPONSE,
      definitions: [...RESPONSE.definitions, { ...RESPONSE.definitions[0], act_title: "Crimes Act 1914" }],
    };

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      if (url.includes("/definitions/quick")) {
        return { ok: true, status: 200, json: async () => ({ ...twoActResponse, difference_summary: null }) };
      }
      await fullFetchGate;
      return { ok: true, status: 200, json: async () => ({ ...twoActResponse, difference_summary: "The Acts differ in scope." }) };
    }));

    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Privacy Act 1988");
    expect(wrapper.text()).toContain("Crimes Act 1914");
    expect(wrapper.text()).not.toContain("The Acts differ in scope.");
    expect(wrapper.find(".summarising").exists()).toBe(true);

    resolveFullFetch();
    await flushPromises();

    expect(wrapper.text()).toContain("The Acts differ in scope.");
    expect(wrapper.find(".summarising").exists()).toBe(false);
  });

  it("skips the full-summary fetch entirely when only one Act defines the term", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => RESPONSE };
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();

    const definitionsCalls = fetchMock.mock.calls.filter(([url]) => (url as string).includes("/definitions"));
    expect(definitionsCalls).toHaveLength(1);
    expect(definitionsCalls[0]?.[0]).toContain("/definitions/quick");
  });

  it("shows a coverage warning when a cross-referenced Act isn't itself among the results", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          term: "company",
          definitions: [
            {
              display_term: "company",
              definition_text: "subsection 995-1(1) of the Income Tax Assessment Act 1997.",
              act_title: "Income Tax Assessment Act 1936",
              act_frbr_uri: "/akn/au/act/1936/27",
              section_eid: "part-I__sec-6",
            },
            {
              display_term: "company",
              definition_text: "any body or association (whether or not it is incorporated), but does not include a partnership.",
              act_title: "Migration Act 1958",
              act_frbr_uri: "/akn/au/act/1958/62",
              section_eid: "part-5__dvs-1__sec-337",
            },
          ],
          difference_summary: null,
          differences: [],
        }),
      };
    }));

    const wrapper = mount(App);
    await wrapper.find(".search-input").setValue("company");
    await wrapper.find(".search-row").trigger("submit.prevent");
    await flushPromises();

    expect(wrapper.find(".coverage-warning").exists()).toBe(true);
    expect(wrapper.find(".coverage-warning").text()).toContain("Income Tax Assessment Act 1997");
  });

  it("shows no coverage warning when every cross-referenced Act is itself among the results", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/terms")) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => RESPONSE };
    }));

    const wrapper = mount(App);
    await wrapper.get(".flagship-btn").trigger("click");
    await flushPromises();

    expect(wrapper.find(".coverage-warning").exists()).toBe(false);
  });

  describe("first-visit tour", () => {
    it("auto-starts for a visitor who hasn't seen it", async () => {
      localStorage.removeItem(TOUR_SEEN_KEY);
      expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();

      const wrapper = mount(App, { attachTo: document.body });
      await wrapper.vm.$nextTick();

      expect(document.querySelector(".driver-popover")).not.toBeNull();
      wrapper.unmount();
      document.querySelector(".driver-popover")?.remove();
      document.querySelector(".driver-overlay")?.remove();
    });

    it("does not auto-start for a visitor who has already seen it", async () => {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
      const wrapper = mount(App, { attachTo: document.body });
      await wrapper.vm.$nextTick();

      expect(document.querySelector(".driver-popover")).toBeNull();
      wrapper.unmount();
    });

    it("relaunches on demand from the 'Take the tour' button even after being seen", async () => {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
      const wrapper = mount(App, { attachTo: document.body });
      await wrapper.vm.$nextTick();
      expect(document.querySelector(".driver-popover")).toBeNull();

      await wrapper.find(".tour-btn").trigger("click");
      expect(document.querySelector(".driver-popover")).not.toBeNull();
      wrapper.unmount();
    });
  });

  describe("analytics events", () => {
    beforeEach(() => {
      (track as ReturnType<typeof vi.fn>).mockClear();
    });

    it("tracks about_opened when the help button is clicked", async () => {
      const wrapper = mount(App);
      await wrapper.find(".help-btn").trigger("click");
      expect(track).toHaveBeenCalledWith("about_opened");
    });

    it("tracks tour_started with source=auto on first visit", async () => {
      localStorage.removeItem(TOUR_SEEN_KEY);
      const wrapper = mount(App, { attachTo: document.body });
      await wrapper.vm.$nextTick();
      expect(track).toHaveBeenCalledWith("tour_started", { source: "auto" });
      wrapper.unmount();
      document.querySelector(".driver-popover")?.remove();
      document.querySelector(".driver-overlay")?.remove();
    });

    it("tracks tour_started with source=manual from the Take the tour button", async () => {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
      const wrapper = mount(App, { attachTo: document.body });
      await wrapper.find(".tour-btn").trigger("click");
      expect(track).toHaveBeenCalledWith("tour_started", { source: "manual" });
      wrapper.unmount();
      document.querySelector(".driver-popover")?.remove();
      document.querySelector(".driver-overlay")?.remove();
    });
  });
});
