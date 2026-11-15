/**
 * Selects in the headset. A select counts when a pointer is pressed and released on the
 * same target, however long it is held: the pointer library's own click drops presses over
 * 300 ms, and a relaxed pinch is often longer than that. Moving off the target before the
 * release cancels it, as on a touch screen.
 */
export function createPresses() {
  const pressedOn = new Map<number, string>();
  return {
    down(target: string, pointerId: number) {
      pressedOn.set(pointerId, target);
    },
    /** True when this release completes a press that started on the same target. */
    up(target: string, pointerId: number): boolean {
      const started = pressedOn.get(pointerId);
      pressedOn.delete(pointerId);
      return started === target;
    },
    leave(target: string, pointerId: number) {
      if (pressedOn.get(pointerId) === target) pressedOn.delete(pointerId);
    },
  };
}

export type Presses = ReturnType<typeof createPresses>;
