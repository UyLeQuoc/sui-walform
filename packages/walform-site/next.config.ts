import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — the entire site ships as a folder of HTML/JS/CSS that
  // Walrus can host. No server runtime, no API routes.
  output: "export",
  // Walrus Sites serve from a sub-path on aggregator URLs sometimes; trailing
  // slash + clean URLs keep relative asset references working.
  trailingSlash: true,
  transpilePackages: ["@walform/core"],
  // Walrus Sites doesn't run Next.js's image optimizer; serve images as-is.
  images: { unoptimized: true },
};

export default nextConfig;
