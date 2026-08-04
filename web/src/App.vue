<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { ComparisonResponse } from "./types";
import { detectCrossReference } from "./crossref";
import { startTour, hasSeenTour } from "./tour";
import { track } from "./analytics";
import DefinitionPanel from "./components/DefinitionPanel.vue";
import TermBrowser from "./components/TermBrowser.vue";
import CorpusStats from "./components/CorpusStats.vue";
import AboutModal from "./components/AboutModal.vue";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://127.0.0.1:8000";
const FLAGSHIP_TERMS = ["personal information", "Australian resident", "constitutional corporation", "civil penalty provision"];

const term = ref("");
const result = ref<ComparisonResponse | null>(null);
const loading = ref(false);
const summarising = ref(false);
const error = ref<string | null>(null);
const browserExpanded = ref(false);
const aboutOpen = ref(false);

// Cosmetic progress: cycles "Searching." -> ".." -> "..." so a multi-second
// wait (more Acts to compare = a bigger prompt = a slower LLM round trip)
// reads as active rather than stalled.
const dots = ref("");
let dotsTimer: ReturnType<typeof setInterval> | null = null;

function startDots() {
  if (dotsTimer) return;
  dots.value = "";
  dotsTimer = setInterval(() => {
    dots.value = dots.value.length >= 3 ? "" : dots.value + ".";
  }, 400);
}

function stopDots() {
  if (dotsTimer) clearInterval(dotsTimer);
  dotsTimer = null;
  dots.value = "";
}

onUnmounted(stopDots);

function launchTour(source: "auto" | "manual"): void {
  track("tour_started", { source });
  startTour(
    () => track("tour_completed"),
    () => track("tour_cancelled"),
  );
}

function openAbout(): void {
  aboutOpen.value = true;
  track("about_opened");
}

onMounted(() => {
  if (!hasSeenTour()) launchTour("auto");
});

const mainLayoutEl = ref<HTMLElement | null>(null);
const footerEl = ref<HTMLElement | null>(null);
let asideHeightObserver: ResizeObserver | null = null;

// The browse panel's max-height (--browser-aside-max-height, read in the
// scoped <style>) needs the true remaining space below main-layout's actual
// start position and above the footer's actual start position — not a
// hand-enumerated sum of every margin/padding between them (tried that,
// missed one each of three separate times: header's margin-bottom, footer's
// margin-top, .app-shell's bottom padding). Measuring the two containers'
// real rendered edges directly sidesteps needing to know about any of them.
function updateAsideMaxHeight(): void {
  if (!mainLayoutEl.value || !footerEl.value) return;
  const topBound = mainLayoutEl.value.getBoundingClientRect().top;
  const footerStyle = getComputedStyle(footerEl.value);
  const footerBox = footerEl.value.getBoundingClientRect();
  const footerReservedHeight = footerBox.height + parseFloat(footerStyle.marginTop || "0");
  // .app-shell's own bottom padding is real space below the footer too —
  // read it off the actual parent rather than assuming a token value.
  const shellEl = mainLayoutEl.value.parentElement;
  const shellPaddingBottom = shellEl ? parseFloat(getComputedStyle(shellEl).paddingBottom || "0") : 0;
  const available = window.innerHeight - topBound - footerReservedHeight - shellPaddingBottom;
  document.documentElement.style.setProperty("--browser-aside-max-height", `${Math.max(0, Math.floor(available))}px`);
}

onMounted(() => {
  updateAsideMaxHeight();
  asideHeightObserver = new ResizeObserver(updateAsideMaxHeight);
  if (mainLayoutEl.value) asideHeightObserver.observe(mainLayoutEl.value);
  if (footerEl.value) asideHeightObserver.observe(footerEl.value);
  window.addEventListener("resize", updateAsideMaxHeight);
});

onUnmounted(() => {
  asideHeightObserver?.disconnect();
  window.removeEventListener("resize", updateAsideMaxHeight);
});

const coverageWarning = computed<string | null>(() => {
  if (!result.value) return null;
  const titles = new Set(result.value.definitions.map((d) => d.act_title));
  const missing = new Set<string>();
  for (const d of result.value.definitions) {
    const ref = detectCrossReference(d.definition_text, d.act_title);
    if (ref && !titles.has(ref)) missing.add(ref);
  }
  if (missing.size === 0) return null;
  const names = [...missing].join(", ");
  return missing.size > 1
    ? `${names} are referenced above but weren't returned as results in their own right — their definitions may not be extracted from the corpus yet.`
    : `${names} is referenced above but wasn't returned as a result in its own right — its definition may not be extracted from the corpus yet.`;
});

watch(coverageWarning, (val) => {
  if (val) track("coverage_warning_shown", { term: term.value });
});

async function search(t: string) {
  if (!t.trim()) return;
  term.value = t;
  loading.value = true;
  summarising.value = false;
  error.value = null;
  result.value = null;
  startDots();
  try {
    const quickRes = await fetch(`${API_BASE}/definitions/quick?term=${encodeURIComponent(t)}`);
    if (quickRes.status === 404) {
      error.value = `No Commonwealth Act defines "${t}".`;
      track("search_no_result", { term: t });
      return;
    }
    if (!quickRes.ok) throw new Error(`HTTP ${quickRes.status}`);
    const quick: ComparisonResponse = await quickRes.json();
    result.value = quick;
    loading.value = false;
    track("term_compared", { term: t, is_flagship: FLAGSHIP_TERMS.includes(t) });

    if (quick.definitions.length < 2) {
      stopDots();
      return;
    }

    summarising.value = true;
    const fullRes = await fetch(`${API_BASE}/definitions?term=${encodeURIComponent(t)}`);
    if (fullRes.ok && quick.term === t) {
      const full: ComparisonResponse = await fullRes.json();
      result.value = { ...quick, difference_summary: full.difference_summary, differences: full.differences };
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Search failed";
  } finally {
    loading.value = false;
    summarising.value = false;
    stopDots();
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-title">
        <div class="title-row">
          <h1>Act Alike (IM2026)</h1>
          <button type="button" class="help-btn" @click="openAbout" aria-label="How Act Alike works">?</button>
          <button type="button" class="tour-btn" @click="launchTour('manual')">Take the tour</button>
        </div>
        <p class="subtitle">Term comparison across Commonwealth Acts: does this legal term mean the same thing everywhere it's used?</p>
      </div>
      <CorpusStats />
    </header>
    <div class="main-layout" ref="mainLayoutEl">
      <div class="content-col">
        <main class="search-block">
          <p class="search-instructions">Type a legal term, pick a shortcut below or browse all defined terms in the panel.</p>
          <form class="search-row" @submit.prevent="search(term)">
            <label for="term-search" class="visually-hidden">Search for a legal term</label>
            <input id="term-search" v-model="term" type="text" placeholder="e.g. personal information" class="search-input" />
            <button type="submit" class="search-btn">Compare</button>
          </form>
          <nav class="flagship-nav" aria-label="Flagship term shortcuts">
            <button
              v-for="t in FLAGSHIP_TERMS"
              :key="t"
              type="button"
              class="flagship-btn"
              @click="search(t)"
            >{{ t }}</button>
          </nav>
        </main>

        <div class="results-block">
          <p v-if="loading" class="loading">Searching{{ dots }}</p>
          <p v-else-if="error" class="load-error">{{ error }}</p>

          <template v-else-if="result">
            <p v-if="result.difference_summary" class="difference-summary">{{ result.difference_summary }}</p>
            <p v-else-if="summarising" class="loading summarising">Comparing {{ result.definitions.length }} Acts{{ dots }}</p>

            <p v-if="coverageWarning" class="coverage-warning">
              <span class="warning-icon" aria-hidden="true">&#9888;</span> {{ coverageWarning }}
            </p>

            <div v-if="result.definitions.length" class="results-legend" aria-label="Panel style legend">
              <span class="legend-key">Legend:</span>
              <span class="legend-item"><span class="legend-swatch legend-swatch--solid" aria-hidden="true"></span>Act's own definition</span>
              <span class="legend-item"><span class="legend-swatch legend-swatch--dashed" aria-hidden="true"></span>Cross-reference to another Act</span>
              <span class="legend-item"><span class="legend-mark">text</span>Passage quoted in the summary above</span>
              <span class="legend-item"><span class="warning-icon" aria-hidden="true">&#9888;</span>Referenced Act not shown below</span>
            </div>

            <DefinitionPanel :definitions="result.definitions" :differences="result.differences" />
          </template>
        </div>
      </div>

      <aside class="browser-aside" aria-label="Browse defined terms">
        <button
          type="button"
          class="term-browser-toggle"
          :aria-expanded="browserExpanded"
          aria-controls="term-browser-panel"
          @click="browserExpanded = !browserExpanded"
        >{{ browserExpanded ? 'Hide' : 'Browse' }} defined terms</button>
        <div id="term-browser-panel" class="term-browser-panel" v-show="browserExpanded">
          <TermBrowser @select="search" />
        </div>
      </aside>
    </div>
    <footer class="disclaimer" ref="footerEl">Not an official government service. AI-generated summaries may be inaccurate — always verify against the cited legislation.</footer>
    <AboutModal :open="aboutOpen" @close="aboutOpen = false" />
  </div>
</template>

<style scoped>
.app-shell {
  margin: 0 auto;
  padding: var(--s-6) var(--s-5);
}

.main-layout {
  display: grid;
  grid-template-areas: "search" "browser" "results";
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s-5);
}

.content-col { display: contents; }
.search-block { grid-area: search; }
.results-block { grid-area: results; }

.app-header {
  margin-bottom: var(--s-5);
  padding-bottom: var(--s-4);
  border-bottom: 1px solid var(--color-border);
}

.app-header h1 { font-size: 1.125rem; color: var(--color-ink); }
.subtitle { font-size: 0.75rem; color: var(--color-ink-3); margin-top: 0.2rem; }

.search-instructions {
  font-size: 0.8125rem;
  color: var(--color-ink-3);
  margin-bottom: var(--s-2);
}

.search-row {
  display: flex;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
}

.search-input {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 0.875rem;
  padding: var(--s-2) var(--s-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
}

.search-btn, .flagship-btn {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink-2);
  cursor: pointer;
  transition: all 0.12s var(--ease-spring);
}

.search-btn { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-bg); }
.search-btn:hover { opacity: 0.9; }
.flagship-btn:hover { background: var(--color-surface-hover); border-color: var(--color-ink-3); }

.search-btn:focus-visible, .flagship-btn:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}

.search-input:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}

.flagship-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-1);
}

.browser-aside {
  grid-area: browser;
}

@media (min-width: 860px) {
  .main-layout {
    grid-template-areas: "content aside";
    grid-template-columns: minmax(0, var(--reading-width)) minmax(260px, 1fr);
    column-gap: var(--s-6);
  }

  .content-col {
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
    grid-area: content;
  }

  .browser-aside {
    grid-area: aside;
    position: sticky;
    top: var(--s-5);
    /* The page itself must still grow taller than the viewport for long
       result lists, so this can't be a "stretch to fill parent" layout —
       the aside needs its own hard cap. --browser-aside-max-height is
       measured in script (header bottom + footer height), not guessed via a
       static vh formula, which previously ran ~100px past the viewport
       because it didn't know either one's actual rendered height. */
    max-height: var(--browser-aside-max-height, calc(100vh - 220px));
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.term-browser-toggle {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-ink-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.term-browser-toggle:hover { color: var(--color-ink); }

.term-browser-toggle:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}

.term-browser-panel {
  margin-top: var(--s-3);
  padding: var(--s-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.difference-summary {
  padding: var(--s-3) var(--s-4);
  margin-bottom: var(--s-4);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-ink);
}

.load-error { color: var(--color-ink-2); font-size: 0.875rem; }
.loading { color: var(--color-ink-3); font-size: 0.875rem; }
.summarising { margin-bottom: var(--s-4); }

.coverage-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4);
  margin-bottom: var(--s-4);
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-warning-text);
}

.warning-icon { flex-shrink: 0; }

.results-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-4);
  margin-bottom: var(--s-4);
  font-size: 0.6875rem;
  color: var(--color-ink-3);
}

.legend-key {
  font-weight: 600;
  color: var(--color-ink-2);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
}

.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.legend-swatch--solid {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.legend-swatch--dashed {
  background: var(--color-surface-raised);
  border: 1px dashed var(--color-ink-3);
}

.legend-mark {
  background: var(--color-accent-bg);
  border: 1px solid var(--color-accent-border);
  border-radius: 3px;
  padding: 0 2px;
  font-size: 0.6875rem;
  color: var(--color-ink);
}

.disclaimer {
  position: sticky;
  bottom: 0;
  margin-top: var(--s-5);
  padding: var(--s-4) var(--s-5);
  margin-left: calc(var(--s-5) * -1);
  margin-right: calc(var(--s-5) * -1);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.75rem;
  color: var(--color-ink-3);
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.help-btn {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink-2);
  cursor: pointer;
  line-height: 1;
}

.help-btn:hover { background: var(--color-surface-hover); }

.tour-btn {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-ink-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.tour-btn:hover { color: var(--color-ink); }

.tour-btn:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}

.help-btn:focus-visible {
  outline: 2px solid var(--color-accent-border);
  outline-offset: 2px;
}
</style>
