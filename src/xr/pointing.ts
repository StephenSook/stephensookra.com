/**
 * Names what the headset pointer is on (a slot slug, "card", "close" or "exit") in a
 * data-pointing attribute on the session's page element. The headset scene is not in the
 * DOM, so this is how automated tests (and anyone debugging a headset run with DevTools)
 * can tell where a ray landed before a select.
 */
export type Pointing = { over(name: string): void; out(name: string): void };

export function createPointing(el: HTMLElement | null): Pointing {
  return {
    over(name) {
      if (el) el.dataset.pointing = name;
    },
    // Only clear when leaving the thing named now: over and out can arrive in either order.
    out(name) {
      if (el && el.dataset.pointing === name) el.dataset.pointing = "";
    },
  };
}
