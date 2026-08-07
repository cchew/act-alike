<script setup lang="ts">
import { ref } from "vue";
import type { DifferenceOut } from "../types";
import { track } from "../analytics";

const props = defineProps<{
  apiBase: string;
  term: string;
  summary: string | null;
  differences: DifferenceOut[];
}>();

const voted = ref<"up" | "down" | null>(null);
const submitting = ref(false);

async function vote(choice: "up" | "down"): Promise<void> {
  if (voted.value || submitting.value) return;
  submitting.value = true;
  try {
    await fetch(`${props.apiBase}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: props.term,
        vote: choice,
        summary: props.summary,
        differences: props.differences,
      }),
    });
  } catch {
    // Feedback submission failing must not block the UI or show an error to
    // the user — it's a nice-to-have signal, not a user-facing operation.
  } finally {
    submitting.value = false;
  }
  voted.value = choice;
  track("feedback_given", { term: props.term, vote: choice });
}
</script>

<template>
  <div class="feedback-widget" data-testid="feedback-widget">
    <span v-if="!voted" class="feedback-prompt">Was this summary helpful?</span>
    <span v-else class="feedback-thanks" data-testid="feedback-thanks">Thanks for the feedback.</span>
    <button
      type="button"
      class="feedback-btn"
      data-testid="feedback-up"
      :disabled="!!voted"
      :aria-pressed="voted === 'up'"
      aria-label="Yes, this summary was helpful"
      @click="vote('up')"
    >&#128077;</button>
    <button
      type="button"
      class="feedback-btn"
      data-testid="feedback-down"
      :disabled="!!voted"
      :aria-pressed="voted === 'down'"
      aria-label="No, this summary was not helpful"
      @click="vote('down')"
    >&#128078;</button>
  </div>
</template>

<style scoped>
.feedback-widget {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-top: var(--s-2);
  margin-bottom: var(--s-4);
  font-size: 0.75rem;
  color: var(--color-ink-3);
}
.feedback-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--s-1) var(--s-2);
  cursor: pointer;
  font-size: 0.875rem;
}
.feedback-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.feedback-btn:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}
</style>
