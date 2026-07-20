import type { MetadataRoute } from "next";

/** PWA manifest so JellyNext can be installed with a proper app icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JellyNext",
    short_name: "JellyNext",
    description: "A modern, cinematic web client for Jellyfin.",
    start_url: "/home",
    display: "standalone",
    background_color: "#080e1c",
    theme_color: "#080e1c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
