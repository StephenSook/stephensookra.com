import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
const IMMUTABLE = { key: "Cache-Control", value: "public, max-age=31536000, immutable" };

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Phone AR files. With nosniff, AR Quick Look opens a USDZ only when it is served as
      // model/vnd.usdz+zip. Each generation has its own folder, so the files never change.
      { source: "/ar/:gen/case.usdz", headers: [{ key: "Content-Type", value: "model/vnd.usdz+zip" }, IMMUTABLE] },
      { source: "/ar/:gen/case.glb", headers: [{ key: "Content-Type", value: "model/gltf-binary" }, IMMUTABLE] },
      // The Vision Pro room and its light (npm run vision:room), one folder per generation.
      { source: "/vision/:gen/room.usdz", headers: [{ key: "Content-Type", value: "model/vnd.usdz+zip" }, IMMUTABLE] },
      { source: "/vision/:gen/room.hdr", headers: [{ key: "Content-Type", value: "image/vnd.radiance" }, IMMUTABLE] },
      // The marker card and its target (npm run marker:card), one folder per generation.
      { source: "/marker/:gen/:file", headers: [IMMUTABLE] },
      // Vendored builds sit in versioned folders (scripts/vendor).
      { source: "/vendor/:path*", headers: [IMMUTABLE] },
    ];
  },
  // Old URLs from the previous site keep working (brief section 5, decision 8).
  async redirects() {
    return [
      { source: "/lab", destination: "/case", statusCode: 301 },
      { source: "/work/saber", destination: "/work", statusCode: 301 },
      { source: "/work/nest", destination: "/work", statusCode: 301 },
    ];
  },
};

export default nextConfig;
