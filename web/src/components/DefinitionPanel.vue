<script setup lang="ts">
import { computed } from "vue";
import type { DefinitionOut, DifferenceOut } from "../types";
import { findQuoteSpan } from "../highlight";
import { legislationSearchUrl } from "../citation";
import { formatSectionCitation } from "../citation-format";
import { detectCrossReference, crossReferenceDetail } from "../crossref";
import { track } from "../analytics";

const props = withDefaults(
  defineProps<{ definitions: DefinitionOut[]; differences?: DifferenceOut[] }>(),
  { differences: () => [] }
);

// Groups cards by the Act they're actually about: a cross-reference card's
// group key is the Act it adopts from, not its own home Act, so it clusters
// next to that Act's own (authority) card instead of sitting wherever it
// happened to fall in API order. Groups keep the order they first appear in;
// within a group the authority card (if present) sorts before its adopters.
const groupedDefinitions = computed(() => {
  const groupKey = (d: DefinitionOut) => detectCrossReference(d.definition_text, d.act_title) ?? d.act_title;

  const firstSeenAt = new Map<string, number>();
  props.definitions.forEach((d, i) => {
    const key = groupKey(d);
    if (!firstSeenAt.has(key)) firstSeenAt.set(key, i);
  });

  return props.definitions
    .map((d, originalIndex) => ({ d, originalIndex }))
    .sort((a, b) => {
      const groupOrder = firstSeenAt.get(groupKey(a.d))! - firstSeenAt.get(groupKey(b.d))!;
      if (groupOrder !== 0) return groupOrder;
      const aIsCrossRef = detectCrossReference(a.d.definition_text, a.d.act_title) !== null;
      const bIsCrossRef = detectCrossReference(b.d.definition_text, b.d.act_title) !== null;
      if (aIsCrossRef !== bIsCrossRef) return aIsCrossRef ? 1 : -1;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ d }) => d);
});

interface Segment {
  text: string;
  marked: boolean;
}

function segmentsFor(d: DefinitionOut): Segment[] {
  const match = props.differences.find((diff) => diff.act_title === d.act_title);
  if (!match) return [{ text: d.definition_text, marked: false }];

  const span = findQuoteSpan(match.quote, d.definition_text);
  if (!span) return [{ text: d.definition_text, marked: false }];

  const segments: Segment[] = [];
  if (span.start > 0) segments.push({ text: d.definition_text.slice(0, span.start), marked: false });
  segments.push({ text: d.definition_text.slice(span.start, span.end), marked: true });
  if (span.end < d.definition_text.length) {
    segments.push({ text: d.definition_text.slice(span.end), marked: false });
  }
  return segments;
}

function crossReferenceFor(d: DefinitionOut): string | null {
  return detectCrossReference(d.definition_text, d.act_title);
}

function crossReferenceDetailFor(d: DefinitionOut): string | null {
  const referencedAct = crossReferenceFor(d);
  if (!referencedAct) return null;
  return crossReferenceDetail(d.definition_text, referencedAct);
}

function onCitationClick(actTitle: string): void {
  track("citation_clicked", { act_title: actTitle });
}
</script>

<template>
  <div class="definition-panel">
    <article
      v-for="d in groupedDefinitions"
      :key="d.act_frbr_uri + d.section_eid"
      class="definition-card"
      :class="{ 'cross-reference-card': crossReferenceFor(d) }"
    >
      <div class="source-chip mono">{{ d.act_title }} · {{ formatSectionCitation(d.section_eid) }}</div>
      <a
        class="citation-link"
        :href="legislationSearchUrl(d.act_title)"
        target="_blank"
        rel="noopener noreferrer"
        @click="onCitationClick(d.act_title)"
      >View on legislation.gov.au</a>
      <template v-if="crossReferenceFor(d)">
        <p class="cross-ref-note">Adopts the definition from {{ crossReferenceFor(d) }}</p>
        <p v-if="crossReferenceDetailFor(d)" class="definition-text cross-ref-text">{{ crossReferenceDetailFor(d) }}</p>
      </template>
      <p v-else class="definition-text">
        <span v-for="(seg, i) in segmentsFor(d)" :key="i" style="display: contents">
          <mark v-if="seg.marked">{{ seg.text }}</mark>
          <template v-else>{{ seg.text }}</template>
        </span>
      </p>
    </article>
  </div>
</template>

<style scoped>
.definition-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--s-4);
}

.definition-card {
  padding: var(--s-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.source-chip {
  display: inline-block;
  padding: var(--s-1) var(--s-2);
  background: var(--chip-source-bg);
  color: var(--chip-source-text);
  border: 1px solid var(--chip-source-border);
  border-radius: var(--radius-sm);
  font-size: 0.6875rem;
  margin-bottom: var(--s-2);
}

.citation-link {
  display: inline-block;
  font-size: 0.6875rem;
  color: var(--color-ink-3);
  margin-bottom: var(--s-2);
  text-decoration: underline;
}

.citation-link:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}

.definition-text {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-ink);
}

.definition-text mark {
  background: var(--color-accent-bg);
  border: 1px solid var(--color-accent-border);
  border-radius: 3px;
  padding: 0 2px;
  color: inherit;
}

.cross-reference-card {
  background: var(--color-surface-raised);
  border-style: dashed;
}

.cross-ref-note {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-ink);
  margin-bottom: var(--s-2);
}

.cross-ref-text {
  font-size: 0.75rem;
  font-style: italic;
  color: var(--color-ink-3);
}
</style>
