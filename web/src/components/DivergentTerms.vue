<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { DivergentTerm } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://127.0.0.1:8000";

const emit = defineEmits<{ (e: "select", term: string): void }>();

const terms = ref<DivergentTerm[]>([]);

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/terms/divergent`);
    if (!res.ok) return;
    terms.value = await res.json();
  } catch (e) {
    // Enhancement, not core functionality — same degrade-quietly pattern as TermBrowser.
    console.error("DivergentTerms: failed to load /terms/divergent", e);
  }
});
</script>

<template>
  <section v-if="terms.length" class="divergent-terms" aria-label="Most divergent terms">
    <h2 class="divergent-terms-heading">Most divergent terms</h2>
    <div class="divergent-term-chips">
      <button
        v-for="t in terms"
        :key="t.term"
        type="button"
        class="divergent-term-btn"
        @click="emit('select', t.term)"
      >{{ t.term }}</button>
    </div>
  </section>
</template>

<style scoped>
.divergent-terms {
  margin-bottom: var(--s-3);
}

.divergent-terms-heading {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: var(--s-2);
}

.divergent-term-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-1);
}

.divergent-term-btn {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  padding: var(--s-1) var(--s-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink-2);
  cursor: pointer;
  transition: all 0.12s var(--ease-spring);
}

.divergent-term-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-ink-3);
}

.divergent-term-btn:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}
</style>
