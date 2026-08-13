import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Emits .next/standalone — a self-contained server plus only the node_modules
  // it actually traces as needed. That is what the Dockerfile ships, and it is
  // why the image does not carry a full dependency install.
  output: "standalone",
  images: {
    // Jellyfin serves artwork from the configured server host. Allow any HTTPS
    // host for now; tighten to the configured server origin once auth lands.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);
