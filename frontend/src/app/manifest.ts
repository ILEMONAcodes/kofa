import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kof’a — The doorway to your home",
    short_name: "Kof’a",
    description: "Explore homes with clearer property information.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#643B29",
    theme_color: "#643B29",
    icons: [
      {
        src: "/assets/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
