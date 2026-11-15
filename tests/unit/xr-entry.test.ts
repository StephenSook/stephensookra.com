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
  return { enterVR, settle: () => settle! };
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
