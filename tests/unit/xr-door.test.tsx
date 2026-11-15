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
  <XrDoorView checkSupport={async () => true} isLaptop={() => true} pageUrl={() => PAGE} note={NOTE} loadSession={loadSession} />
);

describe("XrDoor", () => {
  it("offers the Meta Web Launch link on a laptop without VR", async () => {
    render(<XrDoorView checkSupport={async () => false} isLaptop={() => true} pageUrl={() => PAGE} note={NOTE} />);
    await flush();
    const link = screen.getByRole("link", { name: "Open on Meta Quest" });
    expect(link).toHaveAttribute("href", "https://www.oculus.com/open_url/?url=https%3A%2F%2Fpreview.example.com%2Fcase");
    expect(screen.queryByRole("button", { name: "Enter VR" })).toBeNull();
  });

  it("shows no door on a phone without VR", async () => {
    const { container } = render(
      <XrDoorView checkSupport={async () => false} isLaptop={() => false} pageUrl={() => PAGE} note={NOTE} />,
    );
    await flush();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector(".xr-door")?.textContent).toBe("");
  });

  it("keeps Enter VR hidden until the session can be loaded", async () => {
    render(door(undefined));
    await flush();
    expect(screen.queryByRole("button", { name: "Enter VR" })).toBeNull();
  });

  it("states what has and has not been tested next to the door", async () => {
    render(<XrDoorView checkSupport={async () => false} isLaptop={() => true} pageUrl={() => PAGE} note={NOTE} />);
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
    fireEvent.click(screen.getByRole("button", { name: "Enter VR" }));
    expect(enterAgain).toHaveBeenCalledTimes(1); // no await between the press and the request
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

describe("XrDoorView module", () => {
  it("imports no content or schema code (zod), so the page bundle stays small", () => {
    for (const file of ["src/components/XrDoorView.tsx", "src/components/XrDoor.tsx"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/from "@\/content/);
      expect(source, file).not.toMatch(/from "zod"/);
    }
  });
});
