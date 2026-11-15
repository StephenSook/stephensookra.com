import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { XrDoorView } from "@/components/XrDoorView";
import type { XrSessionProps } from "@/xr/types";

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const PAGE = "https://preview.example.com/case";
const NOTE = "Built for Meta Quest 3S and Apple Vision Pro, not yet tested in a headset.";
const AR_NOTE = "Place on your wall is not yet tested.";
const NONE = { vr: false, ar: false };
const VR_ONLY = { vr: true, ar: false };
const HEADSET = { vr: true, ar: true };

/** A stand-in for the lazy XR chunk: plays a script of session events once mounted. */
function fakeSession(script: (props: XrSessionProps) => void) {
  function Session(props: XrSessionProps) {
    useEffect(() => {
      queueMicrotask(() => script(props));
    }, [props]);
    return <div data-testid="session" />;
  }
  return vi.fn(async () => Session);
}

const door = (loadSession?: ReturnType<typeof fakeSession>) => (
  <XrDoorView checkSupport={async () => VR_ONLY} isLaptop={() => true} pageUrl={() => PAGE} note={NOTE} loadSession={loadSession} />
);

describe("XrDoor", () => {
  it("offers the Meta Web Launch link on a laptop without VR", async () => {
    render(<XrDoorView checkSupport={async () => NONE} isLaptop={() => true} pageUrl={() => PAGE} note={NOTE} />);
    await flush();
    const link = screen.getByRole("link", { name: "Open on Meta Quest" });
    expect(link).toHaveAttribute("href", "https://www.oculus.com/open_url/?url=https%3A%2F%2Fpreview.example.com%2Fcase");
    expect(screen.queryByRole("button", { name: "Enter VR" })).toBeNull();
  });

  it("offers a phone without VR the case in its room (phone AR), not the headset door", async () => {
    render(<XrDoorView checkSupport={async () => NONE} isLaptop={() => false} pageUrl={() => PAGE} note={NOTE} />);
    await flush();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "See it in your room" })).toHaveAttribute("href", "/case/ar");
    expect(screen.queryByRole("link", { name: "Open on Meta Quest" })).toBeNull();
    expect(screen.queryByText(NOTE)).toBeNull(); // the headset note belongs to the headset door
  });

  it("keeps Enter VR hidden until the session can be loaded", async () => {
    render(door(undefined));
    await flush();
    expect(screen.queryByRole("button", { name: "Enter VR" })).toBeNull();
  });

  it("states what has and has not been tested next to the door", async () => {
    render(<XrDoorView checkSupport={async () => NONE} isLaptop={() => true} pageUrl={() => PAGE} note={NOTE} />);
    await flush();
    expect(screen.getByText(/not yet tested/)).toBeInTheDocument();
  });

  it("loads the session on the press, not before, and reports being in VR", async () => {
    const load = fakeSession((p) => p.onStarted());
    render(door(load));
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByTestId("session")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("session")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("In VR");
  });

  it("announces the card a reader pulls", async () => {
    render(door(fakeSession((p) => (p.onStarted(), p.onCard({ slug: "instanter", title: "Instanter" })))));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    await flush();
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("Instanter card open");
  });

  it("returns focus to Enter VR when the session ends, and keeps the session loaded", async () => {
    render(door(fakeSession((p) => (p.onStarted(), p.onEnded("ended")))));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    await flush();
    await flush();
    expect(screen.getByRole("button", { name: "Enter VR" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Left VR");
    expect(screen.getByTestId("session")).toBeInTheDocument();
  });

  it("enters again from a later press, synchronously inside that press, without loading again", async () => {
    // WebKit grants a session only inside the user's gesture, so a later press must ask at once.
    const enterAgain = vi.fn();
    const load = fakeSession((p) => {
      p.onReady(enterAgain);
      p.onEnded("blocked");
    });
    render(door(load));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    await flush();
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("Press Enter VR again");
    expect(enterAgain).toHaveBeenCalledTimes(1); // the first press's request, once the session loaded
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    expect(enterAgain).toHaveBeenCalledTimes(2); // no await between the press and the request
    expect(enterAgain).toHaveBeenLastCalledWith("vr");
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Entering VR");
  });

  it("says so when the session cannot start at all, and keeps the page usable", async () => {
    render(door(fakeSession((p) => p.onEnded("failed"))));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    await flush();
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("VR could not start");
    expect(screen.getByRole("button", { name: "Enter VR" })).toBeEnabled();
  });
});

describe("XrDoor, passthrough (Place on your wall)", () => {
  const arDoor = (loadSession?: ReturnType<typeof fakeSession>, support = HEADSET, laptop = false) => (
    <XrDoorView
      checkSupport={async () => support}
      isLaptop={() => laptop}
      pageUrl={() => PAGE}
      note={NOTE}
      arNote={AR_NOTE}
      loadSession={loadSession}
    />
  );

  it("offers Place on your wall next to Enter VR in a headset that supports passthrough, with its own note", async () => {
    render(arDoor(fakeSession(() => {})));
    await flush();
    expect(screen.getByRole("button", { name: "Enter VR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place on your wall" })).toBeInTheDocument();
    expect(screen.getByText(AR_NOTE)).toBeInTheDocument();
  });

  it("keeps it out of a VR-only headset, and a phone with AR but no VR gets the room link instead", async () => {
    const vrOnly = render(arDoor(fakeSession(() => {}), VR_ONLY));
    await flush();
    expect(screen.queryByRole("button", { name: "Place on your wall" })).toBeNull();
    expect(screen.queryByText(AR_NOTE)).toBeNull();
    vrOnly.unmount();
    render(arDoor(fakeSession(() => {}), { vr: false, ar: true }));
    await flush();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link", { name: "See it in your room" })).toHaveAttribute("href", "/case/ar");
  });

  it("asks for passthrough once the session loads, reports the case on the wall, and comes back to its button", async () => {
    const enter = vi.fn();
    const load = fakeSession((p) => {
      p.onReady(enter);
      p.onStarted();
      p.onEnded("ended");
    });
    render(arDoor(load));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Place on your wall" }));
    expect(screen.getByRole("status")).toHaveTextContent("Entering passthrough");
    await flush();
    await flush();
    expect(enter).toHaveBeenCalledTimes(1);
    expect(enter).toHaveBeenCalledWith("ar");
    expect(screen.getByRole("status")).toHaveTextContent("Left passthrough");
    expect(screen.getByRole("button", { name: "Place on your wall" })).toHaveFocus();
  });

  it("says the case is on the wall once it is placed", async () => {
    render(arDoor(fakeSession((p) => (p.onReady(() => {}), p.onStarted()))));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Place on your wall" }));
    await flush();
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("On your wall");
  });
});

describe("XrDoorView module", () => {
  it("imports no content or schema code (zod), so the page bundle stays small", () => {
    for (const file of ["src/components/XrDoorView.tsx", "src/components/XrDoor.tsx"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/from "@\/content/);
      expect(source, file).not.toMatch(/from "zod"/);
    }
  });
});
