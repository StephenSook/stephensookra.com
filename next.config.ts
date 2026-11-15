import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

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
    return [{ source: "/:path*", headers: securityHeaders }];
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
