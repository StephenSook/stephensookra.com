import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { XrDoorView } from "@/components/XrDoorView";

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const PAGE = "https://preview.example.com/case";

describe("XrDoor", () => {
  it("offers Enter VR when the browser supports immersive VR", async () => {
    const onEnter = vi.fn();
    render(<XrDoorView checkSupport={async () => true} isLaptop={() => true} pageUrl={() => PAGE} onEnter={onEnter} />);
    await flush();
    const button = screen.getByRole("button", { name: "Enter VR" });
    fireEvent.click(button);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: /Meta Quest/ })).toBeNull();
  });

  it("offers the Meta Web Launch link on a laptop without VR", async () => {
    render(<XrDoorView checkSupport={async () => false} isLaptop={() => true} pageUrl={() => PAGE} />);
    await flush();
    const link = screen.getByRole("link", { name: "Open on Meta Quest" });
    expect(link).toHaveAttribute("href", "https://www.oculus.com/open_url/?url=https%3A%2F%2Fpreview.example.com%2Fcase");
    expect(screen.queryByRole("button", { name: "Enter VR" })).toBeNull();
  });

  it("shows no door on a phone without VR", async () => {
    const { container } = render(
      <XrDoorView checkSupport={async () => false} isLaptop={() => false} pageUrl={() => PAGE} />,
    );
    await flush();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("keeps Enter VR hidden until an enter handler exists", async () => {
    render(<XrDoorView checkSupport={async () => true} isLaptop={() => true} pageUrl={() => PAGE} />);
    await flush();
    expect(screen.queryByRole("button", { name: "Enter VR" })).toBeNull();
  });

  it("states what has and has not been tested next to the door", async () => {
    render(<XrDoorView checkSupport={async () => false} isLaptop={() => true} pageUrl={() => PAGE} />);
    await flush();
    expect(screen.getByText(/not yet tested/)).toBeInTheDocument();
  });
});
