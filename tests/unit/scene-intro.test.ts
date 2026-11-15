import { describe, expect, it } from "vitest";
import { damp, LIGHT_RATE } from "@/scene/damping";
import {
  INTRO_BUDGET_MS,
  INTRO_OFF_MS,
  INTRO_STARTS_MS,
  introFinished,
  introSeen,
  introTargets,
  markIntroSeen,
} from "@/scene/intro";

/** Plays the schedule through the same damping the rig uses, at a given frame rate. */
function play(fps: number, untilMs: number) {
  const dt = 1 / fps;
  const lit = new Array(INTRO_STARTS_MS.length).fill(0);
  const firstHalf: number[] = new Array(lit.length).fill(Infinity);
  let peak = 0;
  for (let t = 0; t <= untilMs / 1000; t += dt) {
    const targets = introTargets(t * 1000);
    lit.forEach((v, i) => {
      lit[i] = damp(v, targets[i], LIGHT_RATE, dt);
      if (lit[i] >= 0.5 && firstHalf[i] === Infinity) firstHalf[i] = t;
      peak = Math.max(peak, lit[i]);
    });
  }
  return { lit, firstHalf, peak };
}

describe("the load moment: the case switches on", () => {
  it("lights the six slots in reading order, with gaps that shrink and average about 90 ms", () => {
    expect(INTRO_STARTS_MS).toHaveLength(6);
    const gaps = INTRO_STARTS_MS.slice(1).map((s, i) => s - INTRO_STARTS_MS[i]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeGreaterThanOrEqual(80);
    expect(mean).toBeLessThanOrEqual(100);
  });

  it("asks for each slot only from its own start, and turns every slot off together", () => {
    expect(introTargets(0)).toEqual([1, 0, 0, 0, 0, 0]);
    expect(introTargets(INTRO_STARTS_MS[3])).toEqual([1, 1, 1, 1, 0, 0]);
    expect(introTargets(INTRO_OFF_MS - 1)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(introTargets(INTRO_OFF_MS)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("fully lights the last slot before the off, and settles within the 1.2 s budget", () => {
    expect(INTRO_BUDGET_MS).toBeLessThanOrEqual(1200);
    const atOff = play(120, INTRO_OFF_MS - 1);
    expect(atOff.lit[5]).toBeGreaterThan(0.95);
    const settled = play(120, INTRO_BUDGET_MS);
    for (const v of settled.lit) expect(v).toBeLessThan(1e-3);
  });

  it("looks the same at 30 and 144 frames a second (frame-rate independent)", () => {
    const slow = play(30, INTRO_BUDGET_MS);
    const fast = play(144, INTRO_BUDGET_MS);
    expect(Math.abs(slow.peak - fast.peak)).toBeLessThan(0.02);
    slow.firstHalf.forEach((t, i) => expect(Math.abs(t - fast.firstHalf[i])).toBeLessThan(1 / 30 + 1e-9));
    // In reading order at either rate.
    for (const run of [slow, fast]) for (let i = 1; i < 6; i++) expect(run.firstHalf[i]).toBeGreaterThan(run.firstHalf[i - 1]);
  });

  it("runs once per browser session, and counts storage that throws as already seen", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(introSeen(storage)).toBe(false);
    markIntroSeen(storage);
    expect(introSeen(storage)).toBe(true);
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(introSeen(blocked)).toBe(true);
    expect(() => markIntroSeen(blocked)).not.toThrow();
    expect(introSeen(undefined)).toBe(false);
  });

  it("is finished once past the off time and nothing is still moving", () => {
    expect(introFinished(INTRO_OFF_MS - 1, false)).toBe(false);
    expect(introFinished(INTRO_OFF_MS + 100, true)).toBe(false);
    expect(introFinished(INTRO_OFF_MS + 100, false)).toBe(true);
  });
});
