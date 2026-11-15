/** The pulled card's size and resting place, in metres (case space). Plain numbers, so tests
 * can aim at it without loading the scene. */
export const PANEL = { w: 0.62, h: 0.3 } as const;
/** The card rests centred, this far in front of the case face (about 0.6 m from the viewer). */
export const CARD_IN_FRONT = 0.35;
export const VIDEO_BOX = { w: 0.26, h: 0.26, x: -0.16 } as const;
export const CLOSE = { w: 0.11, h: 0.045, x: 0.235, y: -0.115 } as const;
