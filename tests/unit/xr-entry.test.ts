import { describe, expect, it, vi } from "vitest";
import { createEntry } from "@/xr/entry";

/** A store stand-in whose enterVR returns a promise the test settles by hand. */
function fakeStore() {
  let settle: { resolve: (s: unknown) => void; reject: (e: unknown) => void } | null = null;
  const enterVR = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        settle = { resolve, reject };
      }),
  );
  const enterAR = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        settle = { resolve, reject };
      }),
  );
  return { enterVR, enterAR, settle: () => settle! };
}
const session = () => ({ end: vi.fn(async () => {}) });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createEntry", () => {
  it("asks once, synchronously, and reports a granted session", async () => {
    const store = fakeStore();
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    const entry = createEntry(store, cb);
    entry.enter();
    expect(store.enterVR).toHaveBeenCalledTimes(1); // inside the caller's gesture, before any await
    store.settle().resolve(session());
    await flush();
    expect(cb.onStarted).toHaveBeenCalledTimes(1);
    expect(cb.onEnded).not.toHaveBeenCalled();
  });

  it("asks for passthrough with enter('ar'), the same way", async () => {
    const store = fakeStore();
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    createEntry(store, cb).enter("ar");
    expect(store.enterAR).toHaveBeenCalledTimes(1);
    expect(store.enterVR).not.toHaveBeenCalled();
    store.settle().resolve(session());
    await flush();
    expect(cb.onStarted).toHaveBeenCalledTimes(1);
  });

  it("does not ask again while a request is pending", () => {
    const store = fakeStore();
    const entry = createEntry(store, { onStarted: vi.fn(), onEnded: vi.fn() });
    entry.enter();
    entry.enter();
    expect(store.enterVR).toHaveBeenCalledTimes(1);
  });

  it("calls a refusal for lack of a user gesture 'blocked', anything else 'failed'", async () => {
    for (const [error, reason] of [
      [new DOMException("no gesture", "SecurityError"), "blocked"],
      [new DOMException("not allowed", "NotAllowedError"), "blocked"],
      [new Error("boom"), "failed"],
    ] as const) {
      const store = fakeStore();
      const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
      createEntry(store, cb).enter();
      store.settle().reject(error);
      await flush();
      expect(cb.onEnded).toHaveBeenCalledWith(reason);
    }
    const store = fakeStore();
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    createEntry(store, cb).enter();
    store.settle().resolve(undefined); // the store found no WebXR support
    await flush();
    expect(cb.onEnded).toHaveBeenCalledWith("failed");
  });

  it("can ask again after a refusal", async () => {
    const store = fakeStore();
    const entry = createEntry(store, { onStarted: vi.fn(), onEnded: vi.fn() });
    entry.enter();
    store.settle().reject(new DOMException("no gesture", "SecurityError"));
    await flush();
    entry.enter();
    expect(store.enterVR).toHaveBeenCalledTimes(2);
  });

  it("ends a session granted after release, and reports nothing", async () => {
    const store = fakeStore();
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    const entry = createEntry(store, cb);
    entry.enter();
    entry.release(); // the page left while the browser was still asking
    const late = session();
    store.settle().resolve(late);
    await flush();
    expect(late.end).toHaveBeenCalledTimes(1);
    expect(cb.onStarted).not.toHaveBeenCalled();
    expect(cb.onEnded).not.toHaveBeenCalled();
  });

  it("reports nothing for a refusal after release, and does not ask after release", async () => {
    const store = fakeStore();
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    const entry = createEntry(store, cb);
    entry.enter();
    entry.release();
    store.settle().reject(new DOMException("no gesture", "SecurityError"));
    await flush();
    expect(cb.onEnded).not.toHaveBeenCalled();
    entry.enter();
    expect(store.enterVR).toHaveBeenCalledTimes(1);
  });
});

/**
 * Like the real store: asks the browser (the given xr) synchronously, then sets up the
 * renderer, which can still fail after the browser has granted the session.
 */
function storeOverXr(xr: { requestSession: (mode: string) => Promise<unknown> }) {
  let failSetup: (e: unknown) => void = () => {};
  let passSetup: () => void = () => {};
  const enterVR = vi.fn(async () => {
    const granted = await xr.requestSession("immersive-vr");
    await new Promise<void>((resolve, reject) => {
      passSetup = resolve;
      failSetup = reject;
    });
    return granted;
  });
  const enterAR = vi.fn(async () => undefined);
  return { enterVR, enterAR, failSetup: (e: unknown) => failSetup(e), passSetup: () => passSetup() };
}

describe("createEntry, when renderer setup fails after the browser granted a session", () => {
  it("ends the granted session after release, though the store never returned it", async () => {
    const granted = session();
    const xr = { requestSession: vi.fn(async () => granted) };
    const store = storeOverXr(xr);
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    const entry = createEntry(store, cb, xr);
    entry.enter();
    entry.release(); // the reader left (a link inside the site) while the browser asked
    await flush();
    store.failSetup(new Error("WebGL context was disposed"));
    await flush();
    expect(granted.end).toHaveBeenCalledTimes(1);
    expect(cb.onEnded).not.toHaveBeenCalled();
  });

  it("ends the granted session and reports failed while the page is still there", async () => {
    const granted = session();
    const xr = { requestSession: vi.fn(async () => granted) };
    const store = storeOverXr(xr);
    const cb = { onStarted: vi.fn(), onEnded: vi.fn() };
    createEntry(store, cb, xr).enter();
    await flush();
    store.failSetup(new Error("context lost"));
    await flush();
    expect(granted.end).toHaveBeenCalledTimes(1);
    expect(cb.onEnded).toHaveBeenCalledWith("failed");
  });

  it("leaves the browser's own requestSession in place once the call returns", () => {
    const original = vi.fn(async () => session());
    const xr = { requestSession: original };
    createEntry(storeOverXr(xr), { onStarted: vi.fn(), onEnded: vi.fn() }, xr).enter();
    expect(xr.requestSession).toBe(original);
    expect(original).toHaveBeenCalledTimes(1);
  });
});
