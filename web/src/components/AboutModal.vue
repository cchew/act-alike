<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const closeButton = ref<HTMLButtonElement | null>(null);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  closeButton.value?.focus();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div v-if="open" data-testid="about-modal" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="How Act Alike works">
      <button ref="closeButton" data-testid="about-close" class="modal-close" @click="$emit('close')" aria-label="Close">✕</button>

      <section class="modal-section">
        <h2>What this does</h2>
        <p>Act Alike compares how the same legal term is defined across different Commonwealth Acts of Parliament, with citations back to the source text.</p>
        <p>It started as an entry for the Australian Public Service's Innovation Month 2026 "Build a Bureaucrat Bot" challenge, and has kept growing since.</p>
      </section>

      <section class="modal-section">
        <h2>How it's built</h2>
        <div class="pipeline-diagram" role="img" aria-label="legislation.gov.au DOCX flows to AKN 3.0 XML via lex-au, then to a definition graph, then to what you're looking at now">
          <span class="pipeline-step">legislation.gov.au DOCX</span>
          <span class="pipeline-arrow mono" aria-hidden="true">&rarr;</span>
          <span class="pipeline-step">AKN 3.0 XML (lex-au)</span>
          <span class="pipeline-arrow mono" aria-hidden="true">&rarr;</span>
          <span class="pipeline-step">definition graph</span>
          <span class="pipeline-arrow mono" aria-hidden="true">&rarr;</span>
          <span class="pipeline-step pipeline-step--current">what you're looking at now</span>
        </div>
      </section>

      <section class="modal-section">
        <h2>How we check accuracy</h2>
        <p>Every claimed difference between Acts is checked against the actual source Act text before it's shown — if a claim can't be matched back to real text, it's dropped, not displayed. When nothing verifies, you'll still see a plain factual headline (e.g. how many distinct definition texts were found) rather than nothing at all.</p>
      </section>

      <section class="modal-section">
        <h2>Known limitations</h2>
        <ul>
          <li><strong>Corpus coverage.</strong> Some Acts' definitions haven't been extracted yet by the underlying legislation pipeline. A "no results" response means the term isn't tagged in the corpus yet — not that it's undefined in Australian law.</li>
        </ul>
      </section>

      <section class="modal-section">
        <h2>Code &amp; feedback</h2>
        <p>Source and issue tracker: <a href="https://github.com/cchew/act-alike" target="_blank" rel="noopener noreferrer">github.com/cchew/act-alike</a>. Bug reports and feature requests welcome there.</p>
      </section>

      <section class="modal-section">
        <p class="scope-declaration" data-testid="scope-declaration">Not an official government service. Does not provide legal advice or compliance conclusions.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--s-5);
}

.modal-panel {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-width: 640px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: var(--s-6) var(--s-5);
}

.modal-close {
  position: absolute;
  top: var(--s-4);
  right: var(--s-4);
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--color-ink-3);
  cursor: pointer;
}

.modal-section { margin-bottom: var(--s-5); }
.modal-section h2 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: var(--s-2);
  color: var(--color-ink);
}
.modal-section p, .modal-section li {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-ink-2);
}
.modal-section ul { padding-left: var(--s-4); }
.modal-section li { margin-bottom: var(--s-2); }

.pipeline-diagram {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-2);
}

.pipeline-step {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  color: var(--color-ink-2);
}

.pipeline-step--current {
  border-color: var(--color-accent-border);
  background: var(--color-accent-bg);
  color: var(--color-ink);
}

.pipeline-arrow {
  color: var(--color-ink-3);
  font-size: 0.75rem;
}

.scope-declaration {
  font-size: 0.75rem;
  color: var(--color-ink);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--s-3);
}
</style>
