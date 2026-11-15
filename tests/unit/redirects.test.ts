import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("old URLs", () => {
  it("301s /lab to /case and the dropped case studies to /work", async () => {
    expect(await nextConfig.redirects!()).toEqual([
      { source: "/lab", destination: "/case", statusCode: 301 },
      { source: "/work/saber", destination: "/work", statusCode: 301 },
      { source: "/work/nest", destination: "/work", statusCode: 301 },
    ]);
  });
});
