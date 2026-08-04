// src/tour.ts
// First-visit guided walkthrough for the four things a new visitor needs to
// find: the search box, the sample-term shortcuts, the term browser, and what
// a result actually looks like. Shown once per browser (localStorage flag),
// relaunchable any time from the "Take the tour" header button.
import { driver, type DriveStep, type DriverHook } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_SEEN_KEY = "act-alike-tour-seen";

const TOUR_STEPS: DriveStep[] = [
  {
    element: "#term-search",
    popover: {
      title: "Search for a legal term",
      description: "Type any term to compare how it's defined across Commonwealth Acts.",
    },
  },
  {
    element: ".flagship-nav",
    popover: {
      title: "Or try a sample term",
      description: "These flagship terms are known to have interesting differences across Acts.",
    },
  },
  {
    element: ".term-browser-toggle",
    popover: {
      title: "Browse every defined term",
      description: "See every term defined in 3+ Acts and jump straight to a comparison.",
    },
  },
  {
    element: ".results-block",
    popover: {
      title: "Your results",
      description: "An AI-generated summary of key differences appears first, then one panel per Act with its own definition text and a citation link back to legislation.gov.au.",
    },
  },
  {
    element: ".help-btn",
    popover: {
      title: "How this works",
      description: "Click here any time for details on accuracy checks and known corpus coverage gaps.",
    },
  },
];

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true; // storage unavailable (e.g. private browsing) — don't force the tour every load
  }
}

function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // storage unavailable — nothing to persist, tour just replays next visit
  }
}

// driver.js unconditionally stamps aria-haspopup="dialog"/aria-expanded="true"/
// aria-controls on whatever element it highlights, regardless of that element's
// role — invalid per WAI-ARIA on a textbox, nav, or generic div (only widget
// roles like button/combobox support aria-expanded), and axe correctly flags it
// as a critical violation. The popover itself already has proper dialog
// semantics (aria-describedby/aria-labelledby), so these three attributes on
// the target add nothing real; strip them once driver.js finishes highlighting.
function stripInvalidAria(element?: Element): void {
  element?.removeAttribute("aria-haspopup");
  element?.removeAttribute("aria-expanded");
  element?.removeAttribute("aria-controls");
}

export function startTour(onComplete?: () => void, onCancel?: () => void): ReturnType<typeof driver> {
  // Recorded from onHighlighted (fires once per step, before any teardown)
  // rather than read from the driver instance after the popover is removed —
  // that removal is watched asynchronously below, by which point driver.js's
  // own internal state may already be torn down.
  let lastHighlightedIndex: number | undefined;

  const handleHighlighted: DriverHook = (element, _step, opts) => {
    stripInvalidAria(element);
    lastHighlightedIndex = opts.index;
  };

  const tour = driver({
    showProgress: true,
    allowClose: true,
    // driver.js gates onHighlighted behind its step-transition animation
    // (400ms by default) even when moving between steps synchronously —
    // disabling it keeps onHighlighted's firing tied to a single animation
    // frame instead, which the popover-removal watcher below needs to be
    // able to wait for without a long artificial delay.
    animate: false,
    onHighlighted: handleHighlighted,
    steps: TOUR_STEPS,
  });
  tour.drive();

  // Deliberately not using driver.js's onDestroyed/onCloseClick hooks: empirically
  // (driver.js 1.7.0) onDestroyed only fires from the final "Done" button, and
  // Escape closes the popover without triggering either hook at all — so a
  // visitor who dismisses the tour the normal way (X, Escape, overlay click)
  // would otherwise see it again on every future visit. Watching the popover's
  // own removal from the DOM is dismissal-method-agnostic and catches all of them.
  const popoverWatcher = new MutationObserver(() => {
    if (!document.querySelector(".driver-popover")) {
      popoverWatcher.disconnect();
      // driver.js's own onHighlighted call for the step active at removal time
      // is scheduled via requestAnimationFrame (see tour.ts's onHighlighted
      // comment above) and can still be in flight when this MutationObserver
      // callback runs — a MutationObserver callback is a microtask and fires
      // before the next animation frame. Yielding one frame here lets any
      // pending onHighlighted call land first so lastHighlightedIndex reflects
      // the step that was actually showing when the popover was dismissed.
      requestAnimationFrame(() => {
        markTourSeen();
        if (lastHighlightedIndex === TOUR_STEPS.length - 1) {
          onComplete?.();
        } else {
          onCancel?.();
        }
      });
    }
  });
  popoverWatcher.observe(document.body, { childList: true, subtree: true });

  return tour;
}
