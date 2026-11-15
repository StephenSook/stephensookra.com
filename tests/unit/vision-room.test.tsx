import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VisionRoomView } from "@/components/VisionRoomView";

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const ROOM = "/vision/gen/room.usdz";
const LIGHT = "/vision/gen/room.hdr";

type Immersive = HTMLElement & { requestImmersive: () => Promise<void> };
const doc = document as Document & { immersiveElement?: Element | null; exitImmersive?: () => Promise<void> };

function setup(enabled: boolean, request: () => Promise<void> = async () => {}) {
  const utils = render(<VisionRoomView room={ROOM} environment={LIGHT} immersiveEnabled={() => enabled} />);
  const model = utils.container.querySelector("model") as Immersive | null;
  if (model) model.requestImmersive = vi.fn(request);
  return { ...utils, model };
}

/** What visionOS does when the room opens or closes: sets immersiveElement, fires immersivechange. */
function immersive(model: Element | null) {
  act(() => {
    doc.immersiveElement = model;
    (model ?? document).dispatchEvent(new Event("immersivechange", { bubbles: true }));
    if (!model) document.dispatchEvent(new Event("immersivechange"));
  });
}

afterEach(() => {
  delete doc.immersiveElement;
  delete doc.exitImmersive;
});

describe("VisionRoomView", () => {
  it("elsewhere: no button and no <model> (so nothing downloads), and says where the room opens", async () => {
    const { model } = setup(false);
    await flush();
    expect(model).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Safari on Apple Vision Pro/)).toBeInTheDocument();
  });

  it("on Vision Pro: a hidden <model> with the room and its light, entered only from the press", async () => {
    const { model } = setup(true);
    await flush();
    expect(model).toHaveAttribute("src", ROOM);
    expect(model).toHaveAttribute("environmentmap", LIGHT);
    expect(model!.style.display).toBe("none"); // no inline preview, no download before the press
    expect(model!.requestImmersive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Step into the room" }));
    expect(model!.requestImmersive).toHaveBeenCalledTimes(1); // inside the press
    expect(screen.getByRole("status")).toHaveTextContent("Opening the room");
  });

  it("follows immersivechange: in the room, a Leave button that exits, then back to the start", async () => {
    const { model } = setup(true);
    await flush();
    doc.exitImmersive = vi.fn(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Step into the room" }));
    await flush();
    immersive(model);
    expect(screen.getByRole("status")).toHaveTextContent("In the room");
    fireEvent.click(screen.getByRole("button", { name: "Leave the room" }));
    expect(doc.exitImmersive).toHaveBeenCalledTimes(1);
    immersive(null);
    expect(screen.getByRole("status")).toHaveTextContent("Left the room");
    expect(screen.getByRole("button", { name: "Step into the room" })).toHaveFocus();
  });

  it("says so when the room cannot open, and lets the reader try again", async () => {
    setup(true, () => Promise.reject(new DOMException("no", "NotAllowedError")));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Step into the room" }));
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("The room could not open here.");
    expect(screen.getByRole("button", { name: "Step into the room" })).toBeEnabled();
  });
});
