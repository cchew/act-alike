import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AboutModal from "../src/components/AboutModal.vue";

describe("AboutModal", () => {
  it("renders nothing when closed", () => {
    const wrapper = mount(AboutModal, { props: { open: false } });
    expect(wrapper.find('[data-testid="about-modal"]').exists()).toBe(false);
  });

  it("renders all sections when open", () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    const text = wrapper.text();
    expect(text).toContain("What this does");
    expect(text).toContain("How it's built");
    expect(text).toContain("How we check accuracy");
    expect(text).toContain("Known limitations");
    expect(text).toContain("Code & feedback");
    expect(text).toContain("Not an official government service");
  });

  it("has no standalone Scope heading", () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    const headings = wrapper.findAll("h2").map((h) => h.text());
    expect(headings).not.toContain("Scope");
  });

  it("renders the build pipeline as a four-stage diagram", () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    const steps = wrapper.findAll(".pipeline-step").map((s) => s.text());
    expect(steps).toEqual([
      "legislation.gov.au DOCX",
      "AKN 3.0 XML (lex-au)",
      "definition graph",
      "what you're looking at now",
    ]);
  });

  it("links to the GitHub repo for code and feedback", () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    const link = wrapper.find('a[href="https://github.com/cchew/act-alike"]');
    expect(link.exists()).toBe(true);
  });

  it("emits close when the close button is clicked", async () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    await wrapper.find('[data-testid="about-close"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("emits close when the backdrop is clicked", async () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    await wrapper.find(".modal-backdrop").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("emits close when Escape is pressed", async () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("mentions Act Alike started as an IM2026 entry", () => {
    const wrapper = mount(AboutModal, { props: { open: true } });
    expect(wrapper.text()).toContain("started as an entry");
    expect(wrapper.text()).toContain("Innovation Month 2026");
  });
});
