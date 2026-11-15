import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkerArView, type MarkerArViewProps } from "@/components/MarkerArView";
import type { SessionEvent } from "@/ar/marker/session";
import { STATUS } from "@/ar/marker/state";

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const NOTE = "Built for iPhone and Android phones, not yet tested on a phone.";

/** A stand-in for the lazy marker chunk: records the event callback so a test can play events. */
function fakeStart() {
  const stop = vi.fn();
  let emit: (e: SessionEvent) => void = () => {};
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  let current: () => boolean = () => true;
  const start = vi.fn(async (canvas: HTMLCanvasElement, onEvent: (e: SessionEvent) => void, isCurrent: () => boolean) => {
    expect(canvas.tagName).toBe("CANVAS");
    emit = onEvent;
    current = isCurrent;
    await gate;
    return { stop };
  });
  return { start, stop, release, emit: (e: SessionEvent) => act(() => emit(e)), isCurrent: () => current() };
}

function view(overrides: Partial<MarkerArViewProps> = {}) {
  const props: MarkerArViewProps = {
    note: NOTE,
    cardHref: "/ar/marker/card",
    start: vi.fn(),
    cameraBlocked: async () => false,
    whyNoCamera: async () => "failed",
    ...overrides,
  };
  const utils = render(<MarkerArView {...props} />);
  const root = () => utils.container.querySelector<HTMLElement>(".marker-ar")!;
  return { ...utils, props, root };
}

const press = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Start the camera" }));
  await flush();
};

describe("MarkerArView", () => {
  it("before the press: a Start button, the card link and the tested note, and nothing loaded", async () => {
    const { props, root } = view();
    await flush();
    expect(root().dataset.state).toBe("idle");
    expect(screen.getByRole("link", { name: /print the card/i })).toHaveAttribute("href", "/ar/marker/card");
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(props.start).not.toHaveBeenCalled();
  });

  it("runs: camera, card found, card lost, then Stop turns the camera off and returns focus", async () => {
    const f = fakeStart();
    const { root } = view({ start: f.start });
    await press();
    expect(root().dataset.state).toBe("loading");
    f.release();
    await flush();
    f.emit("camera");
    expect(root().dataset.state).toBe("scanning");
    expect(screen.getByText(STATUS.scanning)).toBeInTheDocument();
    f.emit("found");
    expect(root().dataset.state).toBe("tracking");
    f.emit("lost");
    expect(root().dataset.state).toBe("lost");
    fireEvent.click(screen.getByRole("button", { name: "Stop the camera" }));
    await flush();
    expect(f.stop).toHaveBeenCalledTimes(1);
    expect(root().dataset.state).toBe("idle");
    expect(screen.getByRole("button", { name: "Start the camera" })).toHaveFocus();
  });

  it("says the camera is blocked, and how to allow it, without loading anything", async () => {
    const f = fakeStart();
    const { root } = view({ start: f.start, cameraBlocked: async () => true });
    await press();
    expect(root().dataset.state).toBe("denied");
    expect(screen.getByText(STATUS.denied)).toBeInTheDocument();
    expect(f.start).not.toHaveBeenCalled();
  });

  it("says when the tracker or the case could not load, and offers to start again", async () => {
    const { root } = view({ start: vi.fn(async () => Promise.reject(new Error("engine 404"))) });
    await press();
    expect(root().dataset.state).toBe("failed");
    expect(screen.getByText(STATUS.failed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start the camera" })).toBeInTheDocument();
  });

  it("when the camera fails to open, stops the run and asks the browser why", async () => {
    const f = fakeStart();
    const { root } = view({ start: f.start, whyNoCamera: async () => "nocamera" });
    await press();
    f.release();
    await flush();
    f.emit("camerafailed");
    await flush();
    expect(f.stop).toHaveBeenCalled();
    expect(root().dataset.state).toBe("nocamera");
    expect(screen.getByText(STATUS.nocamera)).toBeInTheDocument();
  });

  it("turns the camera off when the page is hidden", async () => {
    const f = fakeStart();
    const { root } = view({ start: f.start });
    await press();
    f.release();
    await flush();
    f.emit("camera");
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    visibility.mockRestore();
    expect(f.stop).toHaveBeenCalledTimes(1);
    expect(root().dataset.state).toBe("stopped");
    expect(screen.getByText(STATUS.stopped)).toBeInTheDocument();
  });

  it("a Stop while the camera is still starting ends that run as soon as it starts", async () => {
    const f = fakeStart();
    const { root } = view({ start: f.start });
    await press();
    fireEvent.click(screen.getByRole("button", { name: "Stop the camera" }));
    await flush();
    expect(root().dataset.state).toBe("idle");
    f.release();
    await flush();
    expect(f.stop).toHaveBeenCalledTimes(1);
    f.emit("found"); // a late event from the ended run changes nothing
    expect(root().dataset.state).toBe("idle");
  });

  it("hiding the page while the camera is still starting cancels that start", async () => {
    const f = fakeStart();
    const { root } = view({ start: f.start });
    await press();
    expect(f.isCurrent()).toBe(true);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    visibility.mockRestore();
    expect(root().dataset.state).toBe("stopped");
    expect(f.isCurrent()).toBe(false); // the start is told it is no longer wanted
    f.release();
    await flush();
    expect(f.stop).toHaveBeenCalledTimes(1); // and if it finishes anyway, its camera is turned off
    expect(root().dataset.state).toBe("stopped");
  });

  it("Stop then Start again during startup: only the newest start is current", async () => {
    const first = fakeStart();
    const second = fakeStart();
    let calls = 0;
    const start = vi.fn((...args: Parameters<typeof first.start>) => (++calls === 1 ? first.start(...args) : second.start(...args)));
    const { root } = view({ start });
    await press();
    fireEvent.click(screen.getByRole("button", { name: "Stop the camera" }));
    await flush();
    await press();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
    second.release();
    first.release();
    await flush();
    second.emit("camera");
    expect(root().dataset.state).toBe("scanning");
    expect(second.stop).not.toHaveBeenCalled();
  });

  it("Escape stops the camera (the dialog's cancel)", async () => {
    const f = fakeStart();
    const { root, container } = view({ start: f.start });
    await press();
    f.release();
    await flush();
    fireEvent(container.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
    await flush();
    expect(f.stop).toHaveBeenCalledTimes(1);
    expect(root().dataset.state).toBe("idle");
  });

  it("stops the camera when the page goes away", async () => {
    const f = fakeStart();
    const { unmount } = view({ start: f.start });
    await press();
    f.release();
    await flush();
    unmount();
    expect(f.stop).toHaveBeenCalledTimes(1);
  });
});
