// tests/DefinitionPanel.test.ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import DefinitionPanel from "../src/components/DefinitionPanel.vue";
import type { DefinitionOut, DifferenceOut } from "../src/types";

vi.mock("../src/analytics", () => ({ track: vi.fn() }));
import { track } from "../src/analytics";

const DEFS: DefinitionOut[] = [
  {
    display_term: "personal information",
    definition_text: "personal information means information about an identified individual.",
    act_title: "Privacy Act 1988",
    act_frbr_uri: "/akn/au/act/1988/119",
    section_eid: "sec-6",
  },
  {
    display_term: "personal information",
    definition_text: "personal information means information or an opinion about an identified individual.",
    act_title: "My Health Records Act 2012",
    act_frbr_uri: "/akn/au/act/2012/63",
    section_eid: "sec-5",
  },
];

describe("DefinitionPanel", () => {
  it("renders one card per definition", () => {
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS } });
    expect(wrapper.findAll(".definition-card")).toHaveLength(2);
  });

  it("shows the Act title and section citation in the chip", () => {
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS } });
    expect(wrapper.text()).toContain("Privacy Act 1988");
    expect(wrapper.text()).toContain("s 6");
  });

  it("shows the definition text", () => {
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS } });
    expect(wrapper.text()).toContain("information about an identified individual");
  });

  it("renders no <mark> elements when no differences are passed", () => {
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS } });
    expect(wrapper.findAll("mark")).toHaveLength(0);
  });

  it("wraps a verified quote in <mark> for the matching card", () => {
    const differences: DifferenceOut[] = [
      {
        act_title: "Privacy Act 1988",
        quote: "information about an identified individual",
        note: "narrower — excludes opinions",
      },
    ];
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS, differences } });
    const marks = wrapper.findAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]!.text()).toBe("information about an identified individual");
  });

  it("leaves text unmarked when the quote does not match any card", () => {
    const differences: DifferenceOut[] = [
      { act_title: "Privacy Act 1988", quote: "this exact phrase does not appear anywhere", note: "fabricated" },
    ];
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS, differences } });
    expect(wrapper.findAll("mark")).toHaveLength(0);
  });

  it("only marks the card matching the difference's act_title", () => {
    const differences: DifferenceOut[] = [
      {
        act_title: "Privacy Act 1988",
        quote: "information about an identified individual",
        note: "narrower",
      },
    ];
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS, differences } });
    const cards = wrapper.findAll(".definition-card");
    expect(cards[0]!.findAll("mark")).toHaveLength(1);
    expect(cards[1]!.findAll("mark")).toHaveLength(0);
  });

  it("renders a citation link per card pointing at legislation.gov.au", () => {
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS } });
    const links = wrapper.findAll(".citation-link");
    expect(links).toHaveLength(2);
    expect(links[0]!.attributes("href")).toContain("legislation.gov.au");
    expect(links[0]!.attributes("href")).toContain(encodeURIComponent("Privacy Act 1988"));
  });

  it("gives a cross-reference card the cross-reference treatment", () => {
    const defs: DefinitionOut[] = [
      {
        display_term: "personal information",
        definition_text: "in the Privacy Act 1988.",
        act_title: "Corporations Act 2001",
        act_frbr_uri: "/akn/au/act/2001/50",
        section_eid: "sec-9",
      },
    ];
    const wrapper = mount(DefinitionPanel, { props: { definitions: defs } });
    const card = wrapper.find(".definition-card");
    expect(card.classes()).toContain("cross-reference-card");
    const note = wrapper.find(".cross-ref-note");
    expect(note.exists()).toBe(true);
    expect(note.text()).toContain("Privacy Act 1988");
    // The raw text says nothing beyond what the note already states, so it's suppressed.
    expect(wrapper.find(".cross-ref-text").exists()).toBe(false);
    // The source-chip (Act title + formatted citation) sits above the cross-reference
    // branch, so it must still render normally on a cross-reference card.
    expect(card.text()).toContain("s 9");
  });

  it("still shows the raw text on a cross-reference card when it adds detail beyond the note", () => {
    const defs: DefinitionOut[] = [
      {
        display_term: "personal information",
        definition_text: "section 6 of the Privacy Act 1988",
        act_title: "Crimes Act 1914",
        act_frbr_uri: "/akn/au/act/1914/12",
        section_eid: "sec-3",
      },
    ];
    const wrapper = mount(DefinitionPanel, { props: { definitions: defs } });
    const note = wrapper.find(".cross-ref-note");
    expect(note.text()).toContain("Privacy Act 1988");
    expect(wrapper.find(".cross-ref-text").exists()).toBe(true);
    expect(wrapper.text()).toContain("section 6 of the Privacy Act 1988");
  });

  it("does not give a normal card the cross-reference treatment", () => {
    const wrapper = mount(DefinitionPanel, { props: { definitions: DEFS } });
    const cards = wrapper.findAll(".definition-card");
    for (const card of cards) {
      expect(card.classes()).not.toContain("cross-reference-card");
    }
    expect(wrapper.find(".cross-ref-note").exists()).toBe(false);
  });

  it("groups cross-reference cards immediately after the Act they reference", () => {
    // Reproduces the FUTURE.md UX-review finding: multiple Acts cross-referencing
    // the same target were scattered through API order, invisible as a group.
    const defs: DefinitionOut[] = [
      {
        display_term: "entity",
        definition_text: "in the Income Tax Assessment Act 1997.",
        act_title: "Industry Research and Development Act 1986",
        act_frbr_uri: "/akn/au/act/1986/1",
        section_eid: "sec-1",
      },
      {
        display_term: "entity",
        definition_text: "means an individual, a body corporate, a body politic, or a partnership.",
        act_title: "Income Tax Assessment Act 1997",
        act_frbr_uri: "/akn/au/act/1997/1",
        section_eid: "sec-2",
      },
      {
        display_term: "entity",
        definition_text: "a partnership or an unincorporated association.",
        act_title: "National Disability Insurance Scheme Act 2013",
        act_frbr_uri: "/akn/au/act/2013/1",
        section_eid: "sec-3",
      },
      {
        display_term: "entity",
        definition_text: "in the Income Tax Assessment Act 1997.",
        act_title: "AusCheck Regulations 2017",
        act_frbr_uri: "/akn/au/act/2017/1",
        section_eid: "sec-4",
      },
    ];
    const wrapper = mount(DefinitionPanel, { props: { definitions: defs } });
    const chips = wrapper.findAll(".source-chip").map((c) => c.text());
    expect(chips).toEqual([
      // Group's slot in the overall order comes from its earliest mention (a
      // cross-reference card, at index 0) — but the authority card itself
      // still sorts first within the group.
      "Income Tax Assessment Act 1997 · s 2",
      // First adopter, in its own original relative order.
      "Industry Research and Development Act 1986 · s 1",
      // Second adopter of the same group, immediately after.
      "AusCheck Regulations 2017 · s 4",
      // Unrelated card, keeps its own relative position.
      "National Disability Insurance Scheme Act 2013 · s 3",
    ]);
  });

  it("tracks citation_clicked with the act title when the citation link is clicked", async () => {
    (track as ReturnType<typeof vi.fn>).mockClear();
    const wrapper = mount(DefinitionPanel, {
      props: {
        definitions: [{
          display_term: "personal information",
          definition_text: "means information about an identified individual.",
          act_title: "Privacy Act 1988",
          act_frbr_uri: "/akn/au/act/1988/119",
          section_eid: "sec-6",
        }],
      },
    });
    await wrapper.find(".citation-link").trigger("click");
    expect(track).toHaveBeenCalledWith("citation_clicked", { act_title: "Privacy Act 1988" });
  });
});
