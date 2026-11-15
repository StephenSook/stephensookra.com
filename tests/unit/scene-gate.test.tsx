import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaseStageView as CaseStage } from "@/components/CaseStageView";
import { caseLight } from "@/scene/caseLight";
import { shouldLoadScene, type SceneEnv } from "@/scene/gate";

describe("shouldLoadScene", () => {
  const all: SceneEnv = { wide: true, finePointer: true, reducedMotion: false, webgl2: true };

  it("loads only on a wide, fine-pointer screen without reduced motion and with WebGL2", () => {
    expect(shouldLoadScene(all)).toBe(true);
    expect(shouldLoadScene({ ...all, wide: false })).toBe(false);
    expect(shouldLoadScene({ ...all, finePointer: false })).toBe(false);
    expect(shouldLoadScene({ ...all, reducedMotion: true })).toBe(false);
    expect(shouldLoadScene({ ...all, webgl2: false })).toBe(false);
  });
});

/** A stand-in scene that reports ready, so the stage can be tested without WebGL. */
function makeLoader() {
  let onLost: (() => void) | undefined;
  const Scene = ({ onReady, onContextLost }: { onReady?: () => void; onContextLost?: () => void }) => {
    onLost = onContextLost;
    queueMicrotask(() => onReady?.());
    return <div data-testid="scene" />;
  };
  const load = vi.fn(async () => ({ default: Scene }));
  return { load, loseContext: () => onLost?.() };
}

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

afterEach(() => caseLight.reset());

describe("CaseStage", () => {
  const poster = <div data-testid="poster" />;
  const env = (over: Partial<SceneEnv> = {}) => () => ({
    wide: true,
    finePointer: true,
    reducedMotion: false,
    webgl2: true,
    ...over,
  });

  it("shows only the poster and never loads the scene when the gate is closed", async () => {
    for (const closed of [{ wide: false }, { finePointer: false }, { reducedMotion: true }, { webgl2: false }]) {
      const { load } = makeLoader();
      const { unmount } = render(
        <CaseStage variant="hero" readEnv={env(closed)} loadScene={load} waitForIdle={() => Promise.resolve()}>
          {poster}
        </CaseStage>,
      );
      await flush();
      expect(load).not.toHaveBeenCalled();
      expect(screen.queryByTestId("scene")).toBeNull();
      expect(screen.getByTestId("poster")).toBeInTheDocument();
      unmount();
    }
  });

  it("loads the scene after idle when the gate is open, and marks itself ready", async () => {
    const { load } = makeLoader();
    const { container } = render(
      <CaseStage variant="hero" readEnv={env()} loadScene={load} waitForIdle={() => Promise.resolve()}>
        {poster}
      </CaseStage>,
    );
    await flush();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-scene", "ready");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("goes back to the poster for good if the WebGL context is lost", async () => {
    const { load, loseContext } = makeLoader();
    const { container } = render(
      <CaseStage variant="hero" readEnv={env()} loadScene={load} waitForIdle={() => Promise.resolve()}>
        {poster}
      </CaseStage>,
    );
    await flush();
    await flush();
    act(() => loseContext());
    expect(screen.queryByTestId("scene")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-scene", "poster");
  });

  it("drops the scene when the gate closes later (for example reduced motion turned on)", async () => {
    const { load } = makeLoader();
    let current = env()();
    const listeners = new Set<() => void>();
    render(
      <CaseStage
        variant="hero"
        readEnv={() => current}
        onEnvChange={(fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        }}
        loadScene={load}
        waitForIdle={() => Promise.resolve()}
      >
        {poster}
      </CaseStage>,
    );
    await flush();
    await flush();
    expect(screen.getByTestId("scene")).toBeInTheDocument();
    current = { ...current, reducedMotion: true };
    act(() => listeners.forEach((fn) => fn()));
    expect(screen.queryByTestId("scene")).toBeNull();
  });

  it("keeps the scene mounted and its callbacks stable while the light changes", async () => {
    const seen = new Set<unknown>();
    let mounts = 0;
    const Scene = ({ onReady, onContextLost }: { onReady?: () => void; onContextLost?: () => void }) => {
      seen.add(onReady);
      seen.add(onContextLost);
      useEffect(() => {
        mounts++;
        onReady?.();
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return <div data-testid="scene" />;
    };
    render(
      <CaseStage variant="hero" readEnv={env()} loadScene={async () => ({ default: Scene })} waitForIdle={() => Promise.resolve()}>
        {poster}
      </CaseStage>,
    );
    await flush();
    await flush();
    for (const slug of ["case-light", "aloud", null, "varsity"]) act(() => caseLight.set("scene", slug));
    expect(mounts).toBe(1);
    expect(seen.size).toBe(2);
  });

  it("exposes the lit slug for the grid and tests", async () => {
    const { container } = render(
      <CaseStage variant="hero" readEnv={env({ webgl2: false })} loadScene={vi.fn()}>
        {poster}
      </CaseStage>,
    );
    act(() => caseLight.set("grid", "varsity"));
    expect(container.firstElementChild).toHaveAttribute("data-lit", "varsity");
  });
});
