import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Winter Arc",
    short_name: "Winter Arc",
    description: "Better Together. Vier vrienden, één winter.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08111F",
    theme_color: "#08111F",
    lang: "nl",
    categories: ["health", "lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Check-in", url: "/checkin", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "The Wall", url: "/wall", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
