/**
 * The load moment, "the case switches on": on a laptop's first view of the 3D case, the six
 * project slots light one after another in reading order (A1 to B3), then all go off together
 * and the case rests. It runs once per browser session, never blocks input, and a hover during
 * it hands the light to the pointer. Phones and reduced motion keep the poster, so they never
 * see it (scene/gate.ts).
 *
 * The schedule only says which slots should be lit at a given time; the rig's own
 * frame-rate-independent damping does the easing, so it looks the same at any frame rate.
 */

/** When each slot starts to light, in ms from the start: gaps shrink (110 to 70 ms), a wave. */
export const INTRO_STARTS_MS = [0, 110, 210, 300, 380, 450] as const;

/** Every slot goes off at once here (an exit is simultaneous). */
export const INTRO_OFF_MS = 700;

/** Start to fully settled, at LIGHT_RATE: the off plus the damping's ~345 ms to settle. */
export const INTRO_BUDGET_MS = 1100;

/** Waits for the poster-to-3D crossfade (450 ms after a 300 ms delay) to nearly finish. */
export const INTRO_DELAY_MS = 650;

/** Target light (0 or 1) for each slot, in layout order, at `elapsedMs` from the start. */
export function introTargets(elapsedMs: number): number[] {
  return INTRO_STARTS_MS.map((start) => (elapsedMs >= start && elapsedMs < INTRO_OFF_MS ? 1 : 0));
}

/** Done once every slot has been asked to go off and the lights have stopped moving. */
export function introFinished(elapsedMs: number, moving: boolean): boolean {
  return elapsedMs >= INTRO_OFF_MS && !moving;
}

const SEEN_KEY = "case-intro-seen";

/** Whether this browser session has already seen the moment. Storage that throws counts as seen. */
export function introSeen(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

/** Remembers the moment for this session; a storage that throws is ignored. */
export function markIntroSeen(storage: Pick<Storage, "setItem"> | undefined): void {
  try {
    storage?.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode or blocked storage: the moment may run again on the next load, which is harmless.
  }
}
