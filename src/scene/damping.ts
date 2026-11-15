/**
 * Frame-rate independent exponential damping: after `dt` seconds the value has closed
 * the fraction 1 - e^(-k dt) of the gap to the target, whatever the frame rate.
 * At k = 20 it covers about 95% in 150 ms, the slot-light timing in the design brief.
 */
export function damp(value: number, target: number, k: number, dt: number): number {
  return value + (target - value) * (1 - Math.exp(-k * dt));
}

/** Rate for the slot light and similar small motions (see the brief: 150 ms). */
export const LIGHT_RATE = 20;
