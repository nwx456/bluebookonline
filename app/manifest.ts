import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "AP Practice",
    description:
      "Practice AP exams online with the real Bluebook experience. Free for students worldwide.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/appicon.png",
        sizes: "96x96",
        type: "image/png",
      },
    ],
  };
}
