import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";

describe("site constants", () => {
  it("uses the production origin as the canonical site URL", () => {
    expect(SITE_URL).toBe("https://stephensookra.com");
  });
});
