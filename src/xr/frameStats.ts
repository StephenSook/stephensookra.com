/**
 * An opt-in frame-rate readout for a real headset run (?xrstats=1): the session's target
 * rate as the browser reports it, and the measured average over the last frames. It is
 * how a "holds 90 Hz" claim gets a number from the device, instead of an assumption.
 */
export type FrameSummary = { avgMs: number; fps: number; frames: number };

export function createFrameStats(size = 120) {
  const times: number[] = [];
  return {
    /** One frame's duration in seconds. */
    push(dt: number) {
      times.push(dt);
      if (times.length > size) times.shift();
    },
    summary(): FrameSummary {
      if (!times.length) return { avgMs: 0, fps: 0, frames: 0 };
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      return { avgMs: avg * 1000, fps: 1 / avg, frames: times.length };
    },
  };
}

export function statsText(targetHz: number | undefined, s: FrameSummary): string {
  const target = targetHz ? `Target ${Math.round(targetHz)} Hz.` : "Target not reported.";
  if (!s.frames) return `${target} Measuring.`;
  return `${target} Measured ${s.fps.toFixed(1)} fps (${s.avgMs.toFixed(1)} ms a frame).`;
}

/** The readout is off unless the address has xrstats=1. */
export function wantsStats(search: string): boolean {
  return new URLSearchParams(search).get("xrstats") === "1";
}
