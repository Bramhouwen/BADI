import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BADI",
    short_name: "BADI",
    description: "Run. Squat. Better together. Vier vrienden, één winter.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7ede7",
    theme_color: "#f7ede7",
    lang: "nl",
    categories: ["health", "lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: BADI shows up in the share menu; a shared link opens the recipe import.
    share_target: { action: "/kitchen/import", method: "GET", params: { title: "title", text: "text", url: "url" } },
    shortcuts: [
      { name: "Check-in", url: "/checkin", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "The Wall", url: "/wall", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
