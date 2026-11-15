/**
 * Names what the headset pointer is on (a slot slug, "card", "close" or "exit") in a
 * data-pointing attribute on the session's page element, and where the pulled card is
 * (data-card: "out", "moving" or "in"). The headset scene is not in the DOM, so this is how
 * automated tests (and anyone debugging a headset run with DevTools) can tell where a ray
 * landed before a select, and wait for a card instead of a clock.
 */
export type Pointing = {
  over(name: string): void;
  out(name: string): void;
  card(state: "out" | "moving" | "in"): void;
};

export function createPointing(el: HTMLElement | null): Pointing {
  return {
    over(name) {
      if (el) el.dataset.pointing = name;
    },
    // Only clear when leaving the thing named now: over and out can arrive in either order.
    out(name) {
      if (el && el.dataset.pointing === name) el.dataset.pointing = "";
    },
    card(state) {
      if (el) el.dataset.card = state;
    },
  };
}
